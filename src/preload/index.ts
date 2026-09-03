import { contextBridge, ipcRenderer } from 'electron'
import type {
  ContentRef,
  GenerationProgressEvent,
  GenerationResult,
  LogoField,
  Memoire,
  MemoireSummary,
  ModelStatus
} from '../shared/types'

const api = {
  dialogs: {
    pickDocx: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickDocx'),
    pickImage: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickImage')
  },
  shell: {
    openPath: (absPath: string): Promise<void> => ipcRenderer.invoke('shell:openPath', absPath)
  },
  model: {
    get: (): Promise<ModelStatus> => ipcRenderer.invoke('model:get'),
    setSommaireTitle: (title: string): Promise<ModelStatus> =>
      ipcRenderer.invoke('model:setSommaireTitle', title),
    openTemplate: (): Promise<void> => ipcRenderer.invoke('model:openTemplate'),
    openDataFolder: (): Promise<void> => ipcRenderer.invoke('model:openDataFolder'),
    ensureExample: (): Promise<string> => ipcRenderer.invoke('model:ensureExample')
  },
  memoires: {
    list: (): Promise<MemoireSummary[]> => ipcRenderer.invoke('memoires:list'),
    get: (id: string): Promise<Memoire> => ipcRenderer.invoke('memoires:get', id),
    create: (name: string): Promise<Memoire> => ipcRenderer.invoke('memoires:create', name),
    duplicate: (id: string, name: string): Promise<Memoire> =>
      ipcRenderer.invoke('memoires:duplicate', { id, name }),
    save: (memoire: Memoire): Promise<Memoire> => ipcRenderer.invoke('memoires:save', memoire),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('memoires:delete', id),
    importContent: (sourceAbsPath: string): Promise<ContentRef> =>
      ipcRenderer.invoke('memoires:importContent', sourceAbsPath),
    openContent: (relativePath: string): Promise<void> =>
      ipcRenderer.invoke('memoires:openContent', relativePath),
    setLogo: (id: string, field: LogoField, imageAbsPath: string): Promise<Memoire> =>
      ipcRenderer.invoke('memoires:setLogo', { id, field, imageAbsPath }),
    clearLogo: (id: string, field: LogoField): Promise<Memoire> =>
      ipcRenderer.invoke('memoires:clearLogo', { id, field }),
    logoPreview: (id: string, field: LogoField): Promise<string | null> =>
      ipcRenderer.invoke('memoires:logoPreview', { id, field })
  },
  generation: {
    run: (memoireId: string): Promise<GenerationResult> =>
      ipcRenderer.invoke('generation:run', memoireId),
    onProgress: (callback: (event: GenerationProgressEvent) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, payload: GenerationProgressEvent): void =>
        callback(payload)
      ipcRenderer.on('generation:progress', listener)
      return () => ipcRenderer.removeListener('generation:progress', listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
