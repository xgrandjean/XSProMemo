import { useEffect, useState } from 'react'
import MemoirePlanEditor from '../components/MemoirePlanEditor'
import { HelpButton } from '../components/Help'
import { GabaritHelp, ExempleHelp } from '../components/HelpTexts'
import type { Memoire, ModelStatus } from '../../../shared/types'

export default function ConfigPage({ onBack }: { onBack: () => void }): JSX.Element {
  const [status, setStatus] = useState<ModelStatus | null>(null)
  const [sommaireTitle, setSommaireTitle] = useState('')
  const [example, setExample] = useState<Memoire | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.model.get().then((s) => {
      setStatus(s)
      setSommaireTitle(s.config.sommaireTitle)
    })
    window.api.model
      .ensureExample()
      .then((id) => window.api.memoires.get(id))
      .then(setExample)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  async function run(action: () => Promise<ModelStatus>): Promise<void> {
    setError(null)
    setBusy(true)
    try {
      setStatus(await action())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function chooseLogo(): Promise<void> {
    const imagePath = await window.api.dialogs.pickImage()
    if (imagePath) await run(() => window.api.model.setLogo(imagePath))
  }

  async function saveSommaireTitle(): Promise<void> {
    if (!status || sommaireTitle.trim() === status.config.sommaireTitle) return
    await run(() => window.api.model.setSommaireTitle(sommaireTitle))
  }

  if (!status) return <p className="muted">Chargement...</p>

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
          <h2>Présentation</h2>
          <HelpButton title="La présentation du document">
            <GabaritHelp />
          </HelpButton>
          <span className="muted">
            Ce qui habille chaque page produite : le logo, les styles, le pied de page.
          </span>
        </div>

        <div className="field">
          <label>Logo en en-tête</label>
          <div className="row">
            {/* Read back from the template header: what is shown is what will print. */}
            <div className="logo-preview">
              {status.logoPreview ? (
                <img src={status.logoPreview} alt="Logo présent dans l'en-tête du gabarit" />
              ) : (
                <span className="muted">Aucun logo</span>
              )}
            </div>
            <span className={`badge ${status.logoPreview ? 'ok' : ''}`}>
              {status.logoPreview ? "En place dans l'en-tête" : "Absent de l'en-tête"}
            </span>
            <button className="primary" onClick={chooseLogo} disabled={busy}>
              {status.logoPreview ? 'Remplacer le logo' : 'Choisir un logo'}
            </button>
            {status.logoPreview && (
              <button
                className="danger"
                disabled={busy}
                onClick={() => run(() => window.api.model.clearLogo())}
              >
                Retirer
              </button>
            )}
          </div>
          <p className="muted" style={{ marginTop: 6 }}>
            L&apos;image est placée dans l&apos;en-tête du gabarit et apparaîtra en haut de
            chaque page numérotée. C&apos;est cet en-tête qui est affiché ici.
          </p>
        </div>

        <div className="field" style={{ maxWidth: 320 }}>
          <label>Titre de la page de sommaire</label>
          <input
            type="text"
            value={sommaireTitle}
            onChange={(e) => setSommaireTitle(e.target.value)}
            onBlur={saveSommaireTitle}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </div>

        <div className="row">
          <button className="secondary" onClick={() => window.api.model.openTemplate()}>
            Ouvrir le gabarit dans Word
          </button>
          <button className="secondary" onClick={() => window.api.model.openDataFolder()}>
            Ouvrir le dossier de l&apos;application
          </button>
        </div>
        <p className="muted" style={{ marginTop: 6 }}>
          Le dossier contient le gabarit, vos fichiers de contenu et les documents générés :{' '}
          <code>{status.dataFolder}</code>
        </p>

        {!status.templateExists && (
          <p className="error-text">
            Le gabarit est absent du dossier. Relancez l&apos;application pour qu&apos;elle le
            rétablisse.
          </p>
        )}
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
