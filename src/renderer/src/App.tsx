import { useEffect, useState } from 'react'
import type { AppConfig } from '../../shared/types'
import SetupPage from './pages/SetupPage'
import MemoiresListPage from './pages/MemoiresListPage'
import MemoireEditorPage from './pages/MemoireEditorPage'
import ConfigPage from './pages/ConfigPage'
import { HelpButton } from './components/Help'
import { AppHelp } from './components/HelpTexts'

type View = { name: 'list' } | { name: 'editor'; memoireId: string } | { name: 'config' }

export default function App(): JSX.Element {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>({ name: 'list' })

  useEffect(() => {
    window.api.config.get().then((c) => {
      setConfig(c)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="center">Chargement...</div>
  if (!config?.libraryPath) return <SetupPage onConfigured={setConfig} />

  return (
    <div className="app">
      <nav className="topbar">
        <span className="brand" onClick={() => setView({ name: 'list' })}>
          XSProMemo
        </span>
        <span className="topbar-actions">
          <HelpButton title="Comment fonctionne XSProMemo" label="Aide">
            <AppHelp />
          </HelpButton>
          <button
            className={`gear ${view.name === 'config' ? 'active' : ''}`}
            title="Configuration : gabarit et mémoire exemple"
            onClick={() => setView({ name: 'config' })}
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
            memoireId={view.memoireId}
            onBack={() => setView({ name: 'list' })}
          />
        )}
        {view.name === 'config' && <ConfigPage onBack={() => setView({ name: 'list' })} />}
      </main>
    </div>
  )
}
