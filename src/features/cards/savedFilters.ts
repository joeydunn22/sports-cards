import { emptyFilters, type CardFilters } from './collection'

/** A named set of collection filters, one tap away as a chip above the list. */
export type SavedFilter = { name: string; filters: CardFilters }

/** Adds a saved filter, replacing one with the same name (any case). Blank names are ignored. */
export function addSavedFilter(list: SavedFilter[], name: string, filters: CardFilters): SavedFilter[] {
  const clean = name.trim()
  if (!clean) return list
  const rest = list.filter((f) => f.name.toLowerCase() !== clean.toLowerCase())
  return [...rest, { name: clean, filters: normalize(filters) }]
}

export function removeSavedFilter(list: SavedFilter[], name: string): SavedFilter[] {
  return list.filter((f) => f.name !== name)
}

/** The same filters, ignoring field order and fields set back to "Any". */
export function sameFilters(a: CardFilters, b: CardFilters): boolean {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b))
}

/** Reads stored filters, dropping anything malformed (storage is per device and may be stale). */
export function parseSavedFilters(raw: string | null): SavedFilter[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    return value
      .filter(
        (f): f is SavedFilter =>
          typeof f === 'object' && f != null && typeof f.name === 'string' && typeof f.filters === 'object' && f.filters != null,
      )
      .map((f) => ({ name: f.name, filters: normalize({ ...emptyFilters, ...f.filters }) }))
  } catch {
    return []
  }
}

function normalize(filters: CardFilters): CardFilters {
  const fields = Object.fromEntries(
    Object.entries(filters.fields ?? {})
      .filter(([, value]) => value)
      .sort(([a], [b]) => a.localeCompare(b)),
  )
  return {
    search: (filters.search ?? '').trim(),
    fields,
    flags: [...(filters.flags ?? [])].sort(),
    ownership: filters.ownership ?? 'owned',
  }
}
