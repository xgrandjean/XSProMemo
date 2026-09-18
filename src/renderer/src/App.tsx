import { useEffect, useState } from 'react'
import MemoiresListPage from './pages/MemoiresListPage'
import MemoireEditorPage from './pages/MemoireEditorPage'
import ConfigPage from './pages/ConfigPage'
import Modal from './components/Modal'
import { HelpButton } from './components/Help'
import { AppHelp } from './components/HelpTexts'
import { describeError } from './lib/describeError'

type View = { name: 'list' } | { name: 'editor'; memoireId: string } | { name: 'config' }

export default function App(): JSX.Element {
  const [view, setView] = useState<View>({ name: 'list' })
  // Whether the currently-open mémoire editor (if any) has unsaved changes — reset
  // whenever the editor isn't mounted, since a fresh editor always starts clean.
  const [dirty, setDirty] = useState(false)
  const [pendingView, setPendingView] = useState<View | null>(null)

  const [gabaritUpdatePrompt, setGabaritUpdatePrompt] = useState(false)
  const [gabaritUpdateBusy, setGabaritUpdateBusy] = useState(false)
  const [gabaritUpdateError, setGabaritUpdateError] = useState<string | null>(null)

  useEffect(() => {
    window.api.model.get().then((s) => setGabaritUpdatePrompt(s.gabaritUpdateAvailable))
  }, [])

  useEffect(() => {
    window.api.app.setDirty(dirty)
  }, [dirty])

  async function applyGabaritUpdate(): Promise<void> {
    setGabaritUpdateBusy(true)
    setGabaritUpdateError(null)
    try {
      await window.api.model.applyGabaritUpdate()
      setGabaritUpdatePrompt(false)
    } catch (err) {
      setGabaritUpdateError(describeError(err))
    } finally {
      setGabaritUpdateBusy(false)
    }
  }

  async function dismissGabaritUpdate(): Promise<void> {
    setGabaritUpdateBusy(true)
    setGabaritUpdateError(null)
    try {
      await window.api.model.dismissGabaritUpdate()
      setGabaritUpdatePrompt(false)
    } catch (err) {
      setGabaritUpdateError(describeError(err))
    } finally {
      setGabaritUpdateBusy(false)
    }
  }

  function navigate(next: View): void {
    if (dirty) setPendingView(next)
    else setView(next)
  }

  function confirmLeave(): void {
    setDirty(false)
    if (pendingView) setView(pendingView)
    setPendingView(null)
  }

  return (
    <div className="app">
      <nav className="topbar">
        <span className="brand" onClick={() => navigate({ name: 'list' })}>
          XSProMemo
        </span>
        <span className="topbar-actions">
          <HelpButton title="Comment fonctionne XSProMemo" label="Aide">
            <AppHelp />
          </HelpButton>
          <button
            className={`gear ${view.name === 'config' ? 'active' : ''}`}
            title="Configuration : présentation et mémoire exemple"
            onClick={() => navigate({ name: 'config' })}
          >
            ⚙
          </button>
        </span>
      </nav>
      <main className="content">
        {view.name === 'list' && (
          <MemoiresListPage onOpen={(id) => setView({ name: 'editor', memoireId: id })} />
        )}
        {view.name === 'editor' && (
          <MemoireEditorPage
            key={view.memoireId}
            memoireId={view.memoireId}
            onBack={() => navigate({ name: 'list' })}
            onDirtyChange={setDirty}
          />
        )}
        {view.name === 'config' && (
          <ConfigPage
            onBack={() => navigate({ name: 'list' })}
            onOpen={(id) => setView({ name: 'editor', memoireId: id })}
          />
        )}
      </main>

      {pendingView && (
        <Modal
          title="Quitter sans enregistrer ?"
          onClose={() => setPendingView(null)}
          actions={
            <>
              <button className="secondary" onClick={() => setPendingView(null)}>
                Rester
              </button>
              <button className="danger" onClick={confirmLeave}>
                Quitter sans enregistrer
              </button>
            </>
          }
        >
          <p>Ce mémoire a des modifications non enregistrées. Les quitter maintenant les perdra.</p>
        </Modal>
      )}

      {gabaritUpdatePrompt && (
        <Modal
          title="Mise à jour du gabarit disponible"
          onClose={() => undefined}
          dismissable={false}
          actions={
            <>
              <button className="secondary" onClick={() => void dismissGabaritUpdate()} disabled={gabaritUpdateBusy}>
                Plus tard
              </button>
              <button className="primary" onClick={() => void applyGabaritUpdate()} disabled={gabaritUpdateBusy}>
                {gabaritUpdateBusy ? 'En cours...' : 'Mettre à jour'}
              </button>
            </>
          }
        >
          <p>
            Cette version de XSProMemo apporte des améliorations au gabarit par défaut
            (mise en page plus robuste, styles de titre harmonisés). Voulez-vous les
            appliquer au gabarit de votre dossier de travail ?
          </p>
          <p className="muted">
            Une copie de votre gabarit actuel est gardée à côté au cas où, mais toute
            personnalisation manuelle non reportée dans le gabarit livré sera remplacée.
            Vous pourrez le refaire plus tard depuis la Configuration.
          </p>
          {gabaritUpdateError && <p className="error-text">{gabaritUpdateError}</p>}
        </Modal>
      )}
    </div>
  )
}
