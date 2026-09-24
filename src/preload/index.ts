import { contextBridge, ipcRenderer } from 'electron'
import type {
  ConformiteResult,
  ContentRef,
  FolderProbeResult,
  GenerationProgressEvent,
  GenerationResult,
  LibrarySetupMode,
  LogoField,
  Memoire,
  MemoireSummary,
  ModelStatus
} from '../shared/types'

const api = {
  app: {
    setDirty: (dirty: boolean): Promise<void> => ipcRenderer.invoke('app:setDirty', dirty)
  },
  dialogs: {
    pickDocx: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickDocx'),
    pickImage: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickImage'),
    pickFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickFolder'),
    pickZip: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickZip'),
    pickSaveZip: (defaultName: string): Promise<string | null> =>
      ipcRenderer.invoke('dialog:pickSaveZip', defaultName)
  },
  shell: {
    openPath: (absPath: string): Promise<void> => ipcRenderer.invoke('shell:openPath', absPath)
  },
  model: {
    get: (): Promise<ModelStatus> => ipcRenderer.invoke('model:get'),
    setSommaireTitle: (title: string): Promise<ModelStatus> =>
      ipcRenderer.invoke('model:setSommaireTitle', title),
    setAiInstructions: (aiInstructions: string): Promise<ModelStatus> =>
      ipcRenderer.invoke('model:setAiInstructions', aiInstructions),
    openTemplate: (): Promise<void> => ipcRenderer.invoke('model:openTemplate'),
    previewStyles: (): Promise<void> => ipcRenderer.invoke('model:previewStyles'),
    applyGabaritUpdate: (): Promise<ModelStatus> => ipcRenderer.invoke('model:applyGabaritUpdate'),
    dismissGabaritUpdate: (): Promise<ModelStatus> =>
      ipcRenderer.invoke('model:dismissGabaritUpdate'),
    openDataFolder: (): Promise<void> => ipcRenderer.invoke('model:openDataFolder'),
    probeLibraryFolder: (target: string): Promise<FolderProbeResult> =>
      ipcRenderer.invoke('model:probeLibraryFolder', target),
    chooseLibraryFolder: (target: string, mode: LibrarySetupMode): Promise<void> =>
      ipcRenderer.invoke('model:chooseLibraryFolder', { target, mode }),
    useDefaultLibrary: (): Promise<void> => ipcRenderer.invoke('model:useDefaultLibrary')
  },
  memoires: {
    list: (): Promise<MemoireSummary[]> => ipcRenderer.invoke('memoires:list'),
    listTemplates: (): Promise<MemoireSummary[]> => ipcRenderer.invoke('memoires:listTemplates'),
    get: (id: string): Promise<Memoire> => ipcRenderer.invoke('memoires:get', id),
    create: (name: string, templateId: string): Promise<Memoire> =>
      ipcRenderer.invoke('memoires:create', { name, templateId }),
    duplicate: (id: string, name: string): Promise<Memoire> =>
      ipcRenderer.invoke('memoires:duplicate', { id, name }),
    saveAsTemplate: (id: string, name: string): Promise<Memoire> =>
      ipcRenderer.invoke('memoires:saveAsTemplate', { id, name }),
    save: (memoire: Memoire): Promise<Memoire> => ipcRenderer.invoke('memoires:save', memoire),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('memoires:delete', id),
    export: (id: string, destPath: string): Promise<void> =>
      ipcRenderer.invoke('memoires:export', { id, destPath }),
    import: (zipPath: string): Promise<Memoire> => ipcRenderer.invoke('memoires:import', zipPath),
    importContent: (id: string, sourceAbsPath: string): Promise<ContentRef> =>
      ipcRenderer.invoke('memoires:importContent', { id, sourceAbsPath }),
    createBlankContent: (id: string, pourChapitre?: boolean): Promise<ContentRef> =>
      ipcRenderer.invoke('memoires:createBlankContent', { id, pourChapitre }),
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
    conformer: (memoireId: string): Promise<ConformiteResult> =>
      ipcRenderer.invoke('generation:conformer', memoireId),
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
