import { ipcMain, shell } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readModelConfig, writeModelConfig } from '../store/modelStore'
import { createMemoireFrom } from '../store/memoireStore'
import { dataRoot, templatePath } from '../store/paths'
import { getScriptPath } from '../render/wordRunner'
import { requireLibraryPath } from './context'
import { readHeaderImage } from '../render/templateInspector'
import type { ModelStatus } from '../../shared/types'

const execFileAsync = promisify(execFile)

async function runLogoScript(template: string, logoPath: string | null): Promise<void> {
  const args = [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    getScriptPath('SetLogo.ps1'),
    '-TemplatePath',
    template
  ]
  if (logoPath) args.push('-LogoPath', logoPath)

  try {
    await execFileAsync('powershell.exe', args, { windowsHide: true, timeout: 3 * 60_000 })
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr?.trim()
    if (stderr?.includes('WORD_ALREADY_RUNNING')) {
      throw new Error('Word est ouvert sur ce poste. Fermez toutes les fenêtres Word puis réessayez.')
    }
    throw new Error(stderr || "Le logo n'a pas pu être modifié.")
  }
}

async function buildStatus(root: string): Promise<ModelStatus> {
  const template = templatePath(root)
  let templateExists = true
  try {
    await fs.access(template)
  } catch {
    templateExists = false
  }
  return {
    config: await readModelConfig(root),
    dataFolder: root,
    templatePath: template,
    templateExists,
    logoPreview: templateExists ? await readHeaderImage(template) : null
  }
}

export function registerModelIpc(): void {
  ipcMain.handle('model:get', async () => buildStatus(await requireLibraryPath()))

  ipcMain.handle('model:setLogo', async (_event, imageAbsPath: string) => {
    const root = await requireLibraryPath()
    // The chosen image is read, never moved or copied: the logo lives in the template
    // header and nowhere else. Whatever else sits in the folder is none of our business.
    await runLogoScript(templatePath(root), path.resolve(imageAbsPath))
    return buildStatus(root)
  })

  ipcMain.handle('model:clearLogo', async () => {
    const root = await requireLibraryPath()
    await runLogoScript(templatePath(root), null)
    return buildStatus(root)
  })

  ipcMain.handle('model:setSommaireTitle', async (_event, title: string) => {
    const root = await requireLibraryPath()
    const config = await readModelConfig(root)
    config.sommaireTitle = title.trim() || 'Sommaire'
    await writeModelConfig(root, config)
    return buildStatus(root)
  })

  ipcMain.handle('model:openTemplate', async () => {
    const error = await shell.openPath(templatePath(await requireLibraryPath()))
    if (error) throw new Error(error)
  })

  /** Shortcut to the folder holding the template, the contents and the documents. */
  ipcMain.handle('model:openDataFolder', async () => {
    const error = await shell.openPath(dataRoot())
    if (error) throw new Error(error)
  })

  ipcMain.handle('model:ensureExample', async () => {
    const root = await requireLibraryPath()
    const config = await readModelConfig(root)
    if (config.exampleId) return config.exampleId
    const example = await createMemoireFrom(root, 'Exemple', null)
    await writeModelConfig(root, { ...config, exampleId: example.id })
    return example.id
  })
}
