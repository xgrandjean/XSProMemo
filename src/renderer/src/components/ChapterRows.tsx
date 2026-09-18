import { useRef, useState } from 'react'
import DropdownMenu, { type DropdownMenuItem } from './DropdownMenu'
import { createBlankContent, pickAndImportContent } from '../lib/pickContent'
import { describeError } from '../lib/describeError'
import type { ChapterNode, ContentRef, Orientation } from '../../../shared/types'

export interface ChapterActions {
  /** The mémoire being edited. Carried here rather than as a prop because `ChapterRows`
   *  renders itself recursively for sub-chapters: anything added to the props has to be
   *  forwarded by hand at every level, while this object already travels down untouched. */
  memoireId: string
  onTitleChange: (id: string, title: string) => void
  onContentChange: (id: string, content: ContentRef | null) => void
  onPageBreakChange: (id: string, value: boolean) => void
  onOrientationChange: (id: string, orientation: Orientation) => void
  onAddChild: (id: string) => void
  onInsertBefore: (id: string) => void
  onRemove: (id: string) => void
  onMove: (id: string, delta: number) => void
  onValidatedChange: (id: string, value: boolean) => void
  onValidatedChangeDeep: (id: string, value: boolean) => void
  onDuplicate: (id: string) => void
}

type MenuAnchor = 'trigger' | { x: number; y: number }

/** Form controls keep their own native right-click menu (cut/copy/paste, spellcheck). */
function hasNativeContextMenu(target: EventTarget | null): boolean {
  return target instanceof HTMLElement ? !!target.closest('input, select, textarea') : false
}

function ChapterRow({
  node,
  index,
  siblingCount,
  numbering,
  depth,
  actions,
  collapsedIds,
  onToggleCollapse,
  activeId,
  onActivate
}: {
  node: ChapterNode
  index: number
  siblingCount: number
  numbering: number[]
  depth: number
  actions: ChapterActions
  collapsedIds: Set<string>
  onToggleCollapse: (id: string) => void
  activeId: string | null
  onActivate: (id: string) => void
}): JSX.Element {
  const hasChildren = node.children.length > 0
  const collapsed = collapsedIds.has(node.id)
  const numberLabel = numbering.join('.')
  const addChildLabel = `Ajouter sous-chapitre ${numberLabel}.${node.children.length + 1}`
  const numberLevel = Math.min(depth, 2)

  const [menu, setMenu] = useState<MenuAnchor | null>(null)
  const [contentError, setContentError] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  async function pick(): Promise<void> {
    setContentError(null)
    onActivate(node.id)
    try {
      const picked = await pickAndImportContent(actions.memoireId)
      if (picked) actions.onContentChange(node.id, picked)
    } catch (err) {
      setContentError(describeError(err))
    }
  }

  async function createBlank(): Promise<void> {
    setContentError(null)
    onActivate(node.id)
    try {
      actions.onContentChange(node.id, await createBlankContent(actions.memoireId))
    } catch (err) {
      setContentError(describeError(err))
    }
  }

  const content = node.content
  const pageBreakBefore = node.pageBreakBefore
  const validated = node.validated ?? false
  const items: DropdownMenuItem[] = [
    ...(content
      ? [
          { label: 'Ouvrir contenu', onSelect: () => window.api.memoires.openContent(content.file) },
          { label: 'Remplacer contenu', onSelect: pick },
          { label: 'Retirer contenu', onSelect: () => actions.onContentChange(node.id, null), danger: true }
        ]
      : [
          { label: 'Ajouter contenu', onSelect: pick },
          { label: 'Ajouter contenu vide', onSelect: createBlank }
        ]),
    {
      label: pageBreakBefore ? 'Ne plus commencer sur une nouvelle page' : 'Commencer sur une nouvelle page',
      onSelect: () => {
        onActivate(node.id)
        actions.onPageBreakChange(node.id, !pageBreakBefore)
      },
      separatorBefore: true
    },
    {
      label: validated ? 'Marquer non validé' : 'Marquer validé',
      onSelect: () => {
        onActivate(node.id)
        actions.onValidatedChange(node.id, !validated)
      }
    },
    ...(hasChildren
      ? [
          {
            label: validated
              ? 'Démarquer le chapitre et ses sous-chapitres'
              : 'Marquer le chapitre et ses sous-chapitres',
            onSelect: () => {
              onActivate(node.id)
              actions.onValidatedChangeDeep(node.id, !validated)
            }
          }
        ]
      : []),
    {
      label: 'Dupliquer ce chapitre',
      onSelect: () => {
        onActivate(node.id)
        actions.onDuplicate(node.id)
      }
    },
    {
      label: addChildLabel,
      onSelect: () => {
        onActivate(node.id)
        actions.onAddChild(node.id)
      },
      separatorBefore: true
    },
    {
      label: 'Insérer chapitre avant',
      onSelect: () => {
        onActivate(node.id)
        actions.onInsertBefore(node.id)
      }
    }
  ]

  return (
    <div>
      <div
        className={`chapter-row${activeId === node.id ? ' active-row' : ''}`}
        style={{ paddingLeft: 8 + depth * 22 }}
        // A right-click anywhere on the row always reaches every action (content and
        // "ajouter sous-chapitre" alike) — the trigger button only covers the common
        // case. Form controls keep their own native menu.
        onContextMenu={(e) => {
          if (hasNativeContextMenu(e.target)) return
          e.preventDefault()
          onActivate(node.id)
          setMenu({ x: e.clientX, y: e.clientY })
        }}
      >
        <button
          className="icon-btn"
          title={collapsed ? 'Déplier' : 'Replier'}
          onClick={() => onToggleCollapse(node.id)}
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          {collapsed ? '▸' : '▾'}
        </button>

        <span className={`chapter-number level-${numberLevel}`}>{numberLabel}</span>

        <input
          className="chapter-title"
          type="text"
          value={node.title}
          onChange={(e) => actions.onTitleChange(node.id, e.target.value)}
          onFocus={() => onActivate(node.id)}
          placeholder="Titre du chapitre"
        />

        <span className="content-slot">
          {content ? (
            <button
              ref={triggerRef}
              className="icon-btn"
              title="Actions sur ce contenu"
              onClick={() => {
                onActivate(node.id)
                setMenu('trigger')
              }}
            >
              👁
            </button>
          ) : (
            <button
              ref={triggerRef}
              className="link"
              title="Actions sur ce chapitre"
              onClick={() => {
                onActivate(node.id)
                setMenu('trigger')
              }}
            >
              + contenu
            </button>
          )}
          {pageBreakBefore && (
            <span className="row-badge" title="Commence sur une nouvelle page">
              📄
            </span>
          )}
          {validated && (
            <span className="row-badge row-badge-ok" title="Marqué validé">
              ✓
            </span>
          )}
          {contentError && <span className="error-text">{contentError}</span>}
        </span>

        <select
          className="chapter-orientation"
          title="Orientation des pages de ce chapitre"
          value={node.orientation ?? 'portrait'}
          onChange={(e) => {
            onActivate(node.id)
            actions.onOrientationChange(node.id, e.target.value as Orientation)
          }}
        >
          <option value="portrait">Portrait</option>
          <option value="paysage">Paysage</option>
        </select>

        <span className="chapter-actions">
          <button
            className="icon-btn"
            title="Monter"
            onClick={() => {
              onActivate(node.id)
              actions.onMove(node.id, -1)
            }}
            disabled={index === 0}
          >
            ↑
          </button>
          <button
            className="icon-btn"
            title="Descendre"
            onClick={() => {
              onActivate(node.id)
              actions.onMove(node.id, 1)
            }}
            disabled={index === siblingCount - 1}
          >
            ↓
          </button>
          <button
            className="icon-btn danger-link"
            title="Supprimer"
            onClick={() => actions.onRemove(node.id)}
          >
            ✕
          </button>
        </span>

        {menu && (
          <DropdownMenu anchor={menu} triggerRef={triggerRef} items={items} onClose={() => setMenu(null)} />
        )}
      </div>

      {hasChildren && !collapsed && (
        <ChapterRows
          nodes={node.children}
          actions={actions}
          prefix={numbering}
          depth={depth + 1}
          collapsedIds={collapsedIds}
          onToggleCollapse={onToggleCollapse}
          activeId={activeId}
          onActivate={onActivate}
        />
      )}
    </div>
  )
}

/**
 * Renders the chapter tree as a flat, indented list of rows. A flat list (rather than
 * nested boxes) keeps deep plans readable and makes every row's controls line up.
 */
export default function ChapterRows({
  nodes,
  actions,
  prefix = [],
  depth = 0,
  collapsedIds,
  onToggleCollapse,
  activeId,
  onActivate
}: {
  nodes: ChapterNode[]
  actions: ChapterActions
  prefix?: number[]
  depth?: number
  collapsedIds: Set<string>
  onToggleCollapse: (id: string) => void
  activeId: string | null
  onActivate: (id: string) => void
}): JSX.Element {
  return (
    <>
      {nodes.map((node, index) => (
        <ChapterRow
          key={node.id}
          node={node}
          index={index}
          siblingCount={nodes.length}
          numbering={[...prefix, index + 1]}
          depth={depth}
          actions={actions}
          collapsedIds={collapsedIds}
          onToggleCollapse={onToggleCollapse}
          activeId={activeId}
          onActivate={onActivate}
        />
      ))}
    </>
  )
}
