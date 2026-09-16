import type { ChapterNode } from '../../../shared/types'

export function newChapter(title = 'Nouveau chapitre', id: string = crypto.randomUUID()): ChapterNode {
  return {
    id,
    title,
    pageBreakBefore: false,
    orientation: 'portrait',
    content: null,
    children: [],
    validated: false
  }
}

export function updateNode(
  nodes: ChapterNode[],
  id: string,
  updater: (node: ChapterNode) => ChapterNode
): ChapterNode[] {
  return nodes.map((node) => {
    if (node.id === id) return updater(node)
    if (node.children.length === 0) return node
    return { ...node, children: updateNode(node.children, id, updater) }
  })
}

export function removeNode(nodes: ChapterNode[], id: string): ChapterNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) =>
      node.children.length === 0 ? node : { ...node, children: removeNode(node.children, id) }
    )
}

/** Moves a node up or down among its own siblings, leaving its depth unchanged. */
export function moveNode(nodes: ChapterNode[], id: string, delta: number): ChapterNode[] {
  const index = nodes.findIndex((node) => node.id === id)
  if (index !== -1) {
    const target = index + delta
    if (target < 0 || target >= nodes.length) return nodes
    const next = [...nodes]
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  }
  return nodes.map((node) =>
    node.children.length === 0 ? node : { ...node, children: moveNode(node.children, id, delta) }
  )
}

export function addChild(nodes: ChapterNode[], parentId: string, newId?: string): ChapterNode[] {
  return updateNode(nodes, parentId, (node) => ({
    ...node,
    children: [...node.children, newChapter('Nouveau sous-chapitre', newId)]
  }))
}

/** Inserts a new sibling chapter right before the given one, at the same depth. */
export function insertBefore(nodes: ChapterNode[], id: string, newId?: string): ChapterNode[] {
  const index = nodes.findIndex((node) => node.id === id)
  if (index !== -1) {
    const next = [...nodes]
    next.splice(index, 0, newChapter(undefined, newId))
    return next
  }
  return nodes.map((node) =>
    node.children.length === 0 ? node : { ...node, children: insertBefore(node.children, id, newId) }
  )
}

/** Deep-copies a node's subtree with fresh ids, stripping every attached content file:
 *  a duplicate is a starting point for its own writing, not a second door onto the
 *  original's Word file. */
function cloneWithoutContent(node: ChapterNode): ChapterNode {
  return {
    ...node,
    id: crypto.randomUUID(),
    content: null,
    children: node.children.map(cloneWithoutContent)
  }
}

/** Duplicates a chapter and its whole subtree, without its content files, right after
 *  the original among its siblings. `newId` (when given) becomes the copy's own id, so
 *  the caller can know it ahead of time — e.g. to highlight the new row. */
export function duplicateChapter(nodes: ChapterNode[], id: string, newId?: string): ChapterNode[] {
  const index = nodes.findIndex((node) => node.id === id)
  if (index !== -1) {
    const copy = {
      ...cloneWithoutContent(nodes[index]),
      id: newId ?? crypto.randomUUID(),
      title: `${nodes[index].title} (copie)`
    }
    const next = [...nodes]
    next.splice(index + 1, 0, copy)
    return next
  }
  return nodes.map((node) =>
    node.children.length === 0 ? node : { ...node, children: duplicateChapter(node.children, id, newId) }
  )
}

/** Sets `validated` on a chapter and every one of its descendants at once — the "mark the
 *  whole section done" bulk action, as opposed to toggling a single chapter. */
export function setValidatedDeep(nodes: ChapterNode[], id: string, value: boolean): ChapterNode[] {
  function markAll(node: ChapterNode): ChapterNode {
    return { ...node, validated: value, children: node.children.map(markAll) }
  }
  return nodes.map((node) => {
    if (node.id === id) return markAll(node)
    if (node.children.length === 0) return node
    return { ...node, children: setValidatedDeep(node.children, id, value) }
  })
}

/** Same numbering the generator bakes into the Word headings, shown live in the editor. */
export function chapterNumber(prefix: number[]): string {
  return prefix.join('.')
}
