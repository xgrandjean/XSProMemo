import { useEffect, type ReactNode } from 'react'

/**
 * In-app dialog. Electron's native window.confirm() blocks the renderer and can show up
 * behind the window — and window.prompt() is not implemented at all — so every
 * confirmation, short input and long-running task goes through this instead.
 *
 * `dismissable` is turned off while a task is running, so a stray click on the backdrop
 * cannot hide work in progress.
 */
export default function Modal({
  title,
  onClose,
  children,
  actions,
  dismissable = true,
  wide = false
}: {
  title: string
  onClose: () => void
  children?: ReactNode
  actions?: ReactNode
  dismissable?: boolean
  wide?: boolean
}): JSX.Element {
  useEffect(() => {
    if (!dismissable) return
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, dismissable])

  return (
    <div className="help-overlay" onClick={() => dismissable && onClose()}>
      <div
        className={`help-dialog modal-dialog${wide ? ' modal-dialog--wide' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="help-dialog-head">
          <h2>{title}</h2>
          {dismissable && (
            <button className="icon-btn" title="Fermer" onClick={onClose}>
              ✕
            </button>
          )}
        </div>
        {children && <div className="help-body">{children}</div>}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  )
}
