import { useEffect, useState } from 'react'
import { SAVED_EVENT } from '../lib/feedback'
import { Icon } from './Icon'

const SHOW_MS = 700

/** A brief lime check in the middle of the screen whenever `flashSaved()` runs. Never blocks a tap. */
export function SavedFlash() {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const onSaved = () => setShown((n) => n + 1)
    window.addEventListener(SAVED_EVENT, onSaved)
    return () => window.removeEventListener(SAVED_EVENT, onSaved)
  }, [])
  useEffect(() => {
    if (!shown) return
    const timer = window.setTimeout(() => setShown(0), SHOW_MS)
    return () => window.clearTimeout(timer)
  }, [shown])

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-0 z-50 grid place-items-center">
      {shown > 0 && (
        <span key={shown} className="animate-saved-flash grid size-24 place-items-center rounded-full bg-accent-400 text-ink-950 shadow-[0_0_60px_-6px] shadow-accent-400/60">
          <Icon name="check" size={52} strokeWidth={2.6} />
          <span className="sr-only">Saved</span>
        </span>
      )}
    </div>
  )
}
