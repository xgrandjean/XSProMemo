import { app, dialog, shell, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { generateMemoire } from './render/generate'
import { seedIfNeeded } from './store/seed'
import { requireLibraryPath } from './ipc/context'
import { registerDialogIpc } from './ipc/dialogs'
import { registerModelIpc } from './ipc/model'
import { registerMemoiresIpc } from './ipc/memoires'
import { registerGenerationIpc } from './ipc/generation'
import { registerWindowIpc, isDirty } from './ipc/window'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  // Autosave was removed in favor of an explicit "Enregistrer" button — closing the
  // window can now discard real unsaved work, so it needs the same kind of guard.
  mainWindow.on('close', (event) => {
    if (!isDirty()) return
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'warning',
      buttons: ['Quitter sans enregistrer', 'Annuler'],
      defaultId: 1,
      cancelId: 1,
      title: 'Modifications non enregistrées',
      message: 'Ce mémoire a des modifications non enregistrées.',
      detail: 'Elles seront perdues si vous fermez maintenant.'
    })
    if (choice === 1) event.preventDefault()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/**
 * Diagnostics: `electron . --generate <memoireId> [--report <file>]` runs a generation
 * through the very same code path as the Générer button and exits. Kept because Windows
 * swallows an Electron main process's stdout, which makes failures hard to see otherwise.
 */
function headlessGenerationTarget(): string | null {
  const index = process.argv.indexOf('--generate')
  return index !== -1 ? (process.argv[index + 1] ?? null) : null
}

// Rendering opens and closes hidden windows. With no main window to keep the app
// alive, closing the last of them would otherwise quit mid-generation.
const isHeadless = headlessGenerationTarget() !== null

async function runHeadlessGeneration(memoireId: string): Promise<void> {
  const reportIndex = process.argv.indexOf('--report')
  const reportPath = reportIndex !== -1 ? process.argv[reportIndex + 1] : null
  const lines: string[] = []
  const log = (line: string): void => {
    lines.push(line)
    // An unwritable report path must not become the failure: it would mask the real one
    // and, with no window to close, leave the process hanging.
    if (reportPath) {
      try {
        writeFileSync(reportPath, lines.join('\n') + '\n', 'utf-8')
      } catch {
        /* ignore */
      }
    }
  }

  try {
    const root = await requireLibraryPath()
    await seedIfNeeded(root)
    const result = await generateMemoire(root, memoireId, (message) => log(`… ${message}`))
    log(`OK ${result.pageCount} pages -> ${result.pdfPath ?? result.docxPath + ' (pas de PDF)'}`)
    result.warnings.forEach((warning) => log(`AVERTISSEMENT ${warning}`))
    app.exit(0)
  } catch (err) {
    log('ECHEC ' + (err instanceof Error ? (err.stack ?? err.message) : String(err)))
    app.exit(1)
  }
}

// Fixes the data folder to %APPDATA%\XSProMemo rather than the package name.
app.setName('XSProMemo')

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.xspromemo.app')
  await seedIfNeeded(await requireLibraryPath())
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  const headlessTarget = headlessGenerationTarget()
  if (headlessTarget) {
    void runHeadlessGeneration(headlessTarget)
    return
  }

  registerDialogIpc()
  registerModelIpc()
  registerMemoiresIpc()
  registerGenerationIpc()
  registerWindowIpc()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (isHeadless) return
  if (process.platform !== 'darwin') app.quit()
})
