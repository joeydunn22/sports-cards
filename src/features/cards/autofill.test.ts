import { describe, expect, it } from 'vitest'
import { makeCard } from '../../test/makeCard'
import { fillFromCollection, mergeLookup } from './autofill'
import { emptyCardForm } from './cardSchema'

const ohtani = makeCard({
  player: 'Shohei Ohtani',
  year: '2023',
  set_name: 'Topps Finest',
  card_number: '12',
  team: 'Los Angeles Angels',
  sport: 'Baseball',
  is_rookie: false,
  parallel: 'Red Refractor',
})

describe('fillFromCollection', () => {
  it('fills the player and team from another version of the same card', () => {
    const typed = { ...emptyCardForm, year: '2023', set_name: 'topps finest', card_number: '#12', sport: 'Baseball' }
    const fill = fillFromCollection(typed, [ohtani])
    expect(fill?.values).toEqual({ player: 'Shohei Ohtani', team: 'Los Angeles Angels' })
    expect(fill?.source).toBe('your 2023 Topps Finest #12')
  })

  it('fills team and sport from the player’s other cards', () => {
    const fill = fillFromCollection({ ...emptyCardForm, player: 'shohei ohtani' }, [ohtani])
    expect(fill?.values).toEqual({ team: 'Los Angeles Angels', sport: 'Baseball' })
  })

  it('never overwrites what was typed, and stays quiet with nothing to add', () => {
    const typed = { ...emptyCardForm, player: 'Shohei Ohtani', team: 'Dodgers', sport: 'Baseball' }
    expect(fillFromCollection(typed, [ohtani])).toBeNull()
    expect(fillFromCollection({ ...emptyCardForm, player: 'Nobody' }, [ohtani])).toBeNull()
  })
})

describe('mergeLookup', () => {
  it('fills blanks, turns on flags, and reports disagreements without applying them', () => {
    const typed = { ...emptyCardForm, player: 'Shohei Ohtani', year: '2023', set_name: 'Topps Finest', card_number: '99' }
    const found = { ...typed, card_number: '12', team: 'Los Angeles Angels', sport: 'Baseball', is_rookie: true }
    const merge = mergeLookup(typed, found)
    expect(merge.values).toEqual({ team: 'Los Angeles Angels', sport: 'Baseball', is_rookie: true })
    expect(merge.conflicts).toEqual([{ field: 'card_number', found: '12' }])
  })
})
