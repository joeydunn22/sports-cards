import { describe, expect, it } from 'vitest'
import { makeCard } from '../../test/makeCard'
import { cardNumberFill, fillFromCollection, type Spot } from './autofill'
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

const entry = (card_number: string, player: string, insert_name = '', is_rookie = false): Spot => ({
  year: '2011',
  set_name: 'Bowman Chrome',
  insert_name,
  card_number,
  player,
  team: null,
  sport: null,
  is_rookie,
})

describe('cardNumberFill', () => {
  const checklist = [
    entry('38', 'Tyler Colvin'),
    entry('1', 'Ronald Acuña, Jr.', '', true),
    entry('BCP111', 'Bryce Harper', 'Prospects'),
    entry('BCP111', 'Bryce Harper', 'Autographed Prospects'),
  ]
  const typed = { ...emptyCardForm, year: '2011', set_name: 'bowman chrome', sport: 'Baseball' }

  it('fills Card # from the player’s one card in the set', () => {
    const match = cardNumberFill({ ...typed, player: 'Tyler Colvin' }, checklist)
    expect(match?.fill?.values).toEqual({ card_number: '38' })
    expect(match?.fill?.source).toBe('the 2011 Bowman Chrome checklist')
  })

  it('matches a name typed loosely, and takes the checklist’s spelling and RC', () => {
    const match = cardNumberFill({ ...typed, player: 'ronald acuna jr' }, checklist)
    expect(match?.fill?.values).toEqual({ card_number: '1', is_rookie: true, player: 'Ronald Acuña, Jr.' })
    expect(cardNumberFill({ ...typed, player: 'Tyler Colvn' }, checklist)?.fill?.values.card_number).toBe('38')
  })

  it('offers the choices when the player has several cards, and fills the one in the current insert', () => {
    const open = cardNumberFill({ ...typed, player: 'Bryce Harper' }, checklist)
    expect(open?.fill).toBeNull()
    expect(open?.options.map((o) => o.insert_name)).toEqual(['Prospects', 'Autographed Prospects'])
    const auto = cardNumberFill({ ...typed, player: 'Bryce Harper', insert_name: 'Autographed Prospects' }, checklist)
    expect(auto?.fill?.values).toEqual({ card_number: 'BCP111', is_auto: true })
    expect(auto?.options[0].insert_name).toBe('Autographed Prospects')
  })

  it('leaves a typed Card # alone, and needs a player in the set', () => {
    expect(cardNumberFill({ ...typed, player: 'Tyler Colvin', card_number: '39' }, checklist)?.fill).toBeNull()
    expect(cardNumberFill({ ...typed, player: 'Mike Trout' }, checklist)).toBeNull()
    expect(cardNumberFill({ ...typed, year: '2012', player: 'Tyler Colvin' }, checklist)).toBeNull()
  })
})
