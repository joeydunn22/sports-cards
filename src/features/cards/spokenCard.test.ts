import { describe, expect, it } from 'vitest'
import { numberWords, parseCardText, type QuickContext } from './spokenCard'

const context: QuickContext = {
  sets: ['Bowman Chrome', 'Bowman Chrome Draft', 'Topps', 'Topps Finest', 'Topps Chrome Update', 'Upper Deck Series 1'],
  inserts: ['Prospects', 'Prospect Autographs', 'Rookie Debut', 'Young Guns'],
  parallels: ['Refractor', 'Red Refractor', 'Gold Refractor', 'Blue Refractor', 'SuperFractor', 'Printing Plates'],
  teams: ['Boston Red Sox', 'Toronto Blue Jays', 'Cincinnati Reds'],
  sports: ['Baseball', 'Basketball', 'Hockey'],
  players: ['Tyler Colvin', 'Bryce Harper', 'Ronald Acuña, Jr.', 'Elly De La Cruz', 'Connor Bedard'],
  cardNumbers: ['38', 'BCP111', 'RD-12'],
}
const parse = (text: string) => parseCardText(text, context)

describe('numberWords', () => {
  it('turns spoken numbers into digits', () => {
    expect(numberWords('four of five')).toBe('4 of 5')
    expect(numberWords('one of one')).toBe('1 of 1')
    expect(numberWords('numbered to ninety-nine')).toBe('numbered to 99')
    expect(numberWords('one hundred fifty')).toBe('150')
    expect(numberWords('a hundred')).toBe('100')
    expect(numberWords('a red refractor')).toBe('a red refractor')
  })
})

describe('parseCardText', () => {
  it('splits a whole card into its fields', () => {
    const { values, placed, leftover } = parse('2011 Bowman Chrome Tyler Colvin red refractor 4 of 5')
    expect(values).toEqual({
      year: '2011',
      set_name: 'Bowman Chrome',
      player: 'Tyler Colvin',
      parallel: 'Red Refractor',
      serial_number: '4',
      print_run: '5',
    })
    expect(placed).toEqual(['year', 'set_name', 'player', 'parallel', 'serial_number', 'print_run'])
    expect(leftover).toBe('')
  })

  it('takes the longest set name', () => {
    expect(parse('2011 bowman chrome draft gold refractor').values.set_name).toBe('Bowman Chrome Draft')
  })

  it('reads dictated numbers', () => {
    expect(parse('Bryce Harper four of five').values).toMatchObject({ serial_number: '4', print_run: '5' })
    expect(parse('superfractor one of one').values).toMatchObject({ parallel: 'SuperFractor', serial_number: '1', print_run: '1' })
    expect(parse('Tyler Colvin 23/99').values).toMatchObject({ serial_number: '23', print_run: '99' })
  })

  it('reads a print run on its own', () => {
    expect(parse('gold refractor numbered to 50').values).toMatchObject({ parallel: 'Gold Refractor', print_run: '50' })
    expect(parse('blue refractor out of 150').values.print_run).toBe('150')
    expect(parse('blue refractor /150').values.print_run).toBe('150')
    expect(parse('blue refractor /150').values.serial_number).toBeUndefined()
  })

  it('reads a season and never takes it for a serial number', () => {
    const { values } = parse('2023-24 Upper Deck Series 1 Connor Bedard Young Guns')
    expect(values).toMatchObject({ year: '2023-24', set_name: 'Upper Deck Series 1', player: 'Connor Bedard', insert_name: 'Young Guns' })
    expect(parse('2023/24 Connor Bedard').values).toMatchObject({ year: '2023-24' })
    expect(parse('2023/24 Connor Bedard').values.serial_number).toBeUndefined()
  })

  it('reads the card number, in the checklist’s spelling', () => {
    expect(parse('Tyler Colvin number 38').values.card_number).toBe('38')
    expect(parse('Tyler Colvin #38').values.card_number).toBe('38')
    expect(parse('Bryce Harper card number bcp 111').values.card_number).toBe('BCP111')
    expect(parse('Bryce Harper BDC-150').values.card_number).toBe('BDC-150')
    expect(parse('Elly De La Cruz rookie debut rd 12').values.card_number).toBe('RD-12')
    expect(parse('Elly De La Cruz number rd 12').values.card_number).toBe('RD-12')
    expect(parse('Tyler Colvin 38').values.card_number).toBe('38')
  })

  it('sets the yes/no flags, including from the insert’s name', () => {
    expect(parse('Bryce Harper rookie auto patch').values).toMatchObject({ is_rookie: true, is_auto: true, is_relic: true })
    expect(parse('Bryce Harper RC jersey').values).toMatchObject({ is_rookie: true, is_relic: true })
    const insert = parse('Bryce Harper prospect autographs blue refractor')
    expect(insert.values).toMatchObject({ insert_name: 'Prospect Autographs', is_auto: true, parallel: 'Blue Refractor' })
  })

  it('reads a grade', () => {
    expect(parse('Tyler Colvin PSA 10').values).toMatchObject({ is_graded: true, grade_company: 'PSA', grade: '10' })
    expect(parse('Tyler Colvin beckett 9.5').values).toMatchObject({ grade_company: 'BGS', grade: '9.5' })
  })

  it('finds a player heard a little wrong, and the checklist’s spelling', () => {
    expect(parse('ronald acuna jr red refractor').values.player).toBe('Ronald Acuña, Jr.')
    expect(parse('Tyler Colvn gold refractor').values.player).toBe('Tyler Colvin')
  })

  it('takes a player nobody knows yet from the words left', () => {
    const { values } = parse('2024 Topps Gunnar Henderson gold')
    expect(values).toMatchObject({ year: '2024', set_name: 'Topps', player: 'Gunnar Henderson', parallel: 'Gold' })
  })

  it('reads a parallel that isn’t on any list yet', () => {
    expect(parse('Bryce Harper green shimmer refractor').values.parallel).toBe('Green Shimmer Refractor')
    expect(parse('Bryce Harper refractors').values.parallel).toBe('Refractor')
  })

  it('doesn’t take a team for a parallel', () => {
    const { values } = parse('Bryce Harper Boston Red Sox')
    expect(values).toMatchObject({ team: 'Boston Red Sox' })
    expect(values.parallel).toBeUndefined()
    expect(parse('Gunnar Henderson red sox').values.parallel).toBeUndefined()
  })

  it('reads the sport, and "base" as no parallel', () => {
    expect(parse('basketball').values).toEqual({ sport: 'Basketball' })
    expect(parse('Tyler Colvin base').values).toMatchObject({ parallel: '' })
  })

  it('only fills what was said', () => {
    const { values, placed } = parse('Bryce Harper gold refractor')
    expect(values).toEqual({ player: 'Bryce Harper', parallel: 'Gold Refractor' })
    expect(placed).toEqual(['player', 'parallel'])
  })

  it('reports words it couldn’t place', () => {
    expect(parse('Tyler Colvin red refractor shiny 4 of 5').leftover).toBe('shiny')
    expect(parse('the Tyler Colvin card').leftover).toBe('')
  })
})
