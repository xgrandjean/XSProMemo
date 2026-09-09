import { promises as fs } from 'node:fs'
import path from 'node:path'
import { dataRoot, memoiresDir } from './paths'
import { resolveLibraryPath, writeSettings } from './settings'
import { seedIfNeeded } from './seed'
import type { FolderProbeResult } from '../../shared/types'

/**
 * What choosing `target` as the library would mean, before actually doing it: a folder
 * with nothing in it is fair game (the current library gets copied into it) ; one that
 * already has a `memoires` folder is another machine's shared library, joined as-is —
 * not `config.json`, which stays absent until something actually changes a setting, on a
 * fresh library as much as a long-used one ; anything else is refused outright rather
 * than risking a merge into an unrelated folder.
 */
export async function probeFolder(target: string): Promise<FolderProbeResult> {
  let entries: string[]
  try {
    entries = await fs.readdir(target)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return 'empty'
    throw err
  }
  if (entries.length === 0) return 'empty'
  if (entries.includes(path.basename(memoiresDir(target)))) return 'existingLibrary'
  return 'nonEmptyOther'
}

/** First machine to share a library: copy what it already has into the new folder. */
async function copyLibraryInto(source: string, target: string): Promise<void> {
  await fs.mkdir(target, { recursive: true })
  await fs.cp(source, target, { recursive: true })
}

/** Makes `target` usable as a library — populating it first if it is genuinely empty. */
async function ensureLibraryAt(target: string): Promise<void> {
  const probe = await probeFolder(target)

  if (probe === 'nonEmptyOther') {
    throw new Error(
      `Ce dossier contient déjà autre chose et ne ressemble pas à une bibliothèque ` +
        `XSProMemo (pas de dossier "memoires") : ${target}`
    )
  }

  if (probe === 'empty') {
    const source = await resolveLibraryPath()
    if (path.resolve(source).toLowerCase() !== target.toLowerCase()) {
      await copyLibraryInto(source, target)
    }
  }
}

/**
 * Points this machine at `target` — another local folder, or a shared network folder.
 * Safe either way: the machine's settings are only updated once any necessary copy has
 * fully succeeded, so a crash mid-copy never leaves it pointing at a half-populated
 * folder.
 */
export async function chooseLibraryFolder(target: string): Promise<void> {
  const resolvedTarget = path.resolve(target)
  await ensureLibraryAt(resolvedTarget)
  await writeSettings({ libraryPath: resolvedTarget })
  await seedIfNeeded(resolvedTarget)
}

/**
 * Back to the local default. Recorded as `null` rather than the resolved path itself, so
 * it keeps floating with whatever the default actually is instead of freezing today's.
 */
export async function useDefaultLibrary(): Promise<void> {
  const target = dataRoot()
  await ensureLibraryAt(target)
  await writeSettings({ libraryPath: null })
  await seedIfNeeded(target)
}
