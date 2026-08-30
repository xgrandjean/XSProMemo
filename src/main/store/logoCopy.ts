import path from 'node:path'
import { promises as fs } from 'node:fs'

const LOGO_NAME = /^Logo\.(png|jpe?g|gif|bmp|tiff?)$/i

/** The image kept beside the template, so it stays visible in the folder. */
export async function findLogoFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root).catch(() => [] as string[])
  return entries.filter((entry) => LOGO_NAME.test(entry)).map((entry) => path.join(root, entry))
}

export function samePath(a: string, b: string): boolean {
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase()
}

/**
 * Keeps a single copy of the chosen image as `Logo.<ext>` and returns its path.
 *
 * Picking the copy that is already there is a normal thing to do — and used to delete
 * the source before copying it onto itself. Nothing is removed until the new copy is
 * in place, and never the file we are copying from.
 */
export async function keepLogoCopy(root: string, sourceAbsPath: string): Promise<string> {
  const source = path.resolve(sourceAbsPath)
  const kept = path.join(root, `Logo${path.extname(source).toLowerCase() || '.png'}`)

  if (!samePath(source, kept)) {
    const staged = `${kept}.nouveau`
    await fs.copyFile(source, staged)
    await fs.rename(staged, kept)
  }

  for (const other of await findLogoFiles(root)) {
    if (!samePath(other, kept) && !samePath(other, source)) {
      await fs.rm(other, { force: true })
    }
  }
  return kept
}

export async function removeLogoCopies(root: string): Promise<void> {
  for (const previous of await findLogoFiles(root)) {
    await fs.rm(previous, { force: true })
  }
}
