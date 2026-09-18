import { app } from 'electron'
import path from 'node:path'
import { promises as fs } from 'node:fs'

/**
 * Everything the application owns lives in one folder — nothing to choose at first
 * launch. The configuration screen offers a shortcut to open it, since the Word content
 * files are meant to be edited and replaced by hand.
 *
 *   Documents/XSProMemo/
 *     Gabarit.docx      la présentation : styles, logo par défaut, pied de page
 *     contenus/<id>/    les fichiers Word d'un mémoire, nommés lisiblement
 *     logos/            le logo propre à chaque mémoire (un par identifiant)
 *     memoires/         les plans (plomberie)
 *     documents/<id>/   les mémoires générés
 *     config.json
 *
 * Une seule règle : tout ce qui appartient à un mémoire vit sous son identifiant. `contenus/`
 * était le seul à y échapper — un pot commun où deux mémoires ayant un chapitre de même titre
 * se partageaient le même fichier Word, si bien qu'éditer le contenu de l'un réécrivait celui
 * de l'autre. Les fichiers posés à plat par les versions antérieures continuent de se résoudre
 * (voir `resolveContentFile`) : rien n'est migré ni supprimé d'office.
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

/** One image per mémoire — its own logo, independent of the shared template's. */
export function logosDir(root: string): string {
  return path.join(root, 'logos')
}

export function configJsonPath(root: string): string {
  return path.join(root, 'config.json')
}

/** Where one mémoire's own content files live — `documents/<id>/` and `logos/<id>.png`
 *  already followed this rule. */
export function memoireContentsDir(root: string, memoireId: string): string {
  return path.join(contentsDir(root), memoireId)
}

/** A content reference is a POSIX-style path relative to `contenus/`, so the same JSON
 *  reads the same on any machine. Built here rather than with `path.join`, which would
 *  yield a backslash on Windows and then travel into a .zip entry name. */
export function contentRefPath(memoireId: string, fileName: string): string {
  return `${memoireId}/${fileName}`
}

/**
 * Resolves a content reference against the library. The reference is either
 * `<id>/Nom.docx` (a mémoire's own file) or a bare `Nom.docx` left by a version that kept
 * every content in one shared pool — both still work, so upgrading breaks nothing.
 *
 * Now that the reference legitimately carries a separator, it has to be treated as
 * untrusted input: a mémoire's JSON can be hand-edited (the folder is meant to be browsed)
 * or written by an LLM through the "consigne pour IA" feature, and `path.join` would
 * happily walk out of the library on `../`.
 */
export function resolveContentFile(root: string, fileName: string): string {
  const normalized = fileName.replace(/\\/g, '/')
  const segments = normalized.split('/').filter((segment) => segment !== '' && segment !== '.')
  if (
    segments.length === 0 ||
    segments.some((segment) => segment === '..') ||
    path.isAbsolute(normalized) ||
    /^[a-zA-Z]:/.test(normalized)
  ) {
    throw new Error(`Référence de contenu invalide : « ${fileName} ».`)
  }
  return path.join(contentsDir(root), ...segments)
}

/**
 * Writes a content file into the mémoire that owns it, under a name free *in that folder*,
 * and returns the reference to store in its plan.
 *
 * Deliberately never reuses an existing file, not even one whose bytes match: two chapters
 * of the same mémoire sharing one physical document is the very bug this layout exists to
 * remove, only smaller — editing one chapter's Word file would silently rewrite the other's.
 * The cost is a duplicate file when the same document is attached twice; it stays inside
 * that mémoire's own folder and goes away with it.
 */
export async function storeContentFor(
  root: string,
  memoireId: string,
  fileName: string,
  bytes: Buffer
): Promise<string> {
  if (!memoireId) throw new Error('Contenu sans mémoire de rattachement.')
  const dir = memoireContentsDir(root, memoireId)
  await fs.mkdir(dir, { recursive: true })

  const base = path.basename(fileName, path.extname(fileName))
  const ext = path.extname(fileName)
  let candidate = `${base}${ext}`
  let suffix = 1
  while (await fs.access(path.join(dir, candidate)).then(() => true, () => false)) {
    suffix += 1
    candidate = `${base} (${suffix})${ext}`
  }

  await fs.writeFile(path.join(dir, candidate), bytes)
  return contentRefPath(memoireId, candidate)
}

/** Writes JSON through a temp file so a crash mid-write cannot corrupt the original. */
export async function writeJsonAtomic(targetPath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  const tmp = `${targetPath}.tmp`
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf-8')
  await fs.rename(tmp, targetPath)
}
