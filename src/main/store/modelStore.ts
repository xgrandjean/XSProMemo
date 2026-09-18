import { app } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { configJsonPath, storeContentFor, writeJsonAtomic } from './paths'
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
 * Copies a chosen file into the folder of the mémoire it is being attached to, keeping a
 * readable name so the folder can be browsed and its files replaced by hand. Always a copy
 * of its own: picking the same document for two mémoires gives each one its own, so
 * reworking it for this year's tender never reaches into one already submitted.
 */
export async function importContent(
  root: string,
  memoireId: string,
  srcAbsPath: string
): Promise<ContentRef> {
  if (path.extname(srcAbsPath).toLowerCase() !== '.docx') {
    throw new Error('Seuls les fichiers Word (.docx) peuvent servir de contenu.')
  }

  const base = path.basename(srcAbsPath, '.docx').replace(/[\/:*?"<>|]/g, '-').trim() || 'contenu'
  const originalName = `${base}.docx`
  const bytes = await fs.readFile(srcAbsPath)
  const file = await storeContentFor(root, memoireId, originalName, bytes)
  return { file, originalName }
}

/** An empty Word document, shipped once and copied for every "contenu vide". */
function blankContentSource(): string {
  const root = app.isPackaged ? process.resourcesPath : path.join(app.getAppPath(), 'resources')
  return path.join(root, 'ContenuVierge.docx')
}

/**
 * Starts a new content from a blank page rather than an existing file — for a chapter or
 * cover page the user wants to write directly in Word instead of attaching something
 * already prepared.
 */
export async function createBlankContent(root: string, memoireId: string): Promise<ContentRef> {
  const bytes = await fs.readFile(blankContentSource())
  const originalName = 'Nouveau contenu.docx'
  const file = await storeContentFor(root, memoireId, originalName, bytes)
  return { file, originalName }
}
