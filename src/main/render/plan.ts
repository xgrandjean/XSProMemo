import type { ChapterNode, Orientation } from '../../shared/types'

export interface FlatChapter {
  nodeId: string
  /** Hierarchical number computed here, e.g. "3.2", prefixed onto the heading text. */
  number: string
  title: string
  level: number
  pageBreakBefore: boolean
  orientation: Orientation
  content: ChapterNode['content']
}

/**
 * Walks the chapter tree in document order, numbering as it goes. Numbers are the
 * application's job: the content files hold content only.
 */
export function flattenChapters(
  nodes: ChapterNode[],
  level = 1,
  prefix: number[] = []
): FlatChapter[] {
  const flat: FlatChapter[] = []
  nodes.forEach((node, index) => {
    const numbering = [...prefix, index + 1]
    flat.push({
      nodeId: node.id,
      number: numbering.join('.'),
      title: node.title,
      level: Math.min(level, 9),
      pageBreakBefore: node.pageBreakBefore,
      orientation: node.orientation ?? 'portrait',
      content: node.content
    })
    flat.push(...flattenChapters(node.children, level + 1, numbering))
  })
  return flat
}
