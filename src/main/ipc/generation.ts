import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { generateMemoire } from '../render/generate'
import { requireLibraryPath } from './context'

export function registerGenerationIpc(): void {
  ipcMain.handle('generation:run', async (event: IpcMainInvokeEvent, memoireId: string) => {
    const libraryPath = await requireLibraryPath()
    return generateMemoire(libraryPath, memoireId, (message) => {
      event.sender.send('generation:progress', { memoireId, message })
    })
  })
}
