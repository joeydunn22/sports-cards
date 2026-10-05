/**
 * What an API response cost, in dollars, for the app's spending log (public.ai_usage).
 * Standard prices per million tokens; the Batch API is half. Web search is $10 per 1,000 searches.
 */
const PRICES: { prefix: string; input: number; output: number }[] = [
  { prefix: 'claude-sonnet-5-5', input: 2, output: 10 },
  { prefix: 'claude-opus-5-5', input: 4, output: 20 },
  { prefix: 'claude-haiku-4-5', input: 1, output: 5 },
]
const SEARCH_DOLLARS = 0.01

export type Usage = {
  input_tokens?: number | null
  output_tokens?: number | null
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
  server_tool_use?: { web_search_requests?: number | null } | null
}

export function usageDollars(model: string, usage: Usage, { batch }: { batch: boolean }): number {
  // Unknown model: price it as the most expensive one rather than as free.
  const price = PRICES.find((p) => model.startsWith(p.prefix)) ?? PRICES[1]
  const input =
    (usage.input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0) * 1.25 +
    (usage.cache_read_input_tokens ?? 0) * 0.1
  const tokens = (input * price.input + (usage.output_tokens ?? 0) * price.output) / 1_000_000
  const searches = (usage.server_tool_use?.web_search_requests ?? 0) * SEARCH_DOLLARS
  return tokens * (batch ? 0.5 : 1) + searches
}
