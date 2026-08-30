import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppConfig,
  ContentRef,
  GenerationProgressEvent,
  GenerationResult,
  Memoire,
  MemoireSummary,
  ModelConfig
} from '../shared/types'

const api = {
  config: {
    get: (): Promise<AppConfig> => ipcRenderer.invoke('config:get'),
    chooseWorkspaceFolder: (): Promise<AppConfig | null> =>
      ipcRenderer.invoke('config:chooseWorkspaceFolder')
  },
  dialogs: {
    pickDocx: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickDocx')
  },
  shell: {
    openPath: (absPath: string): Promise<void> => ipcRenderer.invoke('shell:openPath', absPath)
  },
  model: {
    get: (): Promise<ModelConfig> => ipcRenderer.invoke('model:get'),
    setTemplate: (templateAbsPath: string): Promise<ModelConfig> =>
      ipcRenderer.invoke('model:setTemplate', templateAbsPath),
    setSommaireTitle: (title: string): Promise<ModelConfig> =>
      ipcRenderer.invoke('model:setSommaireTitle', title),
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
      ipcRenderer.invoke('memoires:openContent', relativePath)
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
