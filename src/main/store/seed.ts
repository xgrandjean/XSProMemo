import { app } from 'electron'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { contentsDir, dataRoot, documentsDir, memoiresDir, templatePath, writeJsonAtomic } from './paths'
import { readModelConfig, writeModelConfig } from './modelStore'
import { setMemoireLogo } from './logoStore'
import type { ChapterNode, ContentRef, Memoire } from '../../shared/types'

interface SeedNode {
  title: string
  pageBreakBefore: boolean
  orientation: 'portrait' | 'paysage'
  content: ContentRef | null
  children: SeedNode[]
}

function shippedDir(): string {
  const root = app.isPackaged ? process.resourcesPath : path.join(app.getAppPath(), 'resources')
  return path.join(root, 'exemple')
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
 * Puts back any shipped content file that has gone missing, leaving everything else
 * alone. Without this, emptying the contents folder produced a document made of titles
 * with no text — and the application reported success.
 */
async function restoreMissingContents(fromDir: string, toDir: string): Promise<void> {
  await fs.mkdir(toDir, { recursive: true })
  let shippedFiles: string[]
  try {
    shippedFiles = await fs.readdir(fromDir)
  } catch {
    return
  }
  for (const entry of shippedFiles) {
    const destination = path.join(toDir, entry)
    if (await exists(destination)) continue
    await fs.copyFile(path.join(fromDir, entry), destination)
  }
}

function withIds(nodes: SeedNode[]): ChapterNode[] {
  return nodes.map((node) => ({
    id: randomUUID(),
    title: node.title,
    pageBreakBefore: node.pageBreakBefore,
    orientation: node.orientation,
    content: node.content,
    children: withIds(node.children)
  }))
}

/**
 * On first launch the application installs itself: template, example content files and
 * a complete example mémoire. Someone who has just installed it can generate a document
 * straight away, without preparing anything.
 */
export async function seedIfNeeded(): Promise<void> {
  const root = dataRoot()
  await fs.mkdir(contentsDir(root), { recursive: true })
  await fs.mkdir(memoiresDir(root), { recursive: true })
  await fs.mkdir(documentsDir(root), { recursive: true })

  const shipped = shippedDir()
  const config = await readModelConfig(root)

  if (!(await exists(templatePath(root)))) {
    const source = path.join(shipped, 'Gabarit.docx')
    if (await exists(source)) await fs.copyFile(source, templatePath(root))
  }

  await restoreMissingContents(path.join(shipped, 'contenus'), contentsDir(root))

  // The example is installed once; later launches leave the user's edits alone. But a
  // recorded example whose plan has been deleted is a dangling reference, and new
  // mémoires copied from it would come out empty — so it is rebuilt.
  if (config.exampleId) {
    const recorded = path.join(memoiresDir(root), `${config.exampleId}.json`)
    if (await exists(recorded)) return
  }

  const planPath = path.join(shipped, 'exemple.json')
  if (!(await exists(planPath))) return

  const plan = JSON.parse(await fs.readFile(planPath, 'utf-8')) as {
    name: string
    coverPages: ContentRef[]
    chapters: SeedNode[]
  }

  const now = new Date().toISOString()
  const exampleId = randomUUID()
  const shippedLogo = path.join(shipped, 'Logo.png')
  const example: Memoire = {
    id: exampleId,
    name: plan.name || 'Exemple',
    createdAt: now,
    updatedAt: now,
    coverPages: plan.coverPages,
    chapters: withIds(plan.chapters),
    logo: (await exists(shippedLogo)) ? await setMemoireLogo(root, exampleId, shippedLogo) : null,
    lastGeneratedAt: null,
    outputDocx: null,
    outputPdf: null
  }

  await writeJsonAtomic(path.join(memoiresDir(root), `${example.id}.json`), example)
  await writeModelConfig(root, { ...config, exampleId: example.id })
}
