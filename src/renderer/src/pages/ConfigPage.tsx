import { useEffect, useState } from 'react'
import MemoirePlanEditor from '../components/MemoirePlanEditor'
import { HelpButton } from '../components/Help'
import { GabaritHelp, ExempleHelp } from '../components/HelpTexts'
import type { Memoire, ModelConfig } from '../../../shared/types'

export default function ConfigPage({ onBack }: { onBack: () => void }): JSX.Element {
  const [config, setConfig] = useState<ModelConfig | null>(null)
  const [sommaireTitle, setSommaireTitle] = useState('')
  const [example, setExample] = useState<Memoire | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.model.get().then((c) => {
      setConfig(c)
      setSommaireTitle(c.sommaireTitle)
    })
    window.api.model
      .ensureExample()
      .then((id) => window.api.memoires.get(id))
      .then(setExample)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  async function chooseTemplate(): Promise<void> {
    setError(null)
    const filePath = await window.api.dialogs.pickDocx()
    if (!filePath) return
    setBusy(true)
    try {
      setConfig(await window.api.model.setTemplate(filePath))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function saveSommaireTitle(): Promise<void> {
    if (!config || sommaireTitle.trim() === config.sommaireTitle) return
    setConfig(await window.api.model.setSommaireTitle(sommaireTitle))
  }

  if (!config) return <p className="muted">Chargement...</p>

  return (
    <div>
      <div className="editor-head">
        <button className="secondary" onClick={onBack}>
          ← Mes mémoires
        </button>
        <h1 style={{ margin: 0, flex: 1 }}>Configuration</h1>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Gabarit</h2>
          <HelpButton title="Le gabarit">
            <GabaritHelp />
          </HelpButton>
          <span className="muted">
            Le document Word qui porte votre présentation : styles, logo en en-tête, pied de
            page, marges. Aucun contenu.
          </span>
        </div>

        <div className="field">
          <label>Fichier Word</label>
          <div>{config.templatePath ?? <span className="muted">Aucun gabarit choisi</span>}</div>
        </div>
        <div className="row">
          <button className="primary" onClick={chooseTemplate} disabled={busy}>
            Choisir un gabarit
          </button>
          {config.templatePath && (
            <button
              className="secondary"
              onClick={() => window.api.shell.openPath(config.templatePath as string)}
            >
              Ouvrir dans Word
            </button>
          )}
        </div>

        <div className="field" style={{ maxWidth: 320, marginTop: 16 }}>
          <label>Titre de la page de sommaire</label>
          <input
            type="text"
            value={sommaireTitle}
            onChange={(e) => setSommaireTitle(e.target.value)}
            onBlur={saveSommaireTitle}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </div>

        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="panel-head" style={{ marginTop: 24 }}>
        <h2>Mémoire exemple</h2>
        <HelpButton title="Le mémoire exemple">
          <ExempleHelp />
        </HelpButton>
        <span className="muted">
          Le point de départ de chaque nouveau mémoire. Mettez-y un plan représentatif.
        </span>
      </div>

      {example ? (
        <MemoirePlanEditor memoire={example} onSaved={setExample} />
      ) : (
        <p className="muted">Chargement de l&apos;exemple...</p>
      )}
    </div>
  )
}
