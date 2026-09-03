import { useEffect, useState } from 'react'
import type { LogoField } from '../../../shared/types'

/**
 * One of a mémoire's own logos (there are two slots: `logo` at top right, `secondLogo`
 * at top left). Saved server-side the moment it changes — unlike the rest of the plan,
 * it bypasses the autosave timer entirely, so its preview is fetched separately.
 */
export default function LogoPicker({
  memoireId,
  field,
  label,
  altText
}: {
  memoireId: string
  field: LogoField
  label: string
  altText: string
}): JSX.Element {
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.memoires.logoPreview(memoireId, field).then((p) => {
      if (!cancelled) setPreview(p)
    })
    return () => {
      cancelled = true
    }
  }, [memoireId, field])

  async function choose(): Promise<void> {
    const imagePath = await window.api.dialogs.pickImage()
    if (!imagePath) return
    setError(null)
    setBusy(true)
    try {
      await window.api.memoires.setLogo(memoireId, field, imagePath)
      setPreview(await window.api.memoires.logoPreview(memoireId, field))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function clear(): Promise<void> {
    setError(null)
    setBusy(true)
    try {
      await window.api.memoires.clearLogo(memoireId, field)
      setPreview(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="field">
      <label>{label}</label>
      <div className="row">
        <div className="logo-preview">
          {preview ? (
            <img src={preview} alt={altText} />
          ) : (
            <span className="muted">Aucun logo</span>
          )}
        </div>
        <button className="primary" onClick={choose} disabled={busy}>
          {preview ? 'Remplacer le logo' : 'Choisir un logo'}
        </button>
        {preview && (
          <button className="danger" onClick={clear} disabled={busy}>
            Retirer
          </button>
        )}
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  )
}
