import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { configJsonPath, dataRoot, memoiresDir, templatePath } from './paths'
import { resolveLibraryPath, writeSettings } from './settings'
import { seedIfNeeded } from './seed'
import { readAllMemoires } from './memoireStore'
import { exportMemoire, importMemoire } from './memoireTransfer'
import type { FolderProbeResult, LibrarySetupMode } from '../../shared/types'

/**
 * What choosing `target` as the working folder would mean, before actually doing it: a
 * folder with nothing in it is fair game (it gets set up, see `ensureLibraryAt`) ; one that
 * already has a `memoires` folder is an existing working folder, joined as-is — not
 * `config.json`, which stays absent until something actually changes a setting, on a fresh
 * folder as much as a long-used one ; anything else is refused outright rather than risking
 * a merge into an unrelated folder.
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

async function copyIfPresent(source: string, target: string): Promise<void> {
  try {
    await fs.copyFile(source, target)
  } catch {
    // Nothing there to carry over — a folder with no gabarit or no settings yet.
  }
}

/**
 * Sets up an empty folder with this machine's own starting point: the gabarit, the settings
 * (sommaire title, AI notes, gabarit version) and every modèle — but none of the mémoires
 * being worked on, and none of the generated documents. What you need to start working
 * somewhere else, not a move.
 *
 * Each modèle travels through the .zip export/import already used by the Exporter/Importer
 * buttons rather than a hand-written copy: that pair already carries a mémoire's contents
 * *and* its logos, already gives the copy its own content folder — isolating, on the way, a
 * modèle whose references still point at the old shared pool — and already keeps
 * `isTemplate`. Re-deriving all of that here would only be a worse version of it.
 */
async function copyStarterInto(source: string, target: string): Promise<void> {
  await fs.mkdir(target, { recursive: true })
  await copyIfPresent(templatePath(source), templatePath(target))
  await copyIfPresent(configJsonPath(source), configJsonPath(target))

  for (const memoire of await readAllMemoires(source)) {
    if (!memoire.isTemplate) continue
    const transit = path.join(os.tmpdir(), `xspromemo-modele-${randomUUID()}.zip`)
    try {
      await exportMemoire(source, memoire.id, transit)
      await importMemoire(target, transit)
    } finally {
      await fs.rm(transit, { force: true })
    }
  }
}

/** Makes `target` usable as a working folder — populating it first if it is genuinely empty. */
async function ensureLibraryAt(target: string, mode: LibrarySetupMode): Promise<void> {
  const probe = await probeFolder(target)

  if (probe === 'nonEmptyOther') {
    throw new Error(
      `Ce dossier contient déjà autre chose et ne ressemble pas à un dossier de travail ` +
        `XSProMemo (pas de dossier "memoires") : ${target}`
    )
  }

  // 'fresh' leaves the folder untouched on purpose: the `seedIfNeeded` at the end of
  // `chooseLibraryFolder` then fills it exactly as a brand new installation would.
  if (probe === 'empty' && mode === 'templates') {
    const source = await resolveLibraryPath()
    if (path.resolve(source).toLowerCase() !== target.toLowerCase()) {
      await copyStarterInto(source, target)
    }
  }
}

/**
 * Points this machine at `target` — another local folder, or a shared network folder.
 * Safe either way: the machine's settings are only updated once any necessary copy has
 * fully succeeded, so a crash mid-copy never leaves it pointing at a half-populated
 * folder.
 */
export async function chooseLibraryFolder(
  target: string,
  mode: LibrarySetupMode
): Promise<void> {
  const resolvedTarget = path.resolve(target)
  await ensureLibraryAt(resolvedTarget, mode)
  await writeSettings({ libraryPath: resolvedTarget })
  await seedIfNeeded(resolvedTarget)
}

/**
 * Back to the local default. Recorded as `null` rather than the resolved path itself, so
 * it keeps floating with whatever the default actually is instead of freezing today's.
 * No window to ask in, so it takes the answer that loses nothing: the machine's own
 * gabarit and modèles come along.
 */
export async function useDefaultLibrary(): Promise<void> {
  const target = dataRoot()
  await ensureLibraryAt(target, 'templates')
  await writeSettings({ libraryPath: null })
  await seedIfNeeded(target)
}
