import { app } from 'electron'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import {
  configJsonPath,
  contentsDir,
  documentsDir,
  memoiresDir,
  templatePath,
  writeJsonAtomic
} from './paths'
import { readModelConfig, writeModelConfig } from './modelStore'
import { setMemoireLogo } from './logoStore'
import { getMemoire, saveMemoire } from './memoireStore'
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
 * One-time migration from the days of a single "mémoire exemple" tracked by id in
 * config.json, to any number of mémoires simply marked `isTemplate`. Reads the config
 * file directly rather than through `readModelConfig` (which only keeps known keys, and
 * would already have dropped `exampleId`) so this only ever runs once — after this
 * mémoire is flagged and the config rewritten, the legacy key is gone for good.
 */
async function migrateLegacyExample(root: string): Promise<void> {
  let raw: { exampleId?: string }
  try {
    raw = JSON.parse(await fs.readFile(configJsonPath(root), 'utf-8'))
  } catch {
    return
  }
  if (!raw.exampleId) return

  try {
    const memoire = await getMemoire(root, raw.exampleId)
    if (!memoire.isTemplate) await saveMemoire(root, { ...memoire, isTemplate: true })
  } catch {
    // Dangling reference to an already-deleted mémoire — nothing to migrate.
  }
  // Rewritten through the known-keys allowlist: `exampleId` does not survive.
  await writeModelConfig(root, await readModelConfig(root))
}

async function hasAnyTemplate(root: string): Promise<boolean> {
  let files: string[]
  try {
    files = await fs.readdir(memoiresDir(root))
  } catch {
    return false
  }
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    try {
      const raw = await fs.readFile(path.join(memoiresDir(root), file), 'utf-8')
      const memoire: Memoire = JSON.parse(raw)
      // Same rule as memoireStore's readAllMemoires: a stray .json not named after its
      // own id (a backup, a conflicted sync copy...) is not a mémoire the app recognizes.
      if (file !== `${memoire.id}.json`) continue
      if (memoire.isTemplate) return true
    } catch {
      // skip unreadable/corrupt file
    }
  }
  return false
}

/**
 * Installs the shipped default template the first time none exists — someone who has
 * just installed the application, or just pointed it at a brand new shared folder, can
 * generate a document straight away without preparing anything.
 *
 * Guarded by an exclusive-create lock file: two machines launching against the same
 * freshly shared, empty folder at nearly the same moment must not each create their own
 * default template and race on which one "wins".
 */
async function createDefaultTemplateIfNeeded(root: string, shipped: string): Promise<void> {
  if (await hasAnyTemplate(root)) return

  const lockPath = path.join(memoiresDir(root), '.modele.lock')
  let handle
  try {
    handle = await fs.open(lockPath, 'wx')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') return
    throw err
  }

  try {
    // Another machine may have just finished while this one waited on the lock.
    if (await hasAnyTemplate(root)) return

    const planPath = path.join(shipped, 'exemple.json')
    if (!(await exists(planPath))) return

    const plan = JSON.parse(await fs.readFile(planPath, 'utf-8')) as {
      name: string
      coverPages: ContentRef[]
      chapters: SeedNode[]
    }

    const now = new Date().toISOString()
    const templateId = randomUUID()
    const shippedLogo = path.join(shipped, 'Logo.png')
    const template: Memoire = {
      id: templateId,
      name: plan.name || 'Exemple',
      createdAt: now,
      updatedAt: now,
      coverPages: plan.coverPages,
      chapters: withIds(plan.chapters),
      logo: (await exists(shippedLogo))
        ? await setMemoireLogo(root, templateId, 'logo', shippedLogo)
        : null,
      secondLogo: null,
      isTemplate: true,
      lastGeneratedAt: null,
      outputDocx: null,
      outputPdf: null
    }

    await writeJsonAtomic(path.join(memoiresDir(root), `${template.id}.json`), template)
  } finally {
    await handle.close()
    await fs.rm(lockPath, { force: true })
  }
}

/**
 * Restores the shipped example's content files if any are missing, then recreates the
 * default "Exemple" template if no modèle exists at all. The one place both the resource
 * pool and the modèle itself get put back — used at startup, and on demand whenever the
 * templates screen finds itself empty (e.g. the last modèle was just deleted), so the two
 * situations never disagree on what "the default template" is.
 */
export async function ensureDefaultTemplate(root: string): Promise<void> {
  const shipped = shippedDir()
  await restoreMissingContents(path.join(shipped, 'contenus'), contentsDir(root))
  await createDefaultTemplateIfNeeded(root, shipped)
}

/**
 * On first launch — of the application, or of a machine freshly pointed at a shared
 * folder — the library installs itself: template, example content files and a default
 * template mémoire.
 */
export async function seedIfNeeded(root: string): Promise<void> {
  await fs.mkdir(contentsDir(root), { recursive: true })
  await fs.mkdir(memoiresDir(root), { recursive: true })
  await fs.mkdir(documentsDir(root), { recursive: true })

  const shipped = shippedDir()

  if (!(await exists(templatePath(root)))) {
    const source = path.join(shipped, 'Gabarit.docx')
    if (await exists(source)) {
      await fs.copyFile(source, templatePath(root))
      // A brand new library already has the latest gabarit — never worth offering the
      // update prompt for something it was just given.
      const config = await readModelConfig(root)
      await writeModelConfig(root, { ...config, gabaritVersion: app.getVersion() })
    }
  }

  await migrateLegacyExample(root)
  await ensureDefaultTemplate(root)
}

/**
 * Replaces this library's gabarit with the one shipped in this version of the
 * application — the only way its styles/margins/footer ever change after the library's
 * first seed, since `seedIfNeeded` deliberately never overwrites an existing one. Keeps a
 * timestamped copy of what was there, since this is a real, if easily undone, overwrite.
 */
export async function restoreDefaultTemplate(root: string): Promise<void> {
  const shipped = shippedDir()
  const source = path.join(shipped, 'Gabarit.docx')
  if (!(await exists(source))) return

  if (await exists(templatePath(root))) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = path.join(path.dirname(templatePath(root)), `Gabarit.avant-restauration.${stamp}.bak.docx`)
    await fs.copyFile(templatePath(root), backupPath)
  }

  await fs.copyFile(source, templatePath(root))

  const config = await readModelConfig(root)
  await writeModelConfig(root, { ...config, gabaritVersion: app.getVersion() })
}

/** Marks this library's gabarit as up to date without touching it — the update prompt
 *  will not resurface until the app itself ships a newer version. */
export async function dismissGabaritUpdate(root: string): Promise<void> {
  const config = await readModelConfig(root)
  await writeModelConfig(root, { ...config, gabaritVersion: app.getVersion() })
}
