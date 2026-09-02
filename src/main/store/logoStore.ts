import { promises as fs } from 'node:fs'
import path from 'node:path'
import { logosDir } from './paths'
import { extractHeaderImage, MIME_BY_EXTENSION } from '../render/templateInspector'
import type { ContentRef } from '../../shared/types'

/**
 * Each mémoire keeps its own logo file, so changing the default in Configuration — or
 * setting a different one for another mémoire — never reaches back into one already
 * created. This is the pool for those files, one per mémoire id.
 */

async function removeExisting(root: string, memoireId: string): Promise<void> {
  const dir = logosDir(root)
  const entries = await fs.readdir(dir).catch(() => [] as string[])
  for (const entry of entries) {
    if (entry.startsWith(`${memoireId}.`)) await fs.rm(path.join(dir, entry), { force: true })
  }
}

/** Copies the chosen image into this mémoire's own slot. */
export async function setMemoireLogo(
  root: string,
  memoireId: string,
  sourceAbsPath: string
): Promise<ContentRef> {
  await fs.mkdir(logosDir(root), { recursive: true })
  await removeExisting(root, memoireId)
  const ext = path.extname(sourceAbsPath).toLowerCase() || '.png'
  const fileName = `${memoireId}${ext}`
  await fs.copyFile(sourceAbsPath, path.join(logosDir(root), fileName))
  return { file: fileName, originalName: path.basename(sourceAbsPath) }
}

export async function clearMemoireLogo(root: string, memoireId: string): Promise<void> {
  await removeExisting(root, memoireId)
}

/** Used when duplicating a mémoire, or creating one from the example: same picture. */
export async function copyMemoireLogo(
  root: string,
  fromLogo: ContentRef | null,
  toMemoireId: string
): Promise<ContentRef | null> {
  if (!fromLogo) return null
  const source = path.join(logosDir(root), fromLogo.file)
  try {
    await fs.access(source)
  } catch {
    return null
  }
  await fs.mkdir(logosDir(root), { recursive: true })
  const ext = path.extname(fromLogo.file)
  const fileName = `${toMemoireId}${ext}`
  await fs.copyFile(source, path.join(logosDir(root), fileName))
  return { file: fileName, originalName: fromLogo.originalName }
}

/**
 * Snapshots the picture found in a template's header as this mémoire's own logo — used
 * for a brand-new mémoire (starting from the current default) and to recover one from
 * before each mémoire kept its own.
 */
export async function snapshotLogoFromTemplate(
  root: string,
  memoireId: string,
  templateAbsPath: string
): Promise<ContentRef | null> {
  const found = await extractHeaderImage(templateAbsPath)
  if (!found) return null
  await fs.mkdir(logosDir(root), { recursive: true })
  const fileName = `${memoireId}${found.ext}`
  await fs.writeFile(path.join(logosDir(root), fileName), found.bytes)
  return { file: fileName, originalName: `Logo${found.ext}` }
}

/** The mémoire's own logo, as a data URL, for its plan screen. */
export async function readMemoireLogoPreview(
  root: string,
  logo: ContentRef | null
): Promise<string | null> {
  if (!logo) return null
  try {
    const bytes = await fs.readFile(path.join(logosDir(root), logo.file))
    const mime = MIME_BY_EXTENSION[path.extname(logo.file).toLowerCase()] ?? 'image/png'
    return `data:${mime};base64,${bytes.toString('base64')}`
  } catch {
    return null
  }
}
