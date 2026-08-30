import { ipcMain, shell } from 'electron'
import {
  listMemoires,
  getMemoire,
  saveMemoire,
  deleteMemoire,
  createMemoireFrom
} from '../store/memoireStore'
import { readModelConfig, importContent } from '../store/modelStore'
import { resolveContentFile } from '../store/paths'
import { requireLibraryPath } from './context'
import type { Memoire } from '../../shared/types'

export function registerMemoiresIpc(): void {
  ipcMain.handle('memoires:list', async () => {
    const libraryPath = await requireLibraryPath()
    return listMemoires(libraryPath)
  })

  ipcMain.handle('memoires:get', async (_event, id: string) => {
    const libraryPath = await requireLibraryPath()
    return getMemoire(libraryPath, id)
  })

  /** New mémoires always start as a copy of the example, never from a blank page. */
  ipcMain.handle('memoires:create', async (_event, name: string) => {
    const libraryPath = await requireLibraryPath()
    const config = await readModelConfig(libraryPath)
    return createMemoireFrom(libraryPath, name, config.exampleId)
  })

  ipcMain.handle('memoires:duplicate', async (_event, input: { id: string; name: string }) => {
    const libraryPath = await requireLibraryPath()
    return createMemoireFrom(libraryPath, input.name, input.id)
  })

  ipcMain.handle('memoires:save', async (_event, memoire: Memoire) => {
    const libraryPath = await requireLibraryPath()
    return saveMemoire(libraryPath, memoire)
  })

  ipcMain.handle('memoires:delete', async (_event, id: string) => {
    const libraryPath = await requireLibraryPath()
    await deleteMemoire(libraryPath, id)
  })

  /** Copies a chosen file into the shared asset pool and returns a reference to it. */
  ipcMain.handle('memoires:importContent', async (_event, sourceAbsPath: string) => {
    const libraryPath = await requireLibraryPath()
    return importContent(libraryPath, sourceAbsPath)
  })

  /** Opens a content file in whatever application handles it (Word, a PDF reader...). */
  ipcMain.handle('memoires:openContent', async (_event, relativePath: string) => {
    const libraryPath = await requireLibraryPath()
    const error = await shell.openPath(resolveContentFile(libraryPath, relativePath))
    if (error) throw new Error(error)
  })
}
