import { describe, expect, it } from 'vitest'
import { closestName, editDistance, nameKey, samePlayer } from './nameMatch'

describe('nameMatch', () => {
  it('ignores case, accents, punctuation and a Jr. suffix', () => {
    expect(nameKey('Ronald Acuña, Jr.')).toBe('ronaldacuna')
    expect(samePlayer('ronald acuna jr', 'Ronald Acuña, Jr.')).toBe(true)
    expect(samePlayer('Julio Rodriguez', 'Julio Rodríguez')).toBe(true)
  })

  it('allows a slip or two in a longer name, none in a short one', () => {
    expect(samePlayer('Fransisco Lindor', 'Francisco Lindor')).toBe(true)
    expect(samePlayer('Tyler Colvn', 'Tyler Colvin')).toBe(true)
    expect(samePlayer('Bo Bichette', 'Mo Bichette')).toBe(true)
    expect(samePlayer('Juan Soto', 'Juan Sosa')).toBe(false)
    expect(samePlayer('Ty Cobb', 'Ty Webb')).toBe(false)
  })

  it('finds the closest name, preferring an exact one', () => {
    expect(closestName('mike trout', ['Mike Trout', 'Mike Troutt'])).toBe('Mike Trout')
    expect(closestName('gunnar henderzon', ['Gunnar Henderson', 'Jackson Holliday'])).toBe('Gunnar Henderson')
    expect(closestName('nobody', ['Mike Trout'])).toBeNull()
    expect(editDistance('kitten', 'sitting')).toBe(3)
  })
})
