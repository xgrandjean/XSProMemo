import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { memoiresDir, writeJsonAtomic } from './paths'
import { clearMemoireLogo, copyMemoireLogo, snapshotLogoFromTemplate } from './logoStore'
import type { ChapterNode, Memoire, MemoireSummary } from '../../shared/types'

function memoireFilePath(libraryPath: string, id: string): string {
  return path.join(memoiresDir(libraryPath), `${id}.json`)
}

async function exists(absPath: string): Promise<boolean> {
  try {
    await fs.access(absPath)
    return true
  } catch {
    return false
  }
}

/**
 * A mémoire saved before it kept its own logo has none recorded (the field is simply
 * absent from its JSON). The only trustworthy source for what it actually used to look
 * like is its own last generated document — the logo is baked into that document's
 * header. When there is nothing to recover from, it starts with none rather than a
 * guessed one: the user picks one explicitly from the mémoire's own plan if it matters.
 */
async function recoverLegacyLogo(
  libraryPath: string,
  memoire: Memoire
): Promise<ReturnType<typeof snapshotLogoFromTemplate>> {
  if (memoire.outputDocx && (await exists(memoire.outputDocx))) {
    return snapshotLogoFromTemplate(libraryPath, memoire.id, memoire.outputDocx)
  }
  return null
}

function toSummary(memoire: Memoire): MemoireSummary {
  return {
    id: memoire.id,
    name: memoire.name,
    createdAt: memoire.createdAt,
    updatedAt: memoire.updatedAt,
    lastGeneratedAt: memoire.lastGeneratedAt
  }
}

async function readAllMemoires(libraryPath: string): Promise<Memoire[]> {
  let files: string[] = []
  try {
    files = await fs.readdir(memoiresDir(libraryPath))
  } catch {
    return []
  }
  const memoires: Memoire[] = []
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    try {
      const raw = await fs.readFile(path.join(memoiresDir(libraryPath), file), 'utf-8')
      const memoire: Memoire = JSON.parse(raw)
      // A mémoire is only ever written to `<its id>.json` (memoireFilePath). Anything
      // else — a hand-made backup, a cloud-sync conflicted copy — is not a mémoire the
      // application recognizes, even if it happens to carry a valid mémoire's id inside:
      // reading it here would surface a ghost entry, and deleting the real one by id
      // would leave this file behind to resurrect it on the next listing.
      if (file !== `${memoire.id}.json`) continue
      memoires.push(memoire)
    } catch {
      // skip unreadable/corrupt file rather than failing the whole listing
    }
  }
  return memoires
}

/** Mémoires being worked on — a modèle lives alongside them but is reached separately. */
export async function listMemoires(libraryPath: string): Promise<MemoireSummary[]> {
  const summaries = (await readAllMemoires(libraryPath))
    .filter((memoire) => !memoire.isTemplate)
    .map(toSummary)
  summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return summaries
}

/**
 * The plans-types offered as a starting point for "Nouveau mémoire". Does not self-heal
 * when empty — the caller (the `memoires:listTemplates` IPC handler) is responsible for
 * calling `ensureDefaultTemplate` first, so recreating the default always produces the
 * full shipped "Exemple" rather than a blank stand-in, whether triggered by a restart or
 * by deleting the last modèle mid-session.
 */
export async function listTemplates(libraryPath: string): Promise<MemoireSummary[]> {
  const templates = (await readAllMemoires(libraryPath)).filter((memoire) => memoire.isTemplate)
  const summaries = templates.map(toSummary)
  summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return summaries
}

export async function getMemoire(libraryPath: string, id: string): Promise<Memoire> {
  const raw = await fs.readFile(memoireFilePath(libraryPath, id), 'utf-8')
  let memoire: Memoire = JSON.parse(raw)
  let migrated = false

  if (memoire.logo === undefined) {
    memoire = { ...memoire, logo: await recoverLegacyLogo(libraryPath, memoire) }
    migrated = true
  }
  // The second logo is a newer slot still: nothing existed before it to recover.
  if (memoire.secondLogo === undefined) {
    memoire = { ...memoire, secondLogo: null }
    migrated = true
  }
  if (memoire.isTemplate === undefined) {
    memoire = { ...memoire, isTemplate: false }
    migrated = true
  }

  if (migrated) await writeJsonAtomic(memoireFilePath(libraryPath, id), memoire)
  return memoire
}

export async function saveMemoire(libraryPath: string, memoire: Memoire): Promise<Memoire> {
  const updated: Memoire = { ...memoire, updatedAt: new Date().toISOString() }
  await writeJsonAtomic(memoireFilePath(libraryPath, updated.id), updated)
  return updated
}

export async function deleteMemoire(libraryPath: string, id: string): Promise<void> {
  // Unlike content files, a logo is never shared with another mémoire: nothing else
  // could still be pointing at it.
  await clearMemoireLogo(libraryPath, id, 'logo')
  await clearMemoireLogo(libraryPath, id, 'secondLogo')
  await fs.rm(memoireFilePath(libraryPath, id), { force: true })
}

/** Deep-copies a chapter tree, assigning fresh ids so the copy is fully independent. */
function cloneChapters(nodes: ChapterNode[]): ChapterNode[] {
  return nodes.map((node) => ({
    ...node,
    id: randomUUID(),
    content: node.content ? { ...node.content } : null,
    children: cloneChapters(node.children)
  }))
}

function blankMemoire(name: string): Memoire {
  const now = new Date().toISOString()
  return {
    id: randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    coverPages: [],
    chapters: [],
    logo: null,
    secondLogo: null,
    isTemplate: false,
    lastGeneratedAt: null,
    outputDocx: null,
    outputPdf: null
  }
}

/**
 * Creates a new mémoire as an independent copy of `sourceId` (a modèle, for "Nouveau
 * mémoire" — or any mémoire, for "Dupliquer"). Content files are shared by reference —
 * only the plan is duplicated. The logo is a real copy, not a reference: it starts as
 * the source's own, but changing either one afterward must not touch the other.
 *
 * The copy inherits the source's modèle status — duplicating a modèle gives another
 * modèle, duplicating a working mémoire gives another working mémoire. Callers that need
 * the opposite (a working mémoire started from a modèle) override it explicitly after.
 */
export async function createMemoireFrom(
  libraryPath: string,
  name: string,
  sourceId: string | null
): Promise<Memoire> {
  const fresh = blankMemoire(name)

  let source: Memoire | null = null
  if (sourceId) {
    try {
      source = await getMemoire(libraryPath, sourceId)
    } catch {
      source = null
    }
  }

  // A brand-new mémoire with no source (or nothing to copy from) starts with no logo:
  // there is nothing to guess it from, and the user picks one from the plan if needed.
  const logo = source ? await copyMemoireLogo(libraryPath, source.logo, 'logo', fresh.id) : null
  const secondLogo = source
    ? await copyMemoireLogo(libraryPath, source.secondLogo, 'secondLogo', fresh.id)
    : null

  if (!source) return saveMemoire(libraryPath, { ...fresh, logo, secondLogo })
  return saveMemoire(libraryPath, {
    ...fresh,
    logo,
    secondLogo,
    isTemplate: source.isTemplate,
    coverPages: source.coverPages.map((c) => ({ ...c })),
    chapters: cloneChapters(source.chapters)
  })
}
