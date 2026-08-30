import { ipcMain, dialog, BrowserWindow, shell, type IpcMainInvokeEvent } from 'electron'

function openFileDialog(
  event: IpcMainInvokeEvent,
  options: Electron.OpenDialogOptions
): Promise<Electron.OpenDialogReturnValue> {
  const win = BrowserWindow.fromWebContents(event.sender)
  return win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options)
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

  ipcMain.handle('shell:openPath', async (_event, absPath: string) => {
    const error = await shell.openPath(absPath)
    if (error) throw new Error(error)
  })
}
