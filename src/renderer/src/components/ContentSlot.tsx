import { useState } from 'react'
import { pickAndImportContent } from '../lib/pickContent'
import { describeError } from '../lib/describeError'
import type { ContentRef } from '../../../shared/types'

/**
 * The content attached to one chapter (or one cover page): pick a file, preview it,
 * open it in its native editor, or detach it.
 */
export default function ContentSlot({
  content,
  onChange,
  compact = false,
  addLabel = '+ contenu'
}: {
  content: ContentRef | null
  onChange: (content: ContentRef | null) => void
  compact?: boolean
  addLabel?: string
}): JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pick(): Promise<void> {
    setError(null)
    setBusy(true)
    try {
      const picked = await pickAndImportContent()
      if (picked) onChange(picked)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  if (!content) {
    return (
      <span className="content-slot">
        <button className="link" onClick={pick} disabled={busy}>
          {busy ? 'Import...' : addLabel}
        </button>
        {error && <span className="error-text">{error}</span>}
      </span>
    )
  }

  return (
    <span className="content-slot">
      <span className="badge type-docx">Word</span>
      {!compact && <span className="muted file-name">{content.originalName}</span>}
      <button className="link" onClick={() => window.api.memoires.openContent(content.file)}>
        Ouvrir
      </button>
      <button className="link" onClick={pick} disabled={busy}>
        Remplacer
      </button>
      <button className="link danger-link" onClick={() => onChange(null)}>
        Retirer
      </button>
      {error && <span className="error-text">{error}</span>}
    </span>
  )
}
