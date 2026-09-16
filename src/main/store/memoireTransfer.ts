import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import JSZip from 'jszip'
import { logosDir, resolveContentFile, storeContentBytes } from './paths'
import { getMemoire, saveMemoire } from './memoireStore'
import { prefixFor } from './logoStore'
import type { ChapterNode, ContentRef, LogoField, Memoire } from '../../shared/types'

/** Every content file a mémoire's plan actually points to — cover pages included. */
function collectContentFiles(memoire: Memoire): Set<string> {
  const files = new Set<string>()
  function walk(nodes: ChapterNode[]): void {
    for (const node of nodes) {
      if (node.content) files.add(node.content.file)
      walk(node.children)
    }
  }
  walk(memoire.chapters)
  for (const cover of memoire.coverPages) files.add(cover.file)
  return files
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

  for (const file of collectContentFiles(memoire)) {
    try {
      zip.file(`contenus/${file}`, await fs.readFile(resolveContentFile(root, file)))
    } catch {
      // Missing content is already tolerated elsewhere (generation just warns) — an
      // export shouldn't fail over it either.
    }
  }

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

/** Deep-copies a chapter tree, remapping each content file to its final imported name. */
function remapChapters(nodes: ChapterNode[], renamed: Map<string, string>): ChapterNode[] {
  return nodes.map((node) => ({
    ...node,
    content: remapContent(node.content, renamed),
    children: remapChapters(node.children, renamed)
  }))
}

function remapContent(ref: ContentRef | null, renamed: Map<string, string>): ContentRef | null {
  if (!ref) return null
  return { ...ref, file: renamed.get(ref.file) ?? ref.file }
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

  const renamed = new Map<string, string>()
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !entry.name.startsWith('contenus/')) continue
    const originalName = entry.name.slice('contenus/'.length)
    const bytes = await entry.async('nodebuffer')
    renamed.set(originalName, await storeContentBytes(root, originalName, bytes))
  }

  const newId = randomUUID()

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
    coverPages: source.coverPages
      .map((cover) => remapContent(cover, renamed))
      .filter((cover): cover is ContentRef => cover !== null),
    chapters: remapChapters(source.chapters, renamed),
    logo: await importLogo('logo'),
    secondLogo: await importLogo('secondLogo')
  }

  return saveMemoire(root, imported)
}
