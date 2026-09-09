import { app, ipcMain, shell } from 'electron'
import { promises as fs } from 'node:fs'
import { readModelConfig, writeModelConfig } from '../store/modelStore'
import { dataRoot, templatePath } from '../store/paths'
import { chooseLibraryFolder, probeFolder, useDefaultLibrary } from '../store/library'
import { requireLibraryPath } from './context'
import type { ModelStatus } from '../../shared/types'

async function buildStatus(root: string): Promise<ModelStatus> {
  const template = templatePath(root)
  let templateExists = true
  try {
    await fs.access(template)
  } catch {
    templateExists = false
  }
  return {
    config: await readModelConfig(root),
    dataFolder: root,
    templatePath: template,
    templateExists,
    library: { path: root, isDefault: root === dataRoot() }
  }
}

export function registerModelIpc(): void {
  ipcMain.handle('model:get', async () => buildStatus(await requireLibraryPath()))

  ipcMain.handle('model:setSommaireTitle', async (_event, title: string) => {
    const root = await requireLibraryPath()
    const config = await readModelConfig(root)
    config.sommaireTitle = title.trim() || 'Sommaire'
    await writeModelConfig(root, config)
    return buildStatus(root)
  })

  ipcMain.handle('model:openTemplate', async () => {
    const error = await shell.openPath(templatePath(await requireLibraryPath()))
    if (error) throw new Error(error)
  })

  /** Shortcut to the folder holding the template, the contents and the documents. */
  ipcMain.handle('model:openDataFolder', async () => {
    const error = await shell.openPath(await requireLibraryPath())
    if (error) throw new Error(error)
  })

  ipcMain.handle('model:probeLibraryFolder', async (_event, target: string) => probeFolder(target))

  // Switching library ends the session: too many screens (the mémoires list, an open
  // editor) hold state tied to the old folder to carry on safely without a fresh start.
  ipcMain.handle('model:chooseLibraryFolder', async (_event, target: string) => {
    await chooseLibraryFolder(target)
    app.relaunch()
    app.exit(0)
  })

  ipcMain.handle('model:useDefaultLibrary', async () => {
    await useDefaultLibrary()
    app.relaunch()
    app.exit(0)
  })
}
