import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { assetsDir, configJsonPath, memoiresDir, outputDir, writeJsonAtomic } from './paths'
import type { ContentRef, ModelConfig } from '../../shared/types'

const defaultModelConfig: ModelConfig = {
  templatePath: null,
  sommaireTitle: 'Sommaire',
  exampleId: null
}

export async function ensureLibraryLayout(libraryPath: string): Promise<void> {
  await fs.mkdir(assetsDir(libraryPath), { recursive: true })
  await fs.mkdir(memoiresDir(libraryPath), { recursive: true })
  await fs.mkdir(outputDir(libraryPath), { recursive: true })
  try {
    await fs.access(configJsonPath(libraryPath))
  } catch {
    await writeModelConfig(libraryPath, defaultModelConfig)
  }
}

export async function readModelConfig(libraryPath: string): Promise<ModelConfig> {
  try {
    const raw = await fs.readFile(configJsonPath(libraryPath), 'utf-8')
    return { ...defaultModelConfig, ...JSON.parse(raw) }
  } catch {
    return { ...defaultModelConfig }
  }
}

export async function writeModelConfig(libraryPath: string, config: ModelConfig): Promise<void> {
  await writeJsonAtomic(configJsonPath(libraryPath), config)
}

/**
 * Copies a content file into library/assets under a generated name, so later renames or
 * moves of the user's original can never break a mémoire. Assets are shared: several
 * mémoires may point at the same file, so removing a chapter never deletes it.
 */
export async function importAsset(libraryPath: string, srcAbsPath: string): Promise<ContentRef> {
  if (path.extname(srcAbsPath).toLowerCase() !== '.docx') {
    throw new Error('Seuls les fichiers Word (.docx) peuvent servir de contenu.')
  }
  const destName = `${randomUUID()}.docx`
  await fs.mkdir(assetsDir(libraryPath), { recursive: true })
  await fs.copyFile(srcAbsPath, path.join(assetsDir(libraryPath), destName))
  return { file: `assets/${destName}`, originalName: path.basename(srcAbsPath) }
}
