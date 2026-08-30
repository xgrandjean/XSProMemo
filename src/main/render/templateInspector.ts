import { promises as fs } from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff'
}

/**
 * The picture sitting in the template's header, as a data URL, so the configuration
 * screen can show the logo actually in use rather than merely claim there is one.
 * Read straight from the file: no Word involved.
 */
export async function readHeaderImage(templateAbsPath: string): Promise<string | null> {
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

      const mime = MIME_BY_EXTENSION[path.extname(mediaPath).toLowerCase()] ?? 'image/png'
      const bytes = await media.async('nodebuffer')
      return `data:${mime};base64,${bytes.toString('base64')}`
    }
    return null
  } catch {
    return null
  }
}
