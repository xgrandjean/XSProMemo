import { promises as fs } from 'node:fs'
import path from 'node:path'
import { configJsonPath, contentsDir, writeJsonAtomic } from './paths'
import type { ContentRef, ModelConfig } from '../../shared/types'

const defaultModelConfig: ModelConfig = {
  sommaireTitle: 'Sommaire',
  exampleId: null
}

export async function readModelConfig(root: string): Promise<ModelConfig> {
  try {
    const stored = JSON.parse(await fs.readFile(configJsonPath(root), 'utf-8'))
    // Only known keys survive, so settings from earlier versions do not linger.
    return {
      sommaireTitle: stored.sommaireTitle ?? defaultModelConfig.sommaireTitle,
      exampleId: stored.exampleId ?? defaultModelConfig.exampleId
    }
  } catch {
    return { ...defaultModelConfig }
  }
}

export async function writeModelConfig(root: string, config: ModelConfig): Promise<void> {
  await writeJsonAtomic(configJsonPath(root), config)
}

/**
 * Copies a content file into the contents folder, keeping a readable name so the folder
 * can be browsed and its files replaced by hand. A clashing name gets a numeric suffix
 * rather than overwriting someone else's content.
 */
export async function importContent(root: string, srcAbsPath: string): Promise<ContentRef> {
  if (path.extname(srcAbsPath).toLowerCase() !== '.docx') {
    throw new Error('Seuls les fichiers Word (.docx) peuvent servir de contenu.')
  }
  const directory = contentsDir(root)
  await fs.mkdir(directory, { recursive: true })

  const base = path.basename(srcAbsPath, '.docx').replace(/[\/:*?"<>|]/g, '-').trim() || 'contenu'
  const existing = new Set((await fs.readdir(directory)).map((name) => name.toLowerCase()))

  let fileName = `${base}.docx`
  let counter = 2
  while (existing.has(fileName.toLowerCase())) fileName = `${base} (${counter++}).docx`

  await fs.copyFile(srcAbsPath, path.join(directory, fileName))
  return { file: fileName, originalName: fileName }
}
