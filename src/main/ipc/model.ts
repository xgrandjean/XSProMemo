import { ipcMain } from 'electron'
import { readModelConfig, writeModelConfig } from '../store/modelStore'
import { createMemoireFrom } from '../store/memoireStore'
import { requireLibraryPath } from './context'

export function registerModelIpc(): void {
  ipcMain.handle('model:get', async () => {
    const libraryPath = await requireLibraryPath()
    return readModelConfig(libraryPath)
  })

  ipcMain.handle('model:setTemplate', async (_event, templateAbsPath: string) => {
    const libraryPath = await requireLibraryPath()
    const config = await readModelConfig(libraryPath)
    config.templatePath = templateAbsPath
    await writeModelConfig(libraryPath, config)
    return config
  })

  ipcMain.handle('model:setSommaireTitle', async (_event, title: string) => {
    const libraryPath = await requireLibraryPath()
    const config = await readModelConfig(libraryPath)
    config.sommaireTitle = title.trim() || 'Sommaire'
    await writeModelConfig(libraryPath, config)
    return config
  })

  /** Lazily creates the example mémoire the first time the config screen needs it. */
  ipcMain.handle('model:ensureExample', async () => {
    const libraryPath = await requireLibraryPath()
    const config = await readModelConfig(libraryPath)
    if (config.exampleId) return config.exampleId
    const example = await createMemoireFrom(libraryPath, 'Exemple', null)
    config.exampleId = example.id
    await writeModelConfig(libraryPath, config)
    return example.id
  })
}
