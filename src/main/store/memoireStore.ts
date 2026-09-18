import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  contentsDir,
  memoireContentsDir,
  memoiresDir,
  resolveContentFile,
  storeContentFor,
  writeJsonAtomic
} from './paths'
import { clearMemoireLogo, copyMemoireLogo, snapshotLogoFromTemplate } from './logoStore'
import { collectContentFiles, remapChapters, remapCoverPages } from './contentRefs'
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

/** Every mémoire the application recognizes, modèles included. Exported so the seeding
 *  code applies exactly the same rule about what counts as one. */
export async function readAllMemoires(libraryPath: string): Promise<Memoire[]> {
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

/**
 * Puts a deleted mémoire's content folder aside instead of erasing it. Deleting a plan is
 * one click, and it now takes real documents with it — several months of writing, in the
 * case of a modèle. Same habit as `Gabarit.avant-restauration.<stamp>.bak.docx`: a rename
 * on the same volume, instant, and undoable from the file explorer.
 *
 * Addressed strictly by `contenus/<id>/`, never by the list of files the mémoire
 * referenced — a mémoire written before this layout still points at bare names in the
 * shared pool, and deleting those would take other mémoires' content with them.
 */
async function binContentsOf(libraryPath: string, id: string): Promise<void> {
  const dir = memoireContentsDir(libraryPath, id)
  try {
    await fs.access(dir)
  } catch {
    return // nothing of its own — a mémoire from before this layout
  }

  // The folder is this mémoire's by construction, but a hand-copied JSON or a plan edited
  // through the "consigne pour IA" feature can point another mémoire into it. Cheap to
  // check, and it makes "nothing else can be pointing there" true rather than assumed.
  const prefix = `${id}/`
  for (const other of await readAllMemoires(libraryPath)) {
    if (other.id === id) continue
    for (const file of collectContentFiles(other)) {
      if (file.replace(/\\/g, '/').startsWith(prefix)) return
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const binned = path.join(contentsDir(libraryPath), '_corbeille', `${id}-${stamp}`)
  await fs.mkdir(path.dirname(binned), { recursive: true })
  await fs.rename(dir, binned)
}

export async function deleteMemoire(libraryPath: string, id: string): Promise<void> {
  // The plan goes first: that is the act the user asked for, and it must not be held back
  // by a content file Word happens to have open. Anything after is best-effort.
  await fs.rm(memoireFilePath(libraryPath, id), { force: true })
  try {
    await binContentsOf(libraryPath, id)
  } catch {
    // A file locked by Word blocks the rename. The mémoire is gone from the list either
    // way; its folder stays where it was, which is the harmless outcome.
  }
  await clearMemoireLogo(libraryPath, id, 'logo')
  await clearMemoireLogo(libraryPath, id, 'secondLogo')
}

/**
 * Gives `target` its own copy of every content file `source` points at, and returns the
 * map from old reference to new one.
 *
 * Every reference gets an entry, including those whose file could not be read: the new
 * mémoire then points at a file of its own that does not exist yet, and generation says so
 * through the "Fichier introuvable pour « X »" warning it already has. Falling back to the
 * source's reference instead would silently hand the copy a shared file — exactly what
 * this function exists to prevent, and invisible until someone's edit reached into another
 * mémoire.
 *
 * Two chapters pointing at one file still share one file afterwards, now inside the new
 * mémoire: that aliasing was the author's doing and is theirs to keep, the problem was only
 * ever that it crossed mémoires.
 */
async function copyContentsFor(
  libraryPath: string,
  source: Memoire,
  targetId: string
): Promise<Map<string, string>> {
  const renamed = new Map<string, string>()
  for (const file of collectContentFiles(source)) {
    const originalName = path.basename(file.replace(/\\/g, '/'))
    try {
      const bytes = await fs.readFile(resolveContentFile(libraryPath, file))
      renamed.set(file, await storeContentFor(libraryPath, targetId, originalName, bytes))
    } catch {
      renamed.set(file, `${targetId}/${originalName}`)
    }
  }
  return renamed
}

/** Assigns fresh ids so the copy's chapters are fully independent of the source's. */
function withFreshId(node: ChapterNode): ChapterNode {
  return { ...node, id: randomUUID() }
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
 * mémoire" — or any mémoire, for "Dupliquer"). Independent all the way down: the plan, the
 * logos *and* the content files are real copies, so reworking a chapter for this tender can
 * never reach back into the modèle it came from, nor into a tender already submitted.
 *
 * This is what makes a modèle a master rather than a shared document: updating it serves
 * the mémoires created after, and leaves the ones already created exactly as they were
 * sent. Content used to be shared by reference here, which meant editing any mémoire's
 * cover page rewrote the modèle's.
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

  // Files first, plan second: interrupted halfway this leaves copies nothing points at,
  // rather than a saved mémoire whose chapters point at files that were never written.
  const renamed = await copyContentsFor(libraryPath, source, fresh.id)

  return saveMemoire(libraryPath, {
    ...fresh,
    logo,
    secondLogo,
    isTemplate: source.isTemplate,
    coverPages: remapCoverPages(source.coverPages, renamed),
    chapters: remapChapters(source.chapters, renamed, withFreshId)
  })
}
