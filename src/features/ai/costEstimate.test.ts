import { describe, expect, it } from 'vitest'
import { creditLeft, estimateEach, estimateRead, formatCost, perCard, type UsageEntry } from './costEstimate'

const SONNET = 'claude-sonnet-5-5'
const entry = (kind: string, dollars: number, created_at = '2026-10-05T12:00:00Z'): UsageEntry => ({
  kind,
  model: SONNET,
  cards: 1,
  dollars,
  created_at,
})

describe('estimates', () => {
  it('uses typical costs until there is enough history, then the collector’s own average', () => {
    expect(perCard('read', SONNET, [])).toBe(0.015)
    const history = Array.from({ length: 5 }, () => entry('read', 0.02))
    expect(perCard('read', SONNET, history)).toBeCloseTo(0.02)
  })

  it('includes possible checklist searches in the most a read can cost', () => {
    const withLookups = estimateRead(SONNET, 10, [], true)
    const without = estimateRead(SONNET, 10, [], false)
    expect(withLookups.expected).toBeCloseTo(0.15)
    expect(without.max).toBeCloseTo(0.225)
    expect(withLookups.max).toBeGreaterThan(without.max + 0.5)
  })

  it('prices an unknown model like the most expensive one', () => {
    expect(estimateEach('identify', 'claude-new', 1, []).expected).toBe(0.13)
  })
})

describe('creditLeft', () => {
  it('subtracts what was spent since the balance was entered', () => {
    const history = [entry('read', 1, '2026-10-01T00:00:00Z'), entry('read', 0.25), entry('lookup', 0.5)]
    const result = creditLeft({ credit_dollars: 20, credit_set_at: '2026-10-05T00:00:00Z' }, history)
    expect(result).toEqual({ left: 19.25, spent: 0.75 })
  })

  it('is unknown until a balance is entered', () => {
    expect(creditLeft(null, [])).toBeNull()
    expect(creditLeft({ credit_dollars: null, credit_set_at: null }, [])).toBeNull()
  })
})

describe('formatCost', () => {
  it('shows cents under a dollar', () => {
    expect(formatCost(0.004)).toBe('0.4¢')
    expect(formatCost(0.043)).toBe('4¢')
    expect(formatCost(1.254)).toBe('$1.25')
  })
})
