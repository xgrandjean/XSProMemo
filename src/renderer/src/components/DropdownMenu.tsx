import { Fragment, useEffect, useRef, type RefObject } from 'react'
import { createPortal } from 'react-dom'

export interface DropdownMenuItem {
  label: string
  onSelect: () => void
  danger?: boolean
  /** A thin rule above this item, to set structural actions apart from content ones. */
  separatorBefore?: boolean
}

/**
 * A small floating menu, positioned either below a trigger button or at the cursor (for
 * a right-click). Rendered through a portal so it is never clipped by the scrolling
 * chapter list, and closes itself on an outside click or Escape.
 */
export default function DropdownMenu({
  anchor,
  triggerRef,
  items,
  onClose
}: {
  anchor: 'trigger' | { x: number; y: number }
  triggerRef?: RefObject<HTMLElement>
  items: DropdownMenuItem[]
  onClose: () => void
}): JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const rect = anchor === 'trigger' ? triggerRef?.current?.getBoundingClientRect() : null
  const style: React.CSSProperties =
    anchor === 'trigger'
      ? { top: (rect?.bottom ?? 0) + 4, left: rect?.left ?? 0 }
      : { top: anchor.y, left: anchor.x }

  return createPortal(
    <div className="dropdown-menu" style={style} ref={menuRef}>
      {items.map((item, index) => (
        <Fragment key={index}>
          {item.separatorBefore && <div className="dropdown-separator" />}
          <button
            className={`dropdown-item${item.danger ? ' danger-link' : ''}`}
            onClick={() => {
              onClose()
              item.onSelect()
            }}
          >
            {item.label}
          </button>
        </Fragment>
      ))}
    </div>,
    document.body
  )
}
