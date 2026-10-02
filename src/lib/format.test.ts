import { describe, expect, it } from 'vitest'
import { formatSerial } from './format'

describe('formatSerial', () => {
  it('shows serial and print run', () => {
    expect(formatSerial(23, 99)).toBe('23/99')
  })

  it('shows print run alone when serial is unknown', () => {
    expect(formatSerial(null, 99)).toBe('/99')
  })

  it('is empty for unnumbered cards', () => {
    expect(formatSerial(null, null)).toBe('')
  })

  it('handles 1/1s', () => {
    expect(formatSerial(1, 1)).toBe('1/1')
  })
})
