/**
 * Rough cost estimates for AI runs, shown before they start. They begin from typical per-card costs
 * and switch to the collector's own averages once the spending log (public.ai_usage) has enough runs.
 */
export type AiKind = 'read' | 'lookup' | 'identify'
export type UsageEntry = { kind: string; model: string; cards: number; dollars: number; created_at: string }
export type Estimate = { expected: number; max: number }

/**
 * Typical dollars per card. Reading and lookups run through the Batch API (half price); identify runs
 * right away at full price. Lookups include up to 3 web searches at 1¢ each.
 */
const TYPICAL: Record<AiKind, Record<string, number>> = {
  read: { 'claude-sonnet-5-5': 0.015, 'claude-opus-5-5': 0.03, 'claude-haiku-4-5': 0.008 },
  lookup: { 'claude-sonnet-5-5': 0.05, 'claude-opus-5-5': 0.09, 'claude-haiku-4-5': 0.035 },
  identify: { 'claude-sonnet-5-5': 0.07, 'claude-opus-5-5': 0.13, 'claude-haiku-4-5': 0.045 },
}
/** Own averages replace the typical figure after this many logged runs of the same kind and model. */
const MIN_HISTORY = 5
/** Headroom for a card that costs more than average (long answers, extra searches). */
const SPREAD = 1.5

export function perCard(kind: AiKind, model: string, history: UsageEntry[]): number {
  const own = history.filter((u) => u.kind === kind && u.model.startsWith(model))
  if (own.length >= MIN_HISTORY) {
    const cards = own.reduce((sum, u) => sum + u.cards, 0)
    return own.reduce((sum, u) => sum + Number(u.dollars), 0) / Math.max(cards, 1)
  }
  return TYPICAL[kind][model] ?? Math.max(...Object.values(TYPICAL[kind]))
}

/** Reading cards; with automatic lookups on, any of them may also get a checklist search. */
export function estimateRead(model: string, cards: number, history: UsageEntry[], autoLookup: boolean): Estimate {
  const read = cards * perCard('read', model, history)
  return { expected: read, max: read * SPREAD + (autoLookup ? cards * perCard('lookup', model, history) * SPREAD : 0) }
}

export function estimateEach(kind: 'lookup' | 'identify', model: string, cards: number, history: UsageEntry[]): Estimate {
  const each = perCard(kind, model, history)
  return { expected: cards * each, max: cards * each * SPREAD }
}

/** Credit left: the balance entered from the Console, minus what the log says was spent since. */
export function creditLeft(
  settings: { credit_dollars: number | null; credit_set_at: string | null } | null,
  history: UsageEntry[],
): { left: number; spent: number } | null {
  if (settings?.credit_dollars == null || !settings.credit_set_at) return null
  const since = Date.parse(settings.credit_set_at)
  const spent = history
    .filter((u) => Date.parse(u.created_at) >= since)
    .reduce((sum, u) => sum + Number(u.dollars), 0)
  return { left: Number(settings.credit_dollars) - spent, spent }
}

/** "4¢", "0.8¢", "$1.25" */
export function formatCost(dollars: number): string {
  if (dollars >= 1) return `$${dollars.toFixed(2)}`
  const cents = dollars * 100
  return `${cents < 1 ? cents.toFixed(1) : Math.round(cents)}¢`
}
