import { useState } from 'react'
import type { CardFilters } from '../features/cards/collection'
import {
  addSavedFilter,
  parseSavedFilters,
  removeSavedFilter,
  type SavedFilter,
} from '../features/cards/savedFilters'

const KEY = 'sports-cards:saved-filters'

function read(): SavedFilter[] {
  try {
    return parseSavedFilters(localStorage.getItem(KEY))
  } catch {
    return []
  }
}

/** Named collection filters, kept on this device (a convenience, not collection data). */
export function useSavedFilters() {
  const [list, setList] = useState(read)

  function store(next: SavedFilter[]) {
    setList(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      // Storage unavailable: the chips still work until the app is closed.
    }
  }

  return {
    list,
    save: (name: string, filters: CardFilters) => store(addSavedFilter(list, name, filters)),
    remove: (name: string) => store(removeSavedFilter(list, name)),
  }
}
