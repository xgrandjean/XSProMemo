import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { generateMemoire } from '../render/generate'
import { conformerContenus } from '../render/conformer'
import { requireLibraryPath } from './context'

export function registerGenerationIpc(): void {
  ipcMain.handle('generation:run', async (event: IpcMainInvokeEvent, memoireId: string) => {
    const libraryPath = await requireLibraryPath()
    return generateMemoire(libraryPath, memoireId, (message) => {
      event.sender.send('generation:progress', { memoireId, message })
    })
  })

  /** Remet les fichiers de contenu d'un mémoire au format de la page finale. */
  ipcMain.handle('generation:conformer', async (event: IpcMainInvokeEvent, memoireId: string) => {
    const libraryPath = await requireLibraryPath()
    return conformerContenus(libraryPath, memoireId, (message) => {
      event.sender.send('generation:progress', { memoireId, message })
    })
  })
}
