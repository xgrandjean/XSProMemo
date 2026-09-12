import { ipcMain, dialog, BrowserWindow, shell, type IpcMainInvokeEvent } from 'electron'

function openFileDialog(
  event: IpcMainInvokeEvent,
  options: Electron.OpenDialogOptions
): Promise<Electron.OpenDialogReturnValue> {
  const win = BrowserWindow.fromWebContents(event.sender)
  return win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options)
}

function saveFileDialog(
  event: IpcMainInvokeEvent,
  options: Electron.SaveDialogOptions
): Promise<Electron.SaveDialogReturnValue> {
  const win = BrowserWindow.fromWebContents(event.sender)
  return win ? dialog.showSaveDialog(win, options) : dialog.showSaveDialog(options)
}

export function registerDialogIpc(): void {
  // Content is Word only: the mémoire is assembled as a single Word document.
  ipcMain.handle('dialog:pickDocx', async (event) => {
    const result = await openFileDialog(event, {
      properties: ['openFile'],
      filters: [{ name: 'Documents Word', extensions: ['docx'] }]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:pickImage', async (event) => {
    const result = await openFileDialog(event, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tif', 'tiff'] }]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:pickFolder', async (event) => {
    const result = await openFileDialog(event, {
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:pickZip', async (event) => {
    const result = await openFileDialog(event, {
      properties: ['openFile'],
      filters: [{ name: 'Mémoire XSProMemo', extensions: ['zip'] }]
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:pickSaveZip', async (event, defaultName: string) => {
    const result = await saveFileDialog(event, {
      defaultPath: defaultName,
      filters: [{ name: 'Mémoire XSProMemo', extensions: ['zip'] }]
    })
    return result.canceled ? null : (result.filePath ?? null)
  })

  ipcMain.handle('shell:openPath', async (_event, absPath: string) => {
    const error = await shell.openPath(absPath)
    if (error) throw new Error(error)
  })
}
