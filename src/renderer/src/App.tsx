import { useEffect, useState } from 'react'
import MemoiresListPage from './pages/MemoiresListPage'
import MemoireEditorPage from './pages/MemoireEditorPage'
import ConfigPage from './pages/ConfigPage'
import Modal from './components/Modal'
import { HelpButton } from './components/Help'
import { AppHelp } from './components/HelpTexts'

type View = { name: 'list' } | { name: 'editor'; memoireId: string } | { name: 'config' }

export default function App(): JSX.Element {
  const [view, setView] = useState<View>({ name: 'list' })
  // Whether the currently-open mémoire editor (if any) has unsaved changes — reset
  // whenever the editor isn't mounted, since a fresh editor always starts clean.
  const [dirty, setDirty] = useState(false)
  const [pendingView, setPendingView] = useState<View | null>(null)

  useEffect(() => {
    window.api.app.setDirty(dirty)
  }, [dirty])

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
    </div>
  )
}
