import { describe, expect, it } from 'vitest'
import { usageDollars } from './pricing'

describe('usageDollars', () => {
  it('halves token prices in a batch but not searches', () => {
    const usage = { input_tokens: 1_000_000, output_tokens: 100_000, server_tool_use: { web_search_requests: 2 } }
    // Sonnet: $2 in + $1 out = $3, halved = $1.50, plus 2 searches
    expect(usageDollars('claude-sonnet-5-5', usage, { batch: true })).toBeCloseTo(1.52)
    expect(usageDollars('claude-sonnet-5-5', usage, { batch: false })).toBeCloseTo(3.02)
  })

  it('prices cache writes and reads', () => {
    const usage = { cache_creation_input_tokens: 1_000_000, cache_read_input_tokens: 1_000_000 }
    expect(usageDollars('claude-haiku-4-5', usage, { batch: false })).toBeCloseTo(1.35)
  })

  it('never treats an unknown model as free', () => {
    expect(usageDollars('claude-new-model', { output_tokens: 1_000_000 }, { batch: false })).toBeGreaterThan(0)
  })
})
