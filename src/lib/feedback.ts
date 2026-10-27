/** Small touches that make a save feel done: a haptic tick, a check flash, a running count for the session. */

const SAVED_KEY = 'sports-cards:saved-this-session'
export const SAVED_EVENT = 'sports-cards:saved'

/** A short tick where the phone supports it (Android; iOS Safari has no vibrate and ignores this). */
export function haptic(ms = 12) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    // Some browsers throw when vibration is blocked; it's only a nicety.
  }
}

/** Cards added (not edits) since the app was opened in this tab. */
export function savedThisSession(): number {
  try {
    return Number(sessionStorage.getItem(SAVED_KEY)) || 0
  } catch {
    return 0
  }
}

/** Counts one more card added this session and returns the new total. */
export function recordSave(): number {
  const count = savedThisSession() + 1
  try {
    sessionStorage.setItem(SAVED_KEY, String(count))
  } catch {
    // Storage unavailable: the count just isn't shown.
  }
  return count
}

/** Shows the check flash (SavedFlash, mounted in Layout) and ticks. Safe to call right before navigating. */
export function flashSaved() {
  haptic()
  window.dispatchEvent(new Event(SAVED_EVENT))
}
