import { useState } from 'react'
import ChapterRows, { type ChapterActions } from './ChapterRows'
import ContentSlot from './ContentSlot'
import LogoPicker from './LogoPicker'
import Toast from './Toast'
import { HelpButton } from './Help'
import { CoverHelp, LogoHelp, PlanHelp } from './HelpTexts'
import { buildWordAiInstructions } from '../lib/aiInstructions'
import { describeError } from '../lib/describeError'
import { useAiMode } from '../lib/aiMode'
import {
  addChild,
  duplicateChapter,
  insertBefore,
  moveNode,
  newChapter,
  removeNode,
  setValidatedDeep,
  updateNode
} from '../lib/chapterTree'
import type { ChapterNode, ContentRef, Memoire } from '../../../shared/types'

/** Le fichier attaché à un chapitre, retrouvé n'importe où dans l'arbre. */
function findContentFile(memoire: Memoire, chapterId: string): string | null {
  function walk(nodes: ChapterNode[]): string | null {
    for (const node of nodes) {
      if (node.id === chapterId) return node.content?.file ?? null
      const found = walk(node.children)
      if (found) return found
    }
    return null
  }
  return walk(memoire.chapters)
}

/**
 * The plan of one mémoire, editable in place. Used both for real mémoires and for the
 * example behind the configuration screen — they are the same kind of object.
 *
 * Purely controlled: the draft itself and when it gets saved are owned by the caller
 * (MemoireEditorPage), so the mémoire's name field and its plan share one save action.
 */
export default function MemoirePlanEditor({
  draft,
  edit,
  generalNotes = '',
  onRefresh
}: {
  draft: Memoire
  edit: (mutate: (current: Memoire) => Memoire) => void
  /** Les consignes generales de redaction, ajoutees a la fin de la consigne pour Claude. */
  generalNotes?: string
  /** Relit le mémoire sur le disque — après qu'une IA y a touché, par exemple. */
  onRefresh?: () => void
}): JSX.Element {
  const aiMode = useAiMode()
  const [toast, setToast] = useState<string | null>(null)

  /** Le geste complet en un clic : la consigne dans le presse-papiers, le fichier ouvert
   *  dans Word. Il ne reste qu'a coller dans Claude. */
  async function copyWordPrompt(chapterId: string): Promise<void> {
    const file = findContentFile(draft, chapterId)
    try {
      await navigator.clipboard.writeText(buildWordAiInstructions(draft, chapterId, generalNotes))
      if (file) await window.api.memoires.openContent(file)
      setToast('Consigne copiée. Le contenu s’ouvre dans Word : collez-la dans Claude.')
    } catch (err) {
      setToast(describeError(err))
    }
  }

  // Purely a display preference: not part of the plan, never saved with it.
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  // The row last acted on (chapter id, or `cover-<index>`) — kept highlighted so it stays
  // easy to find again after an action that adds a row below it or opens Word elsewhere.
  const [activeId, setActiveId] = useState<string | null>(null)

  function toggleCollapse(id: string): void {
    setCollapsedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const actions: ChapterActions = {
    memoireId: draft.id,
    aiMode,
    onCopyWordPrompt: (id) => void copyWordPrompt(id),
    onTitleChange: (id, title) =>
      edit((m) => ({ ...m, chapters: updateNode(m.chapters, id, (n) => ({ ...n, title })) })),
    onContentChange: (id, content) =>
      edit((m) => ({ ...m, chapters: updateNode(m.chapters, id, (n) => ({ ...n, content })) })),
    onPageBreakChange: (id, pageBreakBefore) =>
      edit((m) => ({
        ...m,
        chapters: updateNode(m.chapters, id, (n) => ({ ...n, pageBreakBefore }))
      })),
    onOrientationChange: (id, orientation) =>
      edit((m) => ({
        ...m,
        chapters: updateNode(m.chapters, id, (n) => ({ ...n, orientation }))
      })),
    onAddChild: (id) => {
      const newId = crypto.randomUUID()
      setActiveId(newId)
      edit((m) => ({ ...m, chapters: addChild(m.chapters, id, newId) }))
    },
    onInsertBefore: (id) => {
      const newId = crypto.randomUUID()
      setActiveId(newId)
      edit((m) => ({ ...m, chapters: insertBefore(m.chapters, id, newId) }))
    },
    onRemove: (id) => {
      setActiveId((current) => (current === id ? null : current))
      edit((m) => ({ ...m, chapters: removeNode(m.chapters, id) }))
    },
    onMove: (id, delta) => edit((m) => ({ ...m, chapters: moveNode(m.chapters, id, delta) })),
    onValidatedChange: (id, validated) =>
      edit((m) => ({ ...m, chapters: updateNode(m.chapters, id, (n) => ({ ...n, validated })) })),
    onValidatedChangeDeep: (id, validated) =>
      edit((m) => ({ ...m, chapters: setValidatedDeep(m.chapters, id, validated) })),
    onDuplicate: (id) => {
      const newId = crypto.randomUUID()
      setActiveId(newId)
      edit((m) => ({ ...m, chapters: duplicateChapter(m.chapters, id, newId) }))
    }
  }

  function setCoverPage(index: number, content: ContentRef | null): void {
    setActiveId(`cover-${index}`)
    edit((m) => {
      const coverPages = [...m.coverPages]
      if (content) coverPages[index] = content
      else coverPages.splice(index, 1)
      return { ...m, coverPages }
    })
  }

  function addCoverPage(content: ContentRef | null): void {
    if (!content) return
    setActiveId(`cover-${draft.coverPages.length}`)
    edit((m) => ({ ...m, coverPages: [...m.coverPages, content] }))
  }

  return (
    <div>
      <div className="panel">
        <div className="panel-head">
          <h2>Logo</h2>
          <HelpButton title="Le logo de ce mémoire">
            <LogoHelp />
          </HelpButton>
          <span className="muted">
            Propre à ce mémoire : le changer ici n&apos;affecte ni le gabarit, ni les
            autres mémoires.
          </span>
        </div>
        <LogoPicker
          memoireId={draft.id}
          field="logo"
          label="Logo (en haut à droite)"
          altText="Logo de ce mémoire"
        />
        <LogoPicker
          memoireId={draft.id}
          field="secondLogo"
          label="Second logo (en haut à gauche)"
          altText="Second logo de ce mémoire"
        />
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Pages de garde</h2>
          <HelpButton title="Les pages de garde">
            <CoverHelp />
          </HelpButton>
          <span className="muted">
            Placées en tête, sans numéro de page ni entrée au sommaire. Une seule le plus
            souvent ; ajoutez-en une autre s&apos;il y a une pièce distincte à mettre devant.
          </span>
        </div>
        {draft.coverPages.map((cover, index) => (
          <div
            className={`cover-row${activeId === `cover-${index}` ? ' active-row' : ''}`}
            key={`${cover.file}-${index}`}
          >
            <span className="muted">Page {index + 1}</span>
            <ContentSlot
              memoireId={draft.id}
              content={cover}
              onChange={(c) => setCoverPage(index, c)}
            />
          </div>
        ))}
        <div className="cover-row">
          <ContentSlot
            memoireId={draft.id}
            content={null}
            onChange={addCoverPage}
            addLabel={
              draft.coverPages.length === 0
                ? '+ page de garde'
                : '+ une autre page de garde'
            }
          />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Plan</h2>
          <HelpButton title="Le plan du mémoire">
            <PlanHelp />
          </HelpButton>
          <span className="muted">
            Le sommaire et la pagination sont ajoutés automatiquement à la génération.
          </span>
          {onRefresh && (
            <button
              className="icon-btn"
              title="Relire ce mémoire sur le disque — après qu'une IA y a modifié le plan, par exemple"
              onClick={onRefresh}
            >
              ⟳
            </button>
          )}
        </div>

        {draft.chapters.length === 0 && <p className="muted">Aucun chapitre.</p>}

        <ChapterRows
          nodes={draft.chapters}
          actions={actions}
          collapsedIds={collapsedIds}
          onToggleCollapse={toggleCollapse}
          activeId={activeId}
          onActivate={setActiveId}
        />

        <button
          className="secondary"
          style={{ marginTop: 12 }}
          onClick={() => {
            const chapter = newChapter()
            setActiveId(chapter.id)
            edit((m) => ({ ...m, chapters: [...m.chapters, chapter] }))
          }}
        >
          + Ajouter un chapitre
        </button>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
