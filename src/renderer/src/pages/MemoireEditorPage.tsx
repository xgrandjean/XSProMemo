import { useEffect, useState } from 'react'
import MemoirePlanEditor from '../components/MemoirePlanEditor'
import GenerationDialog from '../components/GenerationDialog'
import type { GenerationProgressEvent, GenerationResult, Memoire } from '../../../shared/types'

export default function MemoireEditorPage({
  memoireId,
  onBack
}: {
  memoireId: string
  onBack: () => void
}): JSX.Element {
  const [memoire, setMemoire] = useState<Memoire | null>(null)
  const [name, setName] = useState('')
  const [generating, setGenerating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [steps, setSteps] = useState<string[]>([])
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.memoires.get(memoireId).then((m) => {
      setMemoire(m)
      setName(m.name)
    })
  }, [memoireId])

  useEffect(() => {
    return window.api.generation.onProgress((event: GenerationProgressEvent) => {
      if (event.memoireId !== memoireId) return
      setSteps((previous) => [...previous, event.message])
    })
  }, [memoireId])

  async function renameMemoire(): Promise<void> {
    if (!memoire || name.trim() === memoire.name || !name.trim()) return
    setMemoire(await window.api.memoires.save({ ...memoire, name: name.trim() }))
  }

  async function generate(): Promise<void> {
    setError(null)
    setResult(null)
    setSteps([])
    setDialogOpen(true)
    setGenerating(true)
    try {
      setResult(await window.api.generation.run(memoireId))
      setMemoire(await window.api.memoires.get(memoireId))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setGenerating(false)
    }
  }

  if (!memoire) return <p className="muted">Chargement...</p>

  return (
    <div>
      <div className="editor-head">
        <button className="secondary" onClick={onBack}>
          ← Mes mémoires
        </button>
        <input
          className="memoire-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={renameMemoire}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        {memoire.lastGeneratedAt && memoire.outputPdf && !dialogOpen && (
          <button
            className="secondary"
            onClick={() => window.api.shell.openPath(memoire.outputPdf as string)}
          >
            Ouvrir le dernier PDF
          </button>
        )}
        <button className="primary" onClick={generate} disabled={generating}>
          {generating ? 'Génération...' : 'Générer'}
        </button>
      </div>

      <MemoirePlanEditor memoire={memoire} onSaved={setMemoire} />

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
