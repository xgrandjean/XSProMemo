import { ipcMain, shell } from 'electron'
import {
  listMemoires,
  listTemplates,
  getMemoire,
  saveMemoire,
  deleteMemoire,
  createMemoireFrom
} from '../store/memoireStore'
import { importContent } from '../store/modelStore'
import { ensureDefaultTemplate } from '../store/seed'
import { exportMemoire, importMemoire } from '../store/memoireTransfer'
import { resolveContentFile } from '../store/paths'
import { setMemoireLogo, clearMemoireLogo, readMemoireLogoPreview } from '../store/logoStore'
import { requireLibraryPath } from './context'
import type { LogoField, Memoire } from '../../shared/types'

export function registerMemoiresIpc(): void {
  ipcMain.handle('memoires:list', async () => {
    const libraryPath = await requireLibraryPath()
    return listMemoires(libraryPath)
  })

  ipcMain.handle('memoires:get', async (_event, id: string) => {
    const libraryPath = await requireLibraryPath()
    return getMemoire(libraryPath, id)
  })

  ipcMain.handle('memoires:listTemplates', async () => {
    const libraryPath = await requireLibraryPath()
    // Recreates the default "Exemple" (with its content) if the last modèle was just
    // deleted mid-session — the same repair `seedIfNeeded` does at startup, so the two
    // never disagree and leave a blank "Modèle" behind instead.
    await ensureDefaultTemplate(libraryPath)
    return listTemplates(libraryPath)
  })

  /** New mémoires always start as a copy of a chosen modèle, never from a blank page. */
  ipcMain.handle('memoires:create', async (_event, input: { name: string; templateId: string }) => {
    const libraryPath = await requireLibraryPath()
    const created = await createMemoireFrom(libraryPath, input.name, input.templateId)
    // The source is a modèle by construction; what it produces never is.
    return saveMemoire(libraryPath, { ...created, isTemplate: false })
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

  ipcMain.handle('memoires:export', async (_event, input: { id: string; destPath: string }) => {
    const libraryPath = await requireLibraryPath()
    await exportMemoire(libraryPath, input.id, input.destPath)
  })

  ipcMain.handle('memoires:import', async (_event, zipPath: string) => {
    const libraryPath = await requireLibraryPath()
    return importMemoire(libraryPath, zipPath)
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

  /**
   * One of this mémoire's own logos — independent of the shared template and of every
   * other mémoire. Changing it here never reaches back into another one.
   */
  ipcMain.handle(
    'memoires:setLogo',
    async (_event, input: { id: string; field: LogoField; imageAbsPath: string }) => {
      const libraryPath = await requireLibraryPath()
      const memoire = await getMemoire(libraryPath, input.id)
      const value = await setMemoireLogo(libraryPath, memoire.id, input.field, input.imageAbsPath)
      return saveMemoire(libraryPath, { ...memoire, [input.field]: value })
    }
  )

  ipcMain.handle('memoires:clearLogo', async (_event, input: { id: string; field: LogoField }) => {
    const libraryPath = await requireLibraryPath()
    const memoire = await getMemoire(libraryPath, input.id)
    await clearMemoireLogo(libraryPath, input.id, input.field)
    return saveMemoire(libraryPath, { ...memoire, [input.field]: null })
  })

  ipcMain.handle('memoires:logoPreview', async (_event, input: { id: string; field: LogoField }) => {
    const libraryPath = await requireLibraryPath()
    const memoire = await getMemoire(libraryPath, input.id)
    return readMemoireLogoPreview(libraryPath, memoire[input.field])
  })
}
