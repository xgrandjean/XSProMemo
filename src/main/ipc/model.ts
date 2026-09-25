import { app, ipcMain, shell } from 'electron'
import { promises as fs } from 'node:fs'
import { readModelConfig, writeModelConfig } from '../store/modelStore'
import { dataRoot, templatePath } from '../store/paths'
import { chooseLibraryFolder, probeFolder, useDefaultLibrary } from '../store/library'
import { dismissGabaritUpdate, restoreDefaultTemplate } from '../store/seed'
import { previewStyles } from '../render/previewStyles'
import { requireLibraryPath } from './context'
import type { LibrarySetupMode, ModelStatus } from '../../shared/types'

async function buildStatus(root: string): Promise<ModelStatus> {
  const template = templatePath(root)
  let templateExists = true
  try {
    await fs.access(template)
  } catch {
    templateExists = false
  }
  const config = await readModelConfig(root)
  return {
    config,
    dataFolder: root,
    templatePath: template,
    templateExists,
    library: { path: root, isDefault: root === dataRoot() },
    gabaritUpdateAvailable: config.gabaritVersion !== app.getVersion()
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

  ipcMain.handle('model:setAiInstructions', async (_event, aiInstructions: string) => {
    const root = await requireLibraryPath()
    const config = await readModelConfig(root)
    config.aiInstructions = aiInstructions
    await writeModelConfig(root, config)
    return buildStatus(root)
  })

  ipcMain.handle('model:openTemplate', async () => {
    const error = await shell.openPath(templatePath(await requireLibraryPath()))
    if (error) throw new Error(error)
  })

  ipcMain.handle('model:previewStyles', async () => {
    const outputPath = await previewStyles(await requireLibraryPath())
    const error = await shell.openPath(outputPath)
    if (error) throw new Error(error)
  })

  ipcMain.handle('model:applyGabaritUpdate', async () => {
    const root = await requireLibraryPath()
    await restoreDefaultTemplate(root)
    return buildStatus(root)
  })

  ipcMain.handle('model:dismissGabaritUpdate', async () => {
    const root = await requireLibraryPath()
    await dismissGabaritUpdate(root)
    return buildStatus(root)
  })

  /** Shortcut to the folder holding the template, the contents and the documents. */
  ipcMain.handle('model:openDataFolder', async () => {
    const error = await shell.openPath(await requireLibraryPath())
    if (error) throw new Error(error)
  })

  ipcMain.handle('model:probeLibraryFolder', async (_event, target: string) => probeFolder(target))

  /**
   * Le verrou d'instance unique est rendu avant de relancer : sans cela la nouvelle
   * instance peut démarrer avant que celle-ci ait fini de s'éteindre, se voir refuser le
   * verrou, et se tuer — l'application ne reviendrait jamais, juste après un geste qui
   * vient de réécrire les réglages du poste. Sans effet si le verrou n'est pas détenu.
   */
  function relaunch(): void {
    app.releaseSingleInstanceLock()
    app.relaunch()
    app.exit(0)
  }

  // Switching library ends the session: too many screens (the mémoires list, an open
  // editor) hold state tied to the old folder to carry on safely without a fresh start.
  ipcMain.handle(
    'model:chooseLibraryFolder',
    async (_event, input: { target: string; mode: LibrarySetupMode }) => {
      await chooseLibraryFolder(input.target, input.mode)
      relaunch()
    }
  )

  ipcMain.handle('model:useDefaultLibrary', async () => {
    await useDefaultLibrary()
    relaunch()
  })
}
