import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import JSZip from 'jszip'
import { logosDir, memoireContentsDir, resolveContentFile } from './paths'
import { getMemoire, saveMemoire } from './memoireStore'
import { collectContentFiles, remapChapters, remapCoverPages } from './contentRefs'
import { prefixFor } from './logoStore'
import type { ContentRef, LogoField, Memoire } from '../../shared/types'

/**
 * Names the shape of the archive, so the importer never has to guess. Format 1 (no marker
 * file) came from the versions that kept every content in one flat pool: a plan's
 * references were bare file names, identical to the zip entry names.
 */
const TRANSFER_FORMAT = 2
const MARKER_ENTRY = 'xspromemo.json'

interface TransferMarker {
  format: number
  /** Plan reference → the entry holding it, so the importer matches exactly. */
  entries: Record<string, string>
}

/** Zip entries keep the readable file name, not the `<id>/` path: an archive carries one
 *  mémoire and lands under a different id anyway, so the folder would be noise. Two
 *  references can still share a base name (one migrated, one left from the flat pool) —
 *  hence the suffix, and hence the marker that records which entry belongs to which. */
function entryNameFor(ref: string, taken: Set<string>): string {
  const base = path.basename(ref.replace(/\\/g, '/'))
  const ext = path.extname(base)
  const stem = path.basename(base, ext)
  let candidate = base
  let suffix = 1
  while (taken.has(candidate)) {
    suffix += 1
    candidate = `${stem} (${suffix})${ext}`
  }
  taken.add(candidate)
  return candidate
}

/**
 * Bundles one mémoire into a self-contained .zip: its plan, the content files it
 * actually references, and its logo(s) — everything a mémoire needs that otherwise lives
 * elsewhere in the library. Fields tied to this machine (a past generation's absolute
 * paths) are cleared, since they mean nothing anywhere else.
 */
export async function exportMemoire(root: string, id: string, destZipPath: string): Promise<void> {
  const memoire = await getMemoire(root, id)
  const zip = new JSZip()

  const sanitized: Memoire = {
    ...memoire,
    lastGeneratedAt: null,
    outputDocx: null,
    outputPdf: null
  }
  zip.file('memoire.json', JSON.stringify(sanitized, null, 2))

  const marker: TransferMarker = { format: TRANSFER_FORMAT, entries: {} }
  const taken = new Set<string>()
  for (const file of collectContentFiles(memoire)) {
    const entryName = entryNameFor(file, taken)
    try {
      zip.file(`contenus/${entryName}`, await fs.readFile(resolveContentFile(root, file)))
      marker.entries[file] = entryName
    } catch {
      // Missing content is already tolerated elsewhere (generation just warns) — an
      // export shouldn't fail over it either.
      taken.delete(entryName)
    }
  }
  zip.file(MARKER_ENTRY, JSON.stringify(marker, null, 2))

  for (const logo of [memoire.logo, memoire.secondLogo]) {
    if (!logo) continue
    try {
      zip.file(`logos/${logo.file}`, await fs.readFile(path.join(logosDir(root), logo.file)))
    } catch {
      // Same tolerance as content files.
    }
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer' })
  await fs.mkdir(path.dirname(destZipPath), { recursive: true })
  await fs.writeFile(destZipPath, buffer)
}

/**
 * Which zip entry holds which of the plan's references. Read from the marker when the
 * archive has one; otherwise the archive predates it, and its plan's references *are* the
 * entry names — so matching them to themselves is exactly right.
 */
async function readTransferMap(zip: JSZip, source: Memoire): Promise<Map<string, string>> {
  const marker = zip.file(MARKER_ENTRY)
  if (marker) {
    try {
      const parsed: TransferMarker = JSON.parse(await marker.async('string'))
      return new Map(Object.entries(parsed.entries ?? {}))
    } catch {
      // Unreadable marker — fall through to the same guess as an archive without one.
    }
  }
  return new Map([...collectContentFiles(source)].map((file) => [file, file]))
}

/**
 * Recreates a mémoire exported with `exportMemoire` inside this library, under a fresh
 * id so it can never collide with one already here (even the same export imported
 * twice). Inherits the source's modèle status — same principle as `createMemoireFrom`
 * duplicating one: importing a modèle's export gives another modèle, importing a working
 * mémoire's export gives another working mémoire. Never carries a previous machine's
 * generation result.
 */
export async function importMemoire(root: string, zipPath: string): Promise<Memoire> {
  const zip = await JSZip.loadAsync(await fs.readFile(zipPath))
  const manifest = zip.file('memoire.json')
  if (!manifest) {
    throw new Error("Ce fichier ne ressemble pas à un mémoire exporté par XSProMemo.")
  }

  let source: Memoire
  try {
    source = JSON.parse(await manifest.async('string'))
  } catch {
    throw new Error('Le fichier mémoire.json de cette archive est illisible.')
  }

  const newId = randomUUID()

  // Straight into the new mémoire's own folder: an imported mémoire owns its content like
  // any other, and the folder is brand new, so no name can collide.
  const targetDir = memoireContentsDir(root, newId)
  const renamed = new Map<string, string>()
  const written = new Set<string>()
  for (const [ref, entryName] of await readTransferMap(zip, source)) {
    const entry = zip.file(`contenus/${entryName}`)
    if (!entry) continue
    if (!written.has(entryName)) {
      await fs.mkdir(targetDir, { recursive: true })
      await fs.writeFile(path.join(targetDir, entryName), await entry.async('nodebuffer'))
      written.add(entryName)
    }
    renamed.set(ref, `${newId}/${entryName}`)
  }

  async function importLogo(field: LogoField): Promise<ContentRef | null> {
    const ref = source[field]
    if (!ref) return null
    const entry = zip.file(`logos/${ref.file}`)
    if (!entry) return null
    const ext = path.extname(ref.file)
    const fileName = `${prefixFor(newId, field)}${ext.slice(1)}`
    await fs.mkdir(logosDir(root), { recursive: true })
    await fs.writeFile(path.join(logosDir(root), fileName), await entry.async('nodebuffer'))
    return { file: fileName, originalName: ref.originalName }
  }

  const now = new Date().toISOString()
  const imported: Memoire = {
    ...source,
    id: newId,
    createdAt: now,
    updatedAt: now,
    isTemplate: source.isTemplate,
    lastGeneratedAt: null,
    outputDocx: null,
    outputPdf: null,
    coverPages: remapCoverPages(source.coverPages, renamed),
    chapters: remapChapters(source.chapters, renamed),
    logo: await importLogo('logo'),
    secondLogo: await importLogo('secondLogo')
  }

  return saveMemoire(root, imported)
}
