import type { ChapterNode, ContentRef, Memoire } from '../../shared/types'

/**
 * Walking a mémoire's plan for the content files it points at, and rewriting those
 * pointers once the files have been copied somewhere else. Kept in its own module because
 * both `memoireStore` (creating a mémoire from another) and `memoireTransfer` (zip export
 * and import) need it, and having either import the other would close a cycle.
 */

/** Every content file a mémoire's plan actually points to — cover pages included. */
export function collectContentFiles(memoire: Memoire): Set<string> {
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
 * A reference left out of `renamed` keeps pointing where it did. Callers that copy files
 * must therefore put *every* reference in the map, including the ones whose file could not
 * be found: leaving one behind would quietly re-establish the sharing the copy exists to
 * break, and nothing downstream would report it.
 */
export function remapContent(
  ref: ContentRef | null,
  renamed: Map<string, string>
): ContentRef | null {
  if (!ref) return null
  return { ...ref, file: renamed.get(ref.file) ?? ref.file }
}

/** Deep-copies a chapter tree, remapping each content reference. `transformNode` lets the
 *  caller change the nodes themselves at the same time (assigning fresh ids, say). */
export function remapChapters(
  nodes: ChapterNode[],
  renamed: Map<string, string>,
  transformNode: (node: ChapterNode) => ChapterNode = (node) => node
): ChapterNode[] {
  return nodes.map((node) => ({
    ...transformNode(node),
    content: remapContent(node.content, renamed),
    children: remapChapters(node.children, renamed, transformNode)
  }))
}

/** The cover pages of a plan, remapped — dropping any that somehow held no reference. */
export function remapCoverPages(
  coverPages: ContentRef[],
  renamed: Map<string, string>
): ContentRef[] {
  return coverPages
    .map((cover) => remapContent(cover, renamed))
    .filter((cover): cover is ContentRef => cover !== null)
}
