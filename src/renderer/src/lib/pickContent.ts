import type { ContentRef } from '../../../shared/types'

/** Shared by every place that lets the user attach a Word file as content. The file is
 *  copied into `memoireId`'s own folder, so it is never the same document as another
 *  mémoire's. */
export async function pickAndImportContent(memoireId: string): Promise<ContentRef | null> {
  const sourcePath = await window.api.dialogs.pickDocx()
  if (!sourcePath) return null
  return window.api.memoires.importContent(memoireId, sourcePath)
}

/** Shared by every place that lets the user start a content from a blank page. */
export async function createBlankContent(memoireId: string): Promise<ContentRef> {
  return window.api.memoires.createBlankContent(memoireId)
}
