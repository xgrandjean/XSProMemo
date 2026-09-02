import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { memoiresDir, templatePath, writeJsonAtomic } from './paths'
import { readModelConfig } from './modelStore'
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
 * absent from its JSON). Regenerating it today would otherwise silently swap in
 * whatever the shared template currently carries. The best recoverable answer is what
 * it was last generated with — it is baked into that document's own header — falling
 * back to today's default only when there is nothing to recover.
 */
async function recoverLegacyLogo(
  libraryPath: string,
  memoire: Memoire
): Promise<ReturnType<typeof snapshotLogoFromTemplate>> {
  if (memoire.outputDocx && (await exists(memoire.outputDocx))) {
    const fromOutput = await snapshotLogoFromTemplate(libraryPath, memoire.id, memoire.outputDocx)
    if (fromOutput) return fromOutput
  }
  return snapshotLogoFromTemplate(libraryPath, memoire.id, templatePath(libraryPath))
}

export async function listMemoires(libraryPath: string): Promise<MemoireSummary[]> {
  const config = await readModelConfig(libraryPath)
  let files: string[] = []
  try {
    files = await fs.readdir(memoiresDir(libraryPath))
  } catch {
    return []
  }
  const summaries: MemoireSummary[] = []
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    try {
      const raw = await fs.readFile(path.join(memoiresDir(libraryPath), file), 'utf-8')
      const memoire: Memoire = JSON.parse(raw)
      // The example lives alongside real mémoires but is reached from the config screen.
      if (memoire.id === config.exampleId) continue
      summaries.push({
        id: memoire.id,
        name: memoire.name,
        createdAt: memoire.createdAt,
        updatedAt: memoire.updatedAt,
        lastGeneratedAt: memoire.lastGeneratedAt
      })
    } catch {
      // skip unreadable/corrupt file rather than failing the whole listing
    }
  }
  summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return summaries
}

export async function getMemoire(libraryPath: string, id: string): Promise<Memoire> {
  const raw = await fs.readFile(memoireFilePath(libraryPath, id), 'utf-8')
  const memoire: Memoire = JSON.parse(raw)
  if (memoire.logo !== undefined) return memoire

  const migrated: Memoire = { ...memoire, logo: await recoverLegacyLogo(libraryPath, memoire) }
  await writeJsonAtomic(memoireFilePath(libraryPath, id), migrated)
  return migrated
}

export async function saveMemoire(libraryPath: string, memoire: Memoire): Promise<Memoire> {
  const updated: Memoire = { ...memoire, updatedAt: new Date().toISOString() }
  await writeJsonAtomic(memoireFilePath(libraryPath, updated.id), updated)
  return updated
}

export async function deleteMemoire(libraryPath: string, id: string): Promise<void> {
  // Unlike content files, a logo is never shared with another mémoire: nothing else
  // could still be pointing at it.
  await clearMemoireLogo(libraryPath, id)
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
    lastGeneratedAt: null,
    outputDocx: null,
    outputPdf: null
  }
}

/**
 * Creates a new mémoire as an independent copy of `sourceId` (normally the example).
 * Content files are shared by reference — only the plan is duplicated. The logo is a
 * real copy, not a reference: it starts as the source's own, but changing either one
 * afterward must not touch the other.
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

  const logo = source
    ? (await copyMemoireLogo(libraryPath, source.logo, fresh.id)) ??
      (await snapshotLogoFromTemplate(libraryPath, fresh.id, templatePath(libraryPath)))
    : await snapshotLogoFromTemplate(libraryPath, fresh.id, templatePath(libraryPath))

  if (!source) return saveMemoire(libraryPath, { ...fresh, logo })
  return saveMemoire(libraryPath, {
    ...fresh,
    logo,
    coverPages: source.coverPages.map((c) => ({ ...c })),
    chapters: cloneChapters(source.chapters)
  })
}
