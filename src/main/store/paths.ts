import { app } from 'electron'
import path from 'node:path'
import { promises as fs } from 'node:fs'

/**
 * Everything the application owns lives in one folder — nothing to choose at first
 * launch. The configuration screen offers a shortcut to open it, since the Word content
 * files are meant to be edited and replaced by hand.
 *
 *   Documents/XSProMemo/
 *     Gabarit.docx      la présentation : styles, en-tête, pied de page
 *     contenus/         les fichiers Word, nommés lisiblement
 *     memoires/         les plans (plomberie)
 *     documents/        les mémoires générés
 *     config.json
 *
 * Not AppData, despite it being the usual home for application data: Office refuses to
 * open documents sitting under %APPDATA% or %LOCALAPPDATA% on hardened machines, and
 * the whole pipeline is Word automation. Documents also has the merit of being visible
 * and covered by the user's usual backups.
 */
export function dataRoot(): string {
  return path.join(app.getPath('documents'), 'XSProMemo')
}

export function templatePath(root: string): string {
  return path.join(root, 'Gabarit.docx')
}

export function contentsDir(root: string): string {
  return path.join(root, 'contenus')
}

export function memoiresDir(root: string): string {
  return path.join(root, 'memoires')
}

export function documentsDir(root: string): string {
  return path.join(root, 'documents')
}

export function configJsonPath(root: string): string {
  return path.join(root, 'config.json')
}

/** Content files are referenced by name, so the folder stays readable. */
export function resolveContentFile(root: string, fileName: string): string {
  return path.join(contentsDir(root), fileName)
}

/** Writes JSON through a temp file so a crash mid-write cannot corrupt the original. */
export async function writeJsonAtomic(targetPath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  const tmp = `${targetPath}.tmp`
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf-8')
  await fs.rename(tmp, targetPath)
}
