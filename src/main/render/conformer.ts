import path from 'node:path'
import { promises as fs } from 'node:fs'
import { documentsDir, resolveContentFile, templatePath } from '../store/paths'
import { getMemoire } from '../store/memoireStore'
import { flattenChapters } from './plan'
import { getScriptPath, runWordScript, GenerationError } from './wordRunner'
import type { ConformiteResult } from '../../shared/types'

/**
 * Met les fichiers de contenu d'un mémoire au format de la page finale : celle du gabarit,
 * et le retrait du niveau auquel chaque fichier est attaché.
 *
 * Réparation ponctuelle, pour les fichiers écrits avant cette règle. Un contenu créé ou
 * attaché depuis reçoit déjà la page du gabarit ; ce que cette action apporte en plus,
 * c'est le retrait, qui demande de résoudre les styles Word — donc Word lui-même, ce qui
 * se justifie pour une action explicite mais pas à chaque import.
 */
export async function conformerContenus(
  libraryPath: string,
  memoireId: string,
  onProgress: (message: string) => void
): Promise<ConformiteResult> {
  const memoire = await getMemoire(libraryPath, memoireId)

  const shellPath = templatePath(libraryPath)
  try {
    await fs.access(shellPath)
  } catch {
    throw new GenerationError(
      "Le gabarit est introuvable : sans lui, aucune page de référence. Ouvrez la Configuration pour le rétablir."
    )
  }

  const files: { path: string; level: number; orientation: string; label: string }[] = []

  // Une page de garde ne reçoit pas de retrait : l'assemblage n'en pose pas non plus.
  memoire.coverPages.forEach((cover, index) => {
    files.push({
      path: resolveContentFile(libraryPath, cover.file),
      level: 0,
      orientation: 'portrait',
      label: `Page de garde ${index + 1}`
    })
  })

  for (const chapter of flattenChapters(memoire.chapters)) {
    if (!chapter.content) continue
    files.push({
      path: resolveContentFile(libraryPath, chapter.content.file),
      level: chapter.level,
      orientation: chapter.orientation,
      label: `${chapter.number} ${chapter.title}`
    })
  }

  if (files.length === 0) {
    return { ajustes: [], conformes: 0, echecs: [] }
  }

  // Le manifeste voyage par le même chemin que celui de la génération, dans le dossier de
  // sortie du mémoire, pour ne rien déposer au milieu des contenus.
  const outputDir = path.join(documentsDir(libraryPath), memoire.id)
  await fs.mkdir(outputDir, { recursive: true })
  const manifestPath = path.join(outputDir, 'conformite.json')
  await fs.writeFile(manifestPath, JSON.stringify({ shellPath, files }, null, 2), 'utf-8')

  const result = await runWordScript(
    getScriptPath('ConformerContenus.ps1'),
    manifestPath,
    onProgress
  )

  return {
    ajustes: Array.isArray(result.ajustes) ? (result.ajustes as string[]) : [],
    conformes: typeof result.conformes === 'number' ? result.conformes : 0,
    echecs: Array.isArray(result.echecs) ? (result.echecs as string[]) : []
  }
}
