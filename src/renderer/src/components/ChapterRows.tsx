import ContentSlot from './ContentSlot'
import type { ChapterNode, ContentRef, Orientation } from '../../../shared/types'

export interface ChapterActions {
  onTitleChange: (id: string, title: string) => void
  onContentChange: (id: string, content: ContentRef | null) => void
  onPageBreakChange: (id: string, value: boolean) => void
  onOrientationChange: (id: string, orientation: Orientation) => void
  onAddChild: (id: string) => void
  onRemove: (id: string) => void
  onMove: (id: string, delta: number) => void
}

/**
 * Renders the chapter tree as a flat, indented list of rows. A flat list (rather than
 * nested boxes) keeps deep plans readable and makes every row's controls line up.
 */
export default function ChapterRows({
  nodes,
  actions,
  prefix = [],
  depth = 0
}: {
  nodes: ChapterNode[]
  actions: ChapterActions
  prefix?: number[]
  depth?: number
}): JSX.Element {
  return (
    <>
      {nodes.map((node, index) => {
        const numbering = [...prefix, index + 1]
        return (
          <div key={node.id}>
            <div className="chapter-row" style={{ paddingLeft: 8 + depth * 22 }}>
              <span className="chapter-number">{numbering.join('.')}</span>

              <input
                className="chapter-title"
                type="text"
                value={node.title}
                onChange={(e) => actions.onTitleChange(node.id, e.target.value)}
                placeholder="Titre du chapitre"
              />

              <ContentSlot
                content={node.content}
                onChange={(content) => actions.onContentChange(node.id, content)}
                compact
              />

              <label className="chapter-flag" title="Commencer ce chapitre sur une nouvelle page">
                <input
                  type="checkbox"
                  checked={node.pageBreakBefore}
                  onChange={(e) => actions.onPageBreakChange(node.id, e.target.checked)}
                />
                nouvelle page
              </label>

              <select
                className="chapter-orientation"
                title="Orientation des pages de ce chapitre"
                value={node.orientation ?? 'portrait'}
                onChange={(e) => actions.onOrientationChange(node.id, e.target.value as Orientation)}
              >
                <option value="portrait">Portrait</option>
                <option value="paysage">Paysage</option>
              </select>

              <span className="chapter-actions">
                <button className="icon-btn" title="Ajouter un sous-chapitre" onClick={() => actions.onAddChild(node.id)}>
                  +
                </button>
                <button className="icon-btn" title="Monter" onClick={() => actions.onMove(node.id, -1)} disabled={index === 0}>
                  ↑
                </button>
                <button
                  className="icon-btn"
                  title="Descendre"
                  onClick={() => actions.onMove(node.id, 1)}
                  disabled={index === nodes.length - 1}
                >
                  ↓
                </button>
                <button className="icon-btn danger-link" title="Supprimer" onClick={() => actions.onRemove(node.id)}>
                  ✕
                </button>
              </span>
            </div>

            {node.children.length > 0 && (
              <ChapterRows
                nodes={node.children}
                actions={actions}
                prefix={numbering}
                depth={depth + 1}
              />
            )}
          </div>
        )
      })}
    </>
  )
}
