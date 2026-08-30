import path from 'node:path'
import { promises as fs } from 'node:fs'
import { outputDir, resolveLibraryFile } from '../store/paths'
import { readModelConfig } from '../store/modelStore'
import { getMemoire, saveMemoire } from '../store/memoireStore'
import { flattenChapters } from './plan'
import { getScriptPath, runWordScript, GenerationError } from './wordRunner'
import type { ContentRef, GenerationResult } from '../../shared/types'

export async function generateMemoire(
  libraryPath: string,
  memoireId: string,
  onProgress: (message: string) => void
): Promise<GenerationResult> {
  const config = await readModelConfig(libraryPath)
  const memoire = await getMemoire(libraryPath, memoireId)
  const warnings: string[] = []

  if (!config.templatePath) {
    throw new GenerationError(
      "Aucun gabarit n'est configuré. Ouvrez la Configuration pour en choisir un."
    )
  }
  try {
    await fs.access(config.templatePath)
  } catch {
    throw new GenerationError(`Le gabarit est introuvable : ${config.templatePath}`)
  }

  /** Resolves an attached file, skipping (with a warning) anything gone missing. */
  async function resolveContent(content: ContentRef | null, label: string): Promise<string | null> {
    if (!content) return null
    const absPath = resolveLibraryFile(libraryPath, content.file)
    try {
      await fs.access(absPath)
      return absPath
    } catch {
      warnings.push(`Fichier introuvable pour « ${label} » : ce contenu a été ignoré.`)
      return null
    }
  }

  onProgress('Préparation...')
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

  const memoireOutputDir = path.join(outputDir(libraryPath), memoire.id)
  await fs.mkdir(memoireOutputDir, { recursive: true })
  const safeName = (memoire.name || 'memoire').replace(/[\\/:*?"<>|]/g, '_')
  const outputDocxPath = path.join(memoireOutputDir, `${safeName}.docx`)
  const outputPdfPath = path.join(memoireOutputDir, `${safeName}.pdf`)

  const manifest = {
    shellPath: config.templatePath,
    outputDocxPath,
    outputPdfPath,
    sommaireTitle: config.sommaireTitle,
    coverPages,
    chapters
  }
  const manifestPath = path.join(memoireOutputDir, 'manifest.json')
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')

  const result = await runWordScript(getScriptPath('BuildMemoire.ps1'), manifestPath, onProgress)
  const scriptWarnings = Array.isArray(result.warnings) ? (result.warnings as string[]) : []
  warnings.push(...scriptWarnings)

  await saveMemoire(libraryPath, {
    ...memoire,
    lastGeneratedAt: new Date().toISOString(),
    outputDocx: outputDocxPath,
    outputPdf: outputPdfPath
  })

  onProgress('Terminé.')
  return {
    docxPath: outputDocxPath,
    pdfPath: outputPdfPath,
    pageCount: (result.pageCount as number) ?? 0,
    warnings
  }
}
