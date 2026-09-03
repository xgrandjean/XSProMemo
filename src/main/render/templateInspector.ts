import { promises as fs } from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'

export const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff'
}

async function findHeaderImage(
  templateAbsPath: string
): Promise<{ bytes: Buffer; ext: string } | null> {
  try {
    const zip = await JSZip.loadAsync(await fs.readFile(templateAbsPath))

    const headers = Object.keys(zip.files).filter((name) => /^word\/header\d*\.xml$/.test(name))
    for (const header of headers) {
      const xml = await zip.file(header)!.async('string')
      const reference = /r:embed="([^"]+)"|r:id="([^"]+)"/.exec(xml)
      if (!reference) continue

      const relsName = `word/_rels/${path.basename(header)}.rels`
      const rels = zip.file(relsName)
      if (!rels) continue

      const relId = reference[1] ?? reference[2]
      const relsXml = await rels.async('string')
      const target = new RegExp(`Id="${relId}"[^>]*Target="([^"]+)"`).exec(relsXml)
      if (!target) continue

      const mediaPath = `word/${target[1].replace(/^\.\.\//, '')}`
      const media = zip.file(mediaPath)
      if (!media) continue

      const bytes = await media.async('nodebuffer')
      return { bytes, ext: path.extname(mediaPath).toLowerCase() || '.png' }
    }
    return null
  } catch {
    return null
  }
}

/**
 * The raw bytes of the picture in a document's header — used to recover a mémoire's
 * logo from a document it was already generated with, when it predates each mémoire
 * keeping its own.
 */
export async function extractHeaderImage(
  templateAbsPath: string
): Promise<{ bytes: Buffer; ext: string } | null> {
  return findHeaderImage(templateAbsPath)
}
