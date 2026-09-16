import type { ContentRef } from '../../../shared/types'

/** Shared by every place that lets the user attach a Word file as content. */
export async function pickAndImportContent(): Promise<ContentRef | null> {
  const sourcePath = await window.api.dialogs.pickDocx()
  if (!sourcePath) return null
  return window.api.memoires.importContent(sourcePath)
}

/** Shared by every place that lets the user start a content from a blank page. */
export async function createBlankContent(): Promise<ContentRef> {
  return window.api.memoires.createBlankContent()
}
