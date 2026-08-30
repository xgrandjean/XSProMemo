import { ipcMain, dialog, BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import path from 'node:path'
import { readAppConfig, writeAppConfig } from '../store/appConfig'
import { ensureLibraryLayout } from '../store/modelStore'

export function registerConfigIpc(): void {
  ipcMain.handle('config:get', async () => readAppConfig())

  ipcMain.handle('config:chooseWorkspaceFolder', async (event: IpcMainInvokeEvent) => {
    const options: Electron.OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choisir le dossier de travail XSProMemo'
    }
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await (win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options))
    if (result.canceled || result.filePaths.length === 0) return null

    const libraryPath = path.join(result.filePaths[0], 'library')
    await ensureLibraryLayout(libraryPath)
    const config = { libraryPath }
    await writeAppConfig(config)
    return config
  })
}
