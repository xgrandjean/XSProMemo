import { promises as fs } from 'node:fs'
import path from 'node:path'
import { logosDir } from './paths'
import { extractHeaderImage, MIME_BY_EXTENSION } from '../render/templateInspector'
import type { ContentRef, LogoField } from '../../shared/types'

/**
 * Each mémoire keeps its own logo files — up to two, `logo` (top right) and
 * `secondLogo` (top left, typically a partner's or a client's) — so changing one
 * mémoire's never reaches back into another's. This is the pool for those files, one
 * per mémoire id and slot.
 */

/** `logo` keeps the file name it always had (`<id>.<ext>`); `secondLogo` gets a suffix,
 * so the two never collide and existing data needs no migration. */
export function prefixFor(memoireId: string, field: LogoField): string {
  return field === 'secondLogo' ? `${memoireId}-2.` : `${memoireId}.`
}

async function removeExisting(root: string, memoireId: string, field: LogoField): Promise<void> {
  const dir = logosDir(root)
  const prefix = prefixFor(memoireId, field)
  const entries = await fs.readdir(dir).catch(() => [] as string[])
  for (const entry of entries) {
    if (entry.startsWith(prefix)) await fs.rm(path.join(dir, entry), { force: true })
  }
}

/** Copies the chosen image into this mémoire's own slot. */
export async function setMemoireLogo(
  root: string,
  memoireId: string,
  field: LogoField,
  sourceAbsPath: string
): Promise<ContentRef> {
  await fs.mkdir(logosDir(root), { recursive: true })
  await removeExisting(root, memoireId, field)
  const ext = path.extname(sourceAbsPath).toLowerCase() || '.png'
  const fileName = `${prefixFor(memoireId, field)}${ext.slice(1)}`
  await fs.copyFile(sourceAbsPath, path.join(logosDir(root), fileName))
  return { file: fileName, originalName: path.basename(sourceAbsPath) }
}

export async function clearMemoireLogo(
  root: string,
  memoireId: string,
  field: LogoField
): Promise<void> {
  await removeExisting(root, memoireId, field)
}

/** Used when duplicating a mémoire, or creating one from the example: same picture. */
export async function copyMemoireLogo(
  root: string,
  fromLogo: ContentRef | null,
  field: LogoField,
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
  const fileName = `${prefixFor(toMemoireId, field)}${ext.slice(1)}`
  await fs.copyFile(source, path.join(logosDir(root), fileName))
  return { file: fileName, originalName: fromLogo.originalName }
}

/**
 * Snapshots the picture found in a template's header as this mémoire's own (primary)
 * logo — used to recover one from before each mémoire kept its own. There is nothing
 * to recover a second logo from: that slot is new, no old document ever carried one.
 */
export async function snapshotLogoFromTemplate(
  root: string,
  memoireId: string,
  templateAbsPath: string
): Promise<ContentRef | null> {
  const found = await extractHeaderImage(templateAbsPath)
  if (!found) return null
  await fs.mkdir(logosDir(root), { recursive: true })
  const fileName = `${prefixFor(memoireId, 'logo')}${found.ext.slice(1)}`
  await fs.writeFile(path.join(logosDir(root), fileName), found.bytes)
  return { file: fileName, originalName: `Logo${found.ext}` }
}

/** One of the mémoire's logos, as a data URL, for its plan screen. */
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
