import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { memoiresDir, writeJsonAtomic } from './paths'
import { readModelConfig } from './modelStore'
import type { ChapterNode, Memoire, MemoireSummary } from '../../shared/types'

function memoireFilePath(libraryPath: string, id: string): string {
  return path.join(memoiresDir(libraryPath), `${id}.json`)
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
  return JSON.parse(raw)
}

export async function saveMemoire(libraryPath: string, memoire: Memoire): Promise<Memoire> {
  const updated: Memoire = { ...memoire, updatedAt: new Date().toISOString() }
  await writeJsonAtomic(memoireFilePath(libraryPath, updated.id), updated)
  return updated
}

export async function deleteMemoire(libraryPath: string, id: string): Promise<void> {
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
    lastGeneratedAt: null,
    outputDocx: null,
    outputPdf: null
  }
}

/**
 * Creates a new mémoire as an independent copy of `sourceId` (normally the example).
 * Content files are shared by reference — only the plan is duplicated.
 */
export async function createMemoireFrom(
  libraryPath: string,
  name: string,
  sourceId: string | null
): Promise<Memoire> {
  const fresh = blankMemoire(name)
  if (!sourceId) return saveMemoire(libraryPath, fresh)

  let source: Memoire
  try {
    source = await getMemoire(libraryPath, sourceId)
  } catch {
    return saveMemoire(libraryPath, fresh)
  }
  return saveMemoire(libraryPath, {
    ...fresh,
    coverPages: source.coverPages.map((c) => ({ ...c })),
    chapters: cloneChapters(source.chapters)
  })
}
