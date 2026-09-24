import { Fragment, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
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
  // Position calculee une fois le menu mesure : tant qu'elle manque, il reste invisible,
  // sans quoi il apparaitrait une image au mauvais endroit avant de sauter en place.
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  /**
   * Un menu ouvert depuis une ligne en bas de liste depassait sous la fenetre, et ses
   * dernieres entrees devenaient inatteignables. Il s'ouvre donc vers le bas quand la
   * place y est, vers le haut sinon, et se rabat dans la fenetre dans tous les cas.
   */
  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const marge = 8
    const { height, width } = menu.getBoundingClientRect()
    const declencheur = anchor === 'trigger' ? triggerRef?.current?.getBoundingClientRect() : null
    const curseur = anchor === 'trigger' ? null : anchor

    const sousAncre = declencheur ? declencheur.bottom + 4 : (curseur?.y ?? 0)
    const surAncre = declencheur ? declencheur.top - 4 : (curseur?.y ?? 0)
    const gauche = declencheur ? declencheur.left : (curseur?.x ?? 0)

    const deborde = sousAncre + height > window.innerHeight - marge
    const placeAuDessus = surAncre - height > marge
    const haut = deborde && placeAuDessus ? surAncre - height : sousAncre

    setPosition({
      // Un menu plus haut que la fenetre defile (max-height en CSS) plutot que de sortir.
      top: Math.max(marge, Math.min(haut, window.innerHeight - marge - height)),
      left: Math.max(marge, Math.min(gauche, window.innerWidth - marge - width))
    })
  }, [anchor, triggerRef])

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

  const style: React.CSSProperties = {
    top: position?.top ?? 0,
    left: position?.left ?? 0,
    visibility: position ? 'visible' : 'hidden'
  }

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
