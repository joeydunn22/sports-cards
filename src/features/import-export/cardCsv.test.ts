import { describe, expect, it } from 'vitest'
import { makeCard } from '../../test/makeCard'
import { cardsToCsv, parseCardsCsv } from './cardCsv'

describe('cardsToCsv + parseCardsCsv', () => {
  it('round-trips cards, including ids for updates', () => {
    const card = makeCard({
      player: 'Ken Griffey Jr.',
      set_name: 'Upper Deck',
      card_number: '1',
      is_rookie: true,
      serial_number: 5,
      print_run: 10,
      estimated_value: 150,
    })
    const result = parseCardsCsv(cardsToCsv([card]))
    expect(result.fatal).toBeNull()
    expect(result.errors).toEqual([])
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].id).toBe(card.id)
    expect(result.rows[0].input).toMatchObject({
      player: 'Ken Griffey Jr.',
      is_rookie: true,
      serial_number: 5,
      print_run: 10,
      estimated_value: 150,
    })
  })
})

describe('parseCardsCsv', () => {
  it('accepts friendly headers and yes/no/x flags, defaulting quantity', () => {
    const csv = 'Player,Year,Set Name,Card Number,Sport,Is Auto\nJuan Soto,2018,Bowman Chrome,CPA-JS,Baseball,x\n'
    const { rows, errors } = parseCardsCsv(csv)
    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({ line: 2, id: null, input: { is_auto: true, quantity: 1 } })
  })

  it('reports row errors with line numbers', () => {
    const csv = 'player,year,set_name,card_number,sport,is_rookie\n,2020,Prizm,1,Football,maybe\n'
    const { rows, errors } = parseCardsCsv(csv)
    expect(rows).toEqual([])
    expect(errors[0].line).toBe(2)
    expect(errors[0].messages.join(' ')).toMatch(/is_rookie/)
    expect(errors[0].messages.join(' ')).toMatch(/Player is required/)
  })

  it('fails fast when required columns are missing', () => {
    expect(parseCardsCsv('player,year\nA,2020\n').fatal).toMatch(/set_name, card_number, sport/)
  })
})
