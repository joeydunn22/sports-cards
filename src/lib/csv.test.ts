import { describe, expect, it } from 'vitest'
import { parseCsv, toCsv } from './csv'

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, commas and newlines', () => {
    const text = 'a,b,c\r\n"x, y","say ""hi""","line1\nline2"\n'
    expect(parseCsv(text)).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'say "hi"', 'line1\nline2'],
    ])
  })

  it('strips a BOM and skips blank lines', () => {
    expect(parseCsv('﻿a,b\n\n,\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('keeps trailing empty cells', () => {
    expect(parseCsv('a,b,c\n1,,')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', ''],
    ])
  })
})

describe('toCsv', () => {
  it('round-trips through parseCsv', () => {
    const rows = [
      ['player', 'note'],
      ['Ken Griffey Jr.', 'has "quotes", commas\nand newlines'],
    ]
    expect(parseCsv(toCsv(rows))).toEqual(rows)
  })
})
