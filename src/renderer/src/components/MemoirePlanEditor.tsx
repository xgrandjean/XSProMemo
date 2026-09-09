import { useState } from 'react'
import ChapterRows, { type ChapterActions } from './ChapterRows'
import ContentSlot from './ContentSlot'
import LogoPicker from './LogoPicker'
import { HelpButton } from './Help'
import { CoverHelp, LogoHelp, PlanHelp } from './HelpTexts'
import { addChild, insertBefore, moveNode, newChapter, removeNode, updateNode } from '../lib/chapterTree'
import type { ContentRef, Memoire } from '../../../shared/types'

/**
 * The plan of one mémoire, editable in place. Used both for real mémoires and for the
 * example behind the configuration screen — they are the same kind of object.
 *
 * Purely controlled: the draft itself and when it gets saved are owned by the caller
 * (MemoireEditorPage), so the mémoire's name field and its plan share one save action.
 */
export default function MemoirePlanEditor({
  draft,
  edit
}: {
  draft: Memoire
  edit: (mutate: (current: Memoire) => Memoire) => void
}): JSX.Element {
  // Purely a display preference: not part of the plan, never saved with it.
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  function toggleCollapse(id: string): void {
    setCollapsedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const actions: ChapterActions = {
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
    onAddChild: (id) => edit((m) => ({ ...m, chapters: addChild(m.chapters, id) })),
    onInsertBefore: (id) => edit((m) => ({ ...m, chapters: insertBefore(m.chapters, id) })),
    onRemove: (id) => edit((m) => ({ ...m, chapters: removeNode(m.chapters, id) })),
    onMove: (id, delta) => edit((m) => ({ ...m, chapters: moveNode(m.chapters, id, delta) }))
  }

  function setCoverPage(index: number, content: ContentRef | null): void {
    edit((m) => {
      const coverPages = [...m.coverPages]
      if (content) coverPages[index] = content
      else coverPages.splice(index, 1)
      return { ...m, coverPages }
    })
  }

  function addCoverPage(content: ContentRef | null): void {
    if (!content) return
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
          <div className="cover-row" key={`${cover.file}-${index}`}>
            <span className="muted">Page {index + 1}</span>
            <ContentSlot content={cover} onChange={(c) => setCoverPage(index, c)} />
          </div>
        ))}
        <div className="cover-row">
          <ContentSlot
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
        </div>

        {draft.chapters.length === 0 && <p className="muted">Aucun chapitre.</p>}

        <ChapterRows
          nodes={draft.chapters}
          actions={actions}
          collapsedIds={collapsedIds}
          onToggleCollapse={toggleCollapse}
        />

        <button
          className="secondary"
          style={{ marginTop: 12 }}
          onClick={() => edit((m) => ({ ...m, chapters: [...m.chapters, newChapter()] }))}
        >
          + Ajouter un chapitre
        </button>
      </div>
    </div>
  )
}
