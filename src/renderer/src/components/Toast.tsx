import { useEffect } from 'react'

/**
 * A short confirmation that clears itself. For the things a Modal would over-dramatize —
 * "it worked, carry on" — where making the user click "Fermer" is one click too many.
 *
 * Rendered by whoever owns the message rather than through a global queue: only one place
 * needs it so far, and a queue would be machinery without a second customer.
 */
export default function Toast({
  message,
  onDone,
  duration = 3200
}: {
  message: string
  onDone: () => void
  duration?: number
}): JSX.Element {
  // Keyed on the message in the parent, so re-triggering the same action restarts the delay
  // instead of letting the first timer cut the second message short.
  useEffect(() => {
    const timer = setTimeout(onDone, duration)
    return () => clearTimeout(timer)
  }, [message, duration, onDone])

  return (
    <div className="toast" role="status">
      {message}
    </div>
  )
}
