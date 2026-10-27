import { describe, expect, it } from 'vitest'
import { emptyFilters } from './collection'
import { addSavedFilter, parseSavedFilters, removeSavedFilter, sameFilters } from './savedFilters'

const rookies = { ...emptyFilters, flags: ['is_rookie' as const] }

describe('saved filters', () => {
  it('adds, replaces by name in any case, and removes', () => {
    let list = addSavedFilter([], ' Rookies ', rookies)
    expect(list.map((f) => f.name)).toEqual(['Rookies'])
    list = addSavedFilter(list, 'rookies', { ...rookies, search: 'ohtani' })
    expect(list).toHaveLength(1)
    expect(list[0].filters.search).toBe('ohtani')
    expect(removeSavedFilter(list, 'rookies')).toEqual([])
  })

  it('ignores a blank name', () => {
    expect(addSavedFilter([], '  ', rookies)).toEqual([])
  })

  it('compares filters regardless of order and empty fields', () => {
    const a = { ...emptyFilters, fields: { team: 'Reds', sport: 'Baseball' }, flags: ['is_auto' as const, 'numbered' as const] }
    const b = { ...emptyFilters, fields: { sport: 'Baseball', team: 'Reds', year: '' }, flags: ['numbered' as const, 'is_auto' as const] }
    expect(sameFilters(a, b)).toBe(true)
    expect(sameFilters(a, emptyFilters)).toBe(false)
  })

  it('reads stored filters, dropping junk', () => {
    const raw = JSON.stringify([{ name: 'Autos', filters: { flags: ['is_auto'] } }, { name: 3 }, 'x'])
    const list = parseSavedFilters(raw)
    expect(list).toHaveLength(1)
    expect(list[0].filters).toEqual({ ...emptyFilters, flags: ['is_auto'] })
    expect(parseSavedFilters('not json')).toEqual([])
    expect(parseSavedFilters(null)).toEqual([])
  })
})
