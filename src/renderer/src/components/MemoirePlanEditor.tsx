import { useEffect, useRef, useState } from 'react'
import ChapterRows, { type ChapterActions } from './ChapterRows'
import ContentSlot from './ContentSlot'
import { HelpButton } from './Help'
import { CoverHelp, LogoHelp, PlanHelp } from './HelpTexts'
import { addChild, moveNode, newChapter, removeNode, updateNode } from '../lib/chapterTree'
import type { ContentRef, Memoire } from '../../../shared/types'

const AUTOSAVE_DELAY_MS = 700

/**
 * The plan of one mémoire, editable in place. Used both for real mémoires and for the
 * example behind the configuration screen — they are the same kind of object.
 */
export default function MemoirePlanEditor({
  memoire,
  onSaved
}: {
  memoire: Memoire
  onSaved?: (saved: Memoire) => void
}): JSX.Element {
  const [draft, setDraft] = useState<Memoire>(memoire)
  const [status, setStatus] = useState<'saved' | 'saving' | 'dirty'>('saved')
  const [error, setError] = useState<string | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoBusy, setLogoBusy] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(draft)

  useEffect(() => {
    setDraft(memoire)
    latest.current = memoire
    setStatus('saved')
  }, [memoire.id])

  // The logo is saved server-side the moment it changes, unlike the rest of the plan:
  // it bypasses the autosave timer entirely, so its own preview is fetched separately.
  useEffect(() => {
    let cancelled = false
    window.api.memoires.logoPreview(memoire.id).then((preview) => {
      if (!cancelled) setLogoPreview(preview)
    })
    return () => {
      cancelled = true
    }
  }, [memoire.id])

  async function chooseLogo(): Promise<void> {
    const imagePath = await window.api.dialogs.pickImage()
    if (!imagePath) return
    setLogoError(null)
    setLogoBusy(true)
    try {
      await window.api.memoires.setLogo(memoire.id, imagePath)
      setLogoPreview(await window.api.memoires.logoPreview(memoire.id))
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : String(err))
    } finally {
      setLogoBusy(false)
    }
  }

  async function clearLogo(): Promise<void> {
    setLogoError(null)
    setLogoBusy(true)
    try {
      await window.api.memoires.clearLogo(memoire.id)
      setLogoPreview(null)
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : String(err))
    } finally {
      setLogoBusy(false)
    }
  }

  function edit(mutate: (current: Memoire) => Memoire): void {
    setDraft((current) => {
      const next = mutate(current)
      latest.current = next
      return next
    })
    setStatus('dirty')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(save, AUTOSAVE_DELAY_MS)
  }

  async function save(): Promise<void> {
    setStatus('saving')
    setError(null)
    try {
      const saved = await window.api.memoires.save(latest.current)
      latest.current = saved
      setDraft((current) => ({ ...current, updatedAt: saved.updatedAt }))
      setStatus('saved')
      onSaved?.(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus('dirty')
    }
  }

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

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
        <div className="field">
          <div className="row">
            <div className="logo-preview">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo de ce mémoire" />
              ) : (
                <span className="muted">Aucun logo</span>
              )}
            </div>
            <button className="primary" onClick={chooseLogo} disabled={logoBusy}>
              {logoPreview ? 'Remplacer le logo' : 'Choisir un logo'}
            </button>
            {logoPreview && (
              <button className="danger" onClick={clearLogo} disabled={logoBusy}>
                Retirer
              </button>
            )}
          </div>
          {logoError && <p className="error-text">{logoError}</p>}
        </div>
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

        <ChapterRows nodes={draft.chapters} actions={actions} />

        <button
          className="secondary"
          style={{ marginTop: 12 }}
          onClick={() => edit((m) => ({ ...m, chapters: [...m.chapters, newChapter()] }))}
        >
          + Ajouter un chapitre
        </button>
      </div>

      <div className="save-status">
        {status === 'saving' && <span className="muted">Enregistrement...</span>}
        {status === 'saved' && <span className="muted">Enregistré</span>}
        {status === 'dirty' && <span className="muted">Modifications en attente...</span>}
        {error && <span className="error-text">{error}</span>}
      </div>
    </div>
  )
}
