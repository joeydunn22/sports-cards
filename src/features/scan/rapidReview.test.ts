import { describe, expect, it } from 'vitest'
import { makeCard } from '../../test/makeCard'
import { emptyCardForm, type CardFormValues } from '../cards/cardSchema'
import { quickSaveBlocker } from './rapidReview'

const values: CardFormValues = {
  ...emptyCardForm,
  player: 'Gunnar Henderson',
  year: '2023',
  set_name: 'Topps',
  card_number: '18',
  sport: 'Baseball',
}

describe('quickSaveBlocker', () => {
  it('lets a complete new card through', () => {
    expect(quickSaveBlocker(values, [])).toBeNull()
  })

  it('names the required fields the AI left blank', () => {
    expect(quickSaveBlocker({ ...values, card_number: '', set_name: ' ' }, [])).toBe('Fill in Set, Card #')
  })

  it('catches a serial without its print run', () => {
    expect(quickSaveBlocker({ ...values, serial_number: '12' }, [])).toBe('Fill in Print run')
  })

  it('sends a plain extra copy to the form, where it can be added to the quantity', () => {
    const owned = makeCard({ player: 'Gunnar Henderson', year: '2023', set_name: 'Topps', card_number: '18' })
    expect(quickSaveBlocker(values, [owned])).toBe('Already in your collection')
  })

  it('ignores a different parallel of the same card', () => {
    const owned = makeCard({ player: 'Gunnar Henderson', year: '2023', set_name: 'Topps', card_number: '18', parallel: 'Gold' })
    expect(quickSaveBlocker(values, [owned])).toBeNull()
  })
})
