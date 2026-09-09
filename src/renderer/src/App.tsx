import { useState } from 'react'
import MemoiresListPage from './pages/MemoiresListPage'
import MemoireEditorPage from './pages/MemoireEditorPage'
import ConfigPage from './pages/ConfigPage'
import { HelpButton } from './components/Help'
import { AppHelp } from './components/HelpTexts'

type View = { name: 'list' } | { name: 'editor'; memoireId: string } | { name: 'config' }

export default function App(): JSX.Element {
  const [view, setView] = useState<View>({ name: 'list' })

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
            title="Configuration : présentation et mémoire exemple"
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
          <MemoireEditorPage memoireId={view.memoireId} onBack={() => setView({ name: 'list' })} />
        )}
        {view.name === 'config' && (
          <ConfigPage
            onBack={() => setView({ name: 'list' })}
            onOpen={(id) => setView({ name: 'editor', memoireId: id })}
          />
        )}
      </main>
    </div>
  )
}
