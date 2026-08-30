import { useEffect, useState, type ReactNode } from 'react'

function HelpDialog({
  title,
  onClose,
  children
}: {
  title: string
  onClose: () => void
  children: ReactNode
}): JSX.Element {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="help-overlay" onClick={onClose}>
      <div className="help-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="help-dialog-head">
          <h2>{title}</h2>
          <button className="icon-btn" title="Fermer" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="help-body">{children}</div>
      </div>
    </div>
  )
}

/** A small "?" that opens an explanation next to the thing it explains. */
export function HelpButton({
  title,
  label = '?',
  children
}: {
  title: string
  label?: string
  children: ReactNode
}): JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="help-btn" title={`Aide : ${title}`} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <HelpDialog title={title} onClose={() => setOpen(false)}>
          {children}
        </HelpDialog>
      )}
    </>
  )
}
