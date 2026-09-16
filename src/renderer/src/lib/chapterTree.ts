import type { ChapterNode } from '../../../shared/types'

export function newChapter(title = 'Nouveau chapitre', id: string = crypto.randomUUID()): ChapterNode {
  return {
    id,
    title,
    pageBreakBefore: false,
    orientation: 'portrait',
    content: null,
    children: []
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

/** Same numbering the generator bakes into the Word headings, shown live in the editor. */
export function chapterNumber(prefix: number[]): string {
  return prefix.join('.')
}
