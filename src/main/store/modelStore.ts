import { app } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import { configJsonPath, storeContentFor, templatePath, writeJsonAtomic } from './paths'
import type { ContentRef, ModelConfig } from '../../shared/types'

const defaultModelConfig: ModelConfig = {
  sommaireTitle: 'Sommaire',
  aiInstructions: '',
  gabaritVersion: ''
}

export async function readModelConfig(root: string): Promise<ModelConfig> {
  try {
    const stored = JSON.parse(await fs.readFile(configJsonPath(root), 'utf-8'))
    // Only known keys survive, so settings from earlier versions do not linger.
    return {
      sommaireTitle: stored.sommaireTitle ?? defaultModelConfig.sommaireTitle,
      aiInstructions: stored.aiInstructions ?? defaultModelConfig.aiInstructions,
      gabaritVersion: stored.gabaritVersion ?? defaultModelConfig.gabaritVersion
    }
  } catch {
    return { ...defaultModelConfig }
  }
}

export async function writeModelConfig(root: string, config: ModelConfig): Promise<void> {
  await writeJsonAtomic(configJsonPath(root), config)
}

/**
 * Copies a chosen file into the folder of the mémoire it is being attached to, keeping a
 * readable name so the folder can be browsed and its files replaced by hand. Always a copy
 * of its own: picking the same document for two mémoires gives each one its own, so
 * reworking it for this year's tender never reaches into one already submitted.
 */
export async function importContent(
  root: string,
  memoireId: string,
  srcAbsPath: string
): Promise<ContentRef> {
  if (path.extname(srcAbsPath).toLowerCase() !== '.docx') {
    throw new Error('Seuls les fichiers Word (.docx) peuvent servir de contenu.')
  }

  const base = path.basename(srcAbsPath, '.docx').replace(/[\/:*?"<>|]/g, '-').trim() || 'contenu'
  const originalName = `${base}.docx`
  // La copie rangee dans le memoire prend la page du gabarit ; le fichier choisi par
  // l'utilisateur, lui, n'est jamais touche.
  const bytes = await auFormatDuGabarit(root, await fs.readFile(srcAbsPath), null)
  const file = await storeContentFor(root, memoireId, originalName, bytes)
  return { file, originalName }
}

/** An empty Word document, shipped once and copied for every "contenu vide". */
function blankContentSource(): string {
  const root = app.isPackaged ? process.resourcesPath : path.join(app.getAppPath(), 'resources')
  return path.join(root, 'ContenuVierge.docx')
}

/** Format de page du gabarit de cette bibliothèque, à recopier tel quel. */
async function gabaritPageSetup(root: string): Promise<{ size?: string; margins?: string }> {
  try {
    const zip = await JSZip.loadAsync(await fs.readFile(templatePath(root)))
    const xml = await zip.file('word/document.xml')?.async('string')
    return {
      size: xml?.match(/<w:pgSz[^/]*\/>/)?.[0],
      margins: xml?.match(/<w:pgMar[^/]*\/>/)?.[0]
    }
  } catch {
    // Gabarit absent ou illisible : le fichier de contenu garde sa propre page.
    return {}
  }
}

/**
 * Met un fichier de contenu au format de la page finale, avant de le ranger dans le
 * mémoire : la page du gabarit, et — pour un document vierge seulement — le retrait du
 * niveau auquel il va être attaché. Sans cela on rédige dans une page qui ne ressemble
 * pas au mémoire assemblé.
 *
 * Le retrait n'est pose que sur un document vierge, dont le seul paragraphe est vide. Sur
 * un fichier deja redige il faudrait connaitre le retrait EFFECTIF de chaque paragraphe,
 * qui peut venir du paragraphe, de son style ou d'une liste : c'est Word qui le resout, a
 * la generation, ou le bloc est replace correctement de toute facon. Le reimplementer ici
 * pour reecrire le contenu de l'utilisateur serait beaucoup de code fragile.
 */
async function auFormatDuGabarit(
  root: string,
  source: Buffer,
  retraitDuNiveau: number | null
): Promise<Buffer> {
  try {
    const zip = await JSZip.loadAsync(source)
    const document = zip.file('word/document.xml')
    if (!document) return source
    let xml = await document.async('string')

    // Toutes les sections du fichier, pas seulement la premiere.
    const { size, margins } = await gabaritPageSetup(root)
    if (size) xml = xml.replace(/<w:pgSz[^/]*\/>/g, size)
    if (margins) xml = xml.replace(/<w:pgMar[^/]*\/>/g, margins)
    if (retraitDuNiveau && retraitDuNiveau > 0) {
      // Le paragraphe vide du fichier livré n'a pas de mise en forme : on lui en donne une.
      xml = xml.replace(
        /(<w:body>\s*<w:p\b[^>]*>)/,
        `$1<w:pPr><w:ind w:left="${retraitDuNiveau}"/></w:pPr>`
      )
    }

    zip.file('word/document.xml', xml)
    return zip.generateAsync({ type: 'nodebuffer' })
  } catch {
    // Un fichier au mauvais format de page vaut mieux qu'un bouton qui echoue : le
    // memoire assemble sera correct dans tous les cas, c'est la page de travail qui
    // ressemblera moins au resultat.
    return source
  }
}

/** 0,5 cm, le pas de retrait par niveau que l'assemblage applique et que la consigne
 *  demande aux rédacteurs — voir `Set-ContentIndent` dans BuildMemoire.ps1. */
const INDENT_TWIPS_PAR_NIVEAU = 283

/**
 * Starts a new content from a blank page rather than an existing file — for a chapter or
 * cover page the user wants to write directly in Word instead of attaching something
 * already prepared. `level` est la profondeur du chapitre (1 pour un chapitre de premier
 * niveau) ; absent pour une page de garde, qui ne reçoit aucun retrait.
 */
export async function createBlankContent(
  root: string,
  memoireId: string,
  level: number | null = null
): Promise<ContentRef> {
  const retrait = level && level > 0 ? level * INDENT_TWIPS_PAR_NIVEAU : null
  const bytes = await auFormatDuGabarit(root, await fs.readFile(blankContentSource()), retrait)
  const originalName = 'Nouveau contenu.docx'
  const file = await storeContentFor(root, memoireId, originalName, bytes)
  return { file, originalName }
}
