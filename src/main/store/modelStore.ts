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
  const fileName = `${base}.docx`

  // The pool is keyed by file name: importing under a name already there updates that
  // file rather than piling up "(2)", "(3)"... Designating the file already in the
  // pool is a normal thing to do, and must not copy it onto itself.
  const source = path.resolve(srcAbsPath)
  const destination = path.join(directory, fileName)
  if (path.resolve(destination).toLowerCase() !== source.toLowerCase()) {
    const staged = `${destination}.nouveau`
    await fs.copyFile(source, staged)
    await fs.rename(staged, destination)
  }
  return { file: fileName, originalName: fileName }
}
