import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { FileHandle } from 'node:fs/promises'
import { documentsDir, logosDir, resolveContentFile, templatePath } from '../store/paths'
import { readModelConfig } from '../store/modelStore'
import { getMemoire, saveMemoire } from '../store/memoireStore'
import { flattenChapters } from './plan'
import { getScriptPath, runWordScript, GenerationError } from './wordRunner'
import type { ContentRef, GenerationResult } from '../../shared/types'

/**
 * Whether another program is holding this file open for reading. Asking to open it for
 * writing is the same question Word will ask when it saves: a reader keeping the PDF open
 * denies write sharing, and `fs.open(..., 'r+')` reports EBUSY for it.
 */
async function isLocked(absPath: string): Promise<boolean> {
  let handle: FileHandle
  try {
    handle = await fs.open(absPath, 'r+')
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    // Anything else — no such file, a path that is not a file — is not a lock, and the
    // generation is left to run and report for itself.
    return code === 'EBUSY' || code === 'EPERM' || code === 'EACCES'
  }
  await handle.close()
  return false
}

async function assertWritable(absPath: string, label: string): Promise<void> {
  if (!(await isLocked(absPath))) return
  throw new GenerationError(
    `${label} de ce mémoire est ouvert dans un autre programme :
${absPath}

` +
      'Fermez-le, puis relancez la génération.'
  )
}

export async function generateMemoire(
  libraryPath: string,
  memoireId: string,
  onProgress: (message: string) => void
): Promise<GenerationResult> {
  const config = await readModelConfig(libraryPath)
  const memoire = await getMemoire(libraryPath, memoireId)
  const warnings: string[] = []

  const shellPath = templatePath(libraryPath)
  try {
    await fs.access(shellPath)
  } catch {
    throw new GenerationError(
      "Le gabarit est introuvable. Ouvrez la Configuration pour le rétablir."
    )
  }

  let expectedContents = 0
  let resolvedContents = 0

  /** Resolves an attached file, skipping (with a warning) anything gone missing. */
  async function resolveContent(content: ContentRef | null, label: string): Promise<string | null> {
    if (!content) return null
    expectedContents += 1
    const absPath = resolveContentFile(libraryPath, content.file)
    try {
      await fs.access(absPath)
      resolvedContents += 1
      return absPath
    } catch {
      warnings.push(`Fichier introuvable pour « ${label} » : ce contenu a été ignoré.`)
      return null
    }
  }

  onProgress('Préparation...')

  // The mémoire's own logos, not whatever the shared template currently carries: two
  // mémoires open at the same time must not affect each other's when one changes.
  async function resolveLogo(logo: ContentRef | null, label: string): Promise<string | null> {
    if (!logo) return null
    const candidate = path.join(logosDir(libraryPath), logo.file)
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      warnings.push(`${label} de ce mémoire est introuvable ; le document a été généré sans.`)
      return null
    }
  }
  const logoPath = await resolveLogo(memoire.logo, 'Le logo')
  const secondLogoPath = await resolveLogo(memoire.secondLogo, 'Le second logo')

  const coverPages: string[] = []
  for (const cover of memoire.coverPages) {
    const resolved = await resolveContent(cover, cover.originalName)
    if (resolved) coverPages.push(resolved)
  }

  const chapters: {
    title: string
    level: number
    orientation: string
    pageBreakBefore: boolean
    contentPath: string | null
  }[] = []
  for (const chapter of flattenChapters(memoire.chapters)) {
    chapters.push({
      title: `${chapter.number} ${chapter.title}`,
      level: chapter.level,
      orientation: chapter.orientation,
      pageBreakBefore: chapter.pageBreakBefore,
      contentPath: await resolveContent(chapter.content, chapter.title)
    })
  }

  if (chapters.length === 0) {
    throw new GenerationError("Ce mémoire n'a aucun chapitre.")
  }

  // Producing a document of bare titles and calling it a success would be misleading:
  // something has happened to the contents folder and the user needs to know.
  if (expectedContents > 0 && resolvedContents === 0) {
    throw new GenerationError(
      expectedContents === 1
        ? "Le fichier de contenu de ce mémoire est introuvable. Rattachez-le depuis le plan."
        : `Aucun des ${expectedContents} fichiers de contenu n'a été trouvé. Le dossier de contenus de ce mémoire a sans doute été déplacé ou vidé — vérifiez le dossier « contenus » du dossier de travail, y compris « _corbeille » si le mémoire a été supprimé puis rétabli.`
    )
  }

  // Generated documents sit together under a readable name, so they can be picked up
  // from the folder without hunting through identifiers.
  const memoireOutputDir = path.join(documentsDir(libraryPath), memoire.id)
  await fs.mkdir(memoireOutputDir, { recursive: true })
  const safeName = (memoire.name || 'memoire').replace(/[\\/:*?"<>|]/g, '_')
  const outputDocxPath = path.join(memoireOutputDir, `${safeName}.docx`)
  const outputPdfPath = path.join(memoireOutputDir, `${safeName}.pdf`)

  // Asked before Word is even started, because the answer is already knowable and the
  // alternative is two minutes of assembly thrown away on the very last line. Reading a
  // PDF, fixing a chapter and regenerating without closing the reader is an ordinary
  // morning, not a mistake.
  await assertWritable(outputDocxPath, 'Le document Word')
  await assertWritable(outputPdfPath, 'Le PDF')

  const manifest = {
    shellPath,
    outputDocxPath,
    outputPdfPath,
    sommaireTitle: config.sommaireTitle,
    logoPath,
    secondLogoPath,
    coverPages,
    chapters
  }
  const manifestPath = path.join(memoireOutputDir, 'manifest.json')
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')

  const result = await runWordScript(getScriptPath('BuildMemoire.ps1'), manifestPath, onProgress)
  const scriptWarnings = Array.isArray(result.warnings) ? (result.warnings as string[]) : []
  warnings.push(...scriptWarnings)

  // What the script actually produced, not what was asked of it: the PDF export is allowed
  // to fail on its own without taking the whole assembly down with it. Recording no PDF is
  // the honest answer rather than a fallback — a PDF from an earlier run may well still sit
  // at that path, and offering it would hand back a document that no longer matches the
  // Word just built.
  const pdfPath = typeof result.pdfPath === 'string' ? result.pdfPath : null
  if (pdfPath === null) {
    // Said plainly when the file really is held open, and without guessing when it is not:
    // the export can fail for other reasons, and blaming a reader that is not there would
    // send the user looking for a window to close that does not exist.
    warnings.push(
      (await isLocked(outputPdfPath))
        ? "Le PDF n'a pas pu être créé : il est ouvert dans un autre programme. Fermez-le puis relancez la génération. Le document Word, lui, est à jour."
        : "Le PDF n'a pas pu être créé. Le document Word, lui, est à jour."
    )
  }

  await saveMemoire(libraryPath, {
    ...memoire,
    lastGeneratedAt: new Date().toISOString(),
    outputDocx: outputDocxPath,
    outputPdf: pdfPath
  })

  onProgress('Terminé.')
  return {
    docxPath: outputDocxPath,
    pdfPath,
    pageCount: (result.pageCount as number) ?? 0,
    warnings
  }
}
