import { useState } from 'react'
import type { AppConfig } from '../../../shared/types'

export default function SetupPage({
  onConfigured
}: {
  onConfigured: (config: AppConfig) => void
}): JSX.Element {
  const [error, setError] = useState<string | null>(null)

  async function choose(): Promise<void> {
    setError(null)
    try {
      const config = await window.api.config.chooseWorkspaceFolder()
      if (config) onConfigured(config)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="center" style={{ flexDirection: 'column', gap: 16 }}>
      <h1>Bienvenue dans XSProMemo</h1>
      <p className="muted" style={{ maxWidth: 440, textAlign: 'center' }}>
        Choisissez un dossier de travail (par exemple dans vos Documents). Il contiendra vos
        contenus, vos mémoires et les documents générés.
      </p>
      <button className="primary" onClick={choose}>
        Choisir le dossier de travail
      </button>
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>
  )
}
