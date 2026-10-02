import { useEffect, useState } from 'react'

/** useState that survives navigating away and back (per tab), e.g. list filters while editing a card. */
export function useSessionState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(key)
      return stored ? (JSON.parse(stored) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage unavailable (private mode etc.): state still works for this visit.
    }
  }, [key, value])

  return [value, setValue] as const
}
