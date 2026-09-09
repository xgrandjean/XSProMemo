import { ipcMain } from 'electron'

// Mirrors, from the renderer, whether the open mémoire has unsaved edits — just a
// boolean, so closing the app can be guarded without the draft itself crossing this
// boundary.
let dirty = false

export function registerWindowIpc(): void {
  ipcMain.handle('app:setDirty', (_event, value: boolean) => {
    dirty = value
  })
}

export function isDirty(): boolean {
  return dirty
}
