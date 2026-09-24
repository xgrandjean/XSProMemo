import type { ContentRef } from '../../../shared/types'

/** Shared by every place that lets the user attach a Word file as content. The file is
 *  copied into `memoireId`'s own folder, so it is never the same document as another
 *  mémoire's. */
export async function pickAndImportContent(memoireId: string): Promise<ContentRef | null> {
  const sourcePath = await window.api.dialogs.pickDocx()
  if (!sourcePath) return null
  return window.api.memoires.importContent(memoireId, sourcePath)
}

/** Shared by every place that lets the user start a content from a blank page. `level` est
 *  la profondeur du chapitre (1 au premier niveau) : le document vierge naît alors avec le
 *  retrait que l'assemblage appliquera, donc avec l'aspect qu'il aura dans le mémoire.
 *  Une page de garde n'en a pas. */
export async function createBlankContent(
  memoireId: string,
  level?: number
): Promise<ContentRef> {
  return window.api.memoires.createBlankContent(memoireId, level)
}
