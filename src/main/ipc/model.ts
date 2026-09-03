import { ipcMain, shell } from 'electron'
import { promises as fs } from 'node:fs'
import { readModelConfig, writeModelConfig } from '../store/modelStore'
import { createMemoireFrom } from '../store/memoireStore'
import { dataRoot, templatePath } from '../store/paths'
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
    templateExists
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
    const error = await shell.openPath(dataRoot())
    if (error) throw new Error(error)
  })

  ipcMain.handle('model:ensureExample', async () => {
    const root = await requireLibraryPath()
    const config = await readModelConfig(root)
    if (config.exampleId) return config.exampleId
    const example = await createMemoireFrom(root, 'Exemple', null)
    await writeModelConfig(root, { ...config, exampleId: example.id })
    return example.id
  })
}
