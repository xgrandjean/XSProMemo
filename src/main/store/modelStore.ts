import { promises as fs } from 'node:fs'
import path from 'node:path'
import { configJsonPath, storeContentBytes, writeJsonAtomic } from './paths'
import type { ContentRef, ModelConfig } from '../../shared/types'

const defaultModelConfig: ModelConfig = {
  sommaireTitle: 'Sommaire',
  aiInstructions: '',
  gabaritVersion: ''
}

export async function readModelConfig(root: string): Promise<ModelConfig> {
  try {
    const stored = JSON.parse(await fs.readFile(configJsonPath(root), 'utf-8'))
    // Only known keys survive, so settings from earlier versions do not linger.
    return {
      sommaireTitle: stored.sommaireTitle ?? defaultModelConfig.sommaireTitle,
      aiInstructions: stored.aiInstructions ?? defaultModelConfig.aiInstructions,
      gabaritVersion: stored.gabaritVersion ?? defaultModelConfig.gabaritVersion
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
 * can be browsed and its files replaced by hand. A name already in the pool is reused
 * as-is only if its bytes match (picking the file already there is a normal thing to do);
 * otherwise a numbered suffix is used, since two chapters (in the same mémoire or in two
 * different ones) can share a title without their content being the same file.
 */
export async function importContent(root: string, srcAbsPath: string): Promise<ContentRef> {
  if (path.extname(srcAbsPath).toLowerCase() !== '.docx') {
    throw new Error('Seuls les fichiers Word (.docx) peuvent servir de contenu.')
  }

  const base = path.basename(srcAbsPath, '.docx').replace(/[\/:*?"<>|]/g, '-').trim() || 'contenu'
  const originalName = `${base}.docx`
  const bytes = await fs.readFile(srcAbsPath)
  const fileName = await storeContentBytes(root, originalName, bytes)
  return { file: fileName, originalName }
}
