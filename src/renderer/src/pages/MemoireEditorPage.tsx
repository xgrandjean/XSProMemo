import { useEffect, useRef, useState } from 'react'
import MemoirePlanEditor from '../components/MemoirePlanEditor'
import GenerationDialog from '../components/GenerationDialog'
import type { GenerationProgressEvent, GenerationResult, Memoire } from '../../../shared/types'

/**
 * Owns the mémoire's draft: nothing here is persisted until "Enregistrer" is clicked
 * (or "Générer" saves it first) — there is no autosave. Everything editable in this
 * screen (the name field below, and the whole plan inside MemoirePlanEditor) goes
 * through the same `edit()`/`save()` pair, so a rename can never race ahead of or
 * discard a more recent plan edit.
 */
export default function MemoireEditorPage({
  memoireId,
  onBack,
  onDirtyChange
}: {
  memoireId: string
  onBack: () => void
  onDirtyChange?: (dirty: boolean) => void
}): JSX.Element {
  const [draft, setDraft] = useState<Memoire | null>(null)
  const [status, setStatus] = useState<'saved' | 'saving' | 'dirty'>('saved')
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [steps, setSteps] = useState<string[]>([])
  const [result, setResult] = useState<GenerationResult | null>(null)
  const latest = useRef<Memoire | null>(null)

  useEffect(() => {
    window.api.memoires.get(memoireId).then((m) => {
      setDraft(m)
      latest.current = m
      setStatus('saved')
    })
  }, [memoireId])

  useEffect(() => {
    onDirtyChange?.(status !== 'saved')
  }, [status, onDirtyChange])

  useEffect(() => {
    return window.api.generation.onProgress((event: GenerationProgressEvent) => {
      if (event.memoireId !== memoireId) return
      setSteps((previous) => [...previous, event.message])
    })
  }, [memoireId])

  function edit(mutate: (current: Memoire) => Memoire): void {
    setDraft((current) => {
      if (!current) return current
      const next = mutate(current)
      latest.current = next
      return next
    })
    setStatus('dirty')
  }

  async function save(): Promise<Memoire> {
    if (!latest.current) throw new Error('Aucun mémoire chargé')
    setStatus('saving')
    setError(null)
    try {
      const saved = await window.api.memoires.save(latest.current)
      latest.current = saved
      setDraft(saved)
      setStatus('saved')
      return saved
    } catch (err) {
      setStatus('dirty')
      setError(err instanceof Error ? err.message : String(err))
      throw err
    }
  }

  async function generate(): Promise<void> {
    setError(null)
    setResult(null)
    setSteps([])
    setDialogOpen(true)
    setGenerating(true)
    try {
      if (status !== 'saved') await save()
      setResult(await window.api.generation.run(memoireId))
      const refreshed = await window.api.memoires.get(memoireId)
      latest.current = refreshed
      setDraft(refreshed)
      setStatus('saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
    }
  }

  if (!draft) return <p className="muted">Chargement...</p>

  return (
    <div>
      <div className="editor-head">
        <button className="secondary" onClick={onBack}>
          ← Mes mémoires
        </button>
        <input
          className="memoire-name"
          type="text"
          value={draft.name}
          onChange={(e) => edit((m) => ({ ...m, name: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        {draft.lastGeneratedAt && draft.outputPdf && !dialogOpen && (
          <button
            className="secondary"
            onClick={() => window.api.shell.openPath(draft.outputPdf as string)}
          >
            Ouvrir le dernier PDF
          </button>
        )}
        <button className="primary" onClick={() => void save()} disabled={status !== 'dirty'}>
          Enregistrer
        </button>
        <span className="save-status save-status--inline">
          {status === 'saving' && <span className="muted">Enregistrement...</span>}
          {status === 'saved' && <span className="muted">Enregistré</span>}
          {status === 'dirty' && <span className="muted">Modifications non enregistrées</span>}
          {error && <span className="error-text">{error}</span>}
        </span>
        <button className="primary" onClick={generate} disabled={generating}>
          {generating ? 'Génération...' : 'Générer'}
        </button>
      </div>

      <MemoirePlanEditor draft={draft} edit={edit} />

      {dialogOpen && (
        <GenerationDialog
          running={generating}
          steps={steps}
          result={result}
          error={error}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  )
}
