import path from 'node:path'
import { promises as fs } from 'node:fs'

export function assetsDir(libraryPath: string): string {
  return path.join(libraryPath, 'assets')
}

export function configJsonPath(libraryPath: string): string {
  return path.join(libraryPath, 'config.json')
}

export function memoiresDir(libraryPath: string): string {
  return path.join(libraryPath, '..', 'memoires')
}

export function outputDir(libraryPath: string): string {
  return path.join(libraryPath, '..', 'output')
}

export function resolveLibraryFile(libraryPath: string, relativePath: string): string {
  return path.join(libraryPath, relativePath)
}

/** Writes JSON through a temp file so a crash mid-write can't corrupt the original. */
export async function writeJsonAtomic(targetPath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  const tmp = targetPath + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf-8')
  await fs.rename(tmp, targetPath)
}
