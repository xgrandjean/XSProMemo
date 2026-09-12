import path from 'node:path'
import { promises as fs } from 'node:fs'
import { app } from 'electron'
import { templatePath } from '../store/paths'
import { getScriptPath, runWordScript, GenerationError } from './wordRunner'

/**
 * Generates a temporary, standalone document showing each heading level plus a sample
 * body paragraph, styled with the current gabarit — never saved as the gabarit itself,
 * never tied to any mémoire. Returns the path to open.
 */
export async function previewStyles(libraryPath: string): Promise<string> {
  const shellPath = templatePath(libraryPath)
  try {
    await fs.access(shellPath)
  } catch {
    throw new GenerationError(
      "Le gabarit est introuvable. Ouvrez la Configuration pour le rétablir."
    )
  }

  const outputDocxPath = path.join(app.getPath('temp'), 'XSProMemo-apercu-styles.docx')
  const manifestPath = path.join(app.getPath('temp'), 'XSProMemo-apercu-styles-manifest.json')
  await fs.writeFile(manifestPath, JSON.stringify({ shellPath, outputDocxPath }, null, 2), 'utf-8')

  await runWordScript(getScriptPath('PreviewStyles.ps1'), manifestPath, () => {}, 3 * 60_000)
  return outputDocxPath
}
