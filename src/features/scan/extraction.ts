import type { Json } from '../../lib/database.types'
import type { CardScan } from '../../types/card'
import type { CardFormValues } from '../cards/cardSchema'

type Usage = {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
}

/** The fields the AI reads off a card. */
type Reading = {
  player?: string
  year?: string
  set_name?: string
  insert_name?: string
  parallel?: string
  card_number?: string
  sport?: string
  team?: string
  is_rookie?: boolean
  is_auto?: boolean
  is_patch?: boolean
  is_relic?: boolean
  serial_number?: number | null
  print_run?: number | null
}

/** The checklist search pass, when the first reading had a doubt a checklist could settle. */
export type Lookup = {
  fields?: Reading
  changed?: string[]
  confirmed?: string[]
  still_uncertain?: string[]
  sources?: { url: string; title?: string }[]
  notes?: string
  /** Set when the search didn't run or didn't finish; the first reading stands. */
  error?: string
  model?: string
  usage?: Usage
  searches?: number
}

/** What the server decided after the first reading (see supabase/functions/scan-cards/triage.ts). */
export type Triage = 'ready' | 'lookup' | 'retake' | 'unidentified'

/** What the scan-cards Edge Function stores in card_scans.extraction (see supabase/functions/scan-cards). */
export type Extraction = Reading & {
  inferred_fields?: string[]
  uncertain_fields?: string[]
  needs_lookup?: boolean
  retake?: string
  notes?: string
  model?: string
  usage?: Usage
  triage?: Triage
  lookup?: Lookup
}

export function asExtraction(value: Json | null): Extraction | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Extraction) : null
}

const TEXT_FIELDS = ['player', 'year', 'set_name', 'insert_name', 'parallel', 'card_number', 'sport', 'team'] as const
const FLAG_FIELDS = ['is_rookie', 'is_auto', 'is_patch', 'is_relic'] as const

/** The AI's reading as form values. Anything it didn't return keeps the fallback value. */
export function extractionToForm(extraction: Extraction, fallback: CardFormValues): CardFormValues {
  // Where the checklist search settled a field, its answer wins.
  const e = { ...extraction, ...extraction.lookup?.fields }
  const values = { ...fallback }
  for (const field of TEXT_FIELDS) {
    const v = e[field]
    if (typeof v === 'string' && (v.trim() || field === 'insert_name' || field === 'parallel')) values[field] = v.trim()
  }
  for (const field of FLAG_FIELDS) {
    if (typeof e[field] === 'boolean') values[field] = e[field]
  }
  if (e.serial_number !== undefined) values.serial_number = e.serial_number == null ? '' : String(e.serial_number)
  if (e.print_run !== undefined) values.print_run = e.print_run == null ? '' : String(e.print_run)
  return values
}

export type FieldNotes = Partial<Record<keyof CardFormValues, string>>

const LABELS: Record<string, string> = {
  player: 'Player',
  year: 'Year',
  set_name: 'Set',
  insert_name: 'Insert',
  parallel: 'Parallel',
  card_number: 'Card #',
  sport: 'Sport',
  team: 'Team',
  is_rookie: 'RC',
  is_auto: 'Auto',
  is_patch: 'Patch',
  is_relic: 'Relic',
  serial_number: 'Serial',
  print_run: 'Print run',
}

export const fieldLabel = (field: string) => LABELS[field] ?? field

function shown(value: unknown): string {
  if (value === true) return 'yes'
  if (value === false) return 'no'
  if (value == null || value === '') return 'blank'
  return `“${String(value)}”`
}

/** Per-field flags shown under the form inputs so the collector knows what to double-check. */
export function fieldNotes(e: Extraction): FieldNotes {
  const notes: FieldNotes = {}
  const note = (field: string, text: string) => (notes[field as keyof CardFormValues] = text)
  const lookup = e.lookup?.fields ? e.lookup : null
  for (const field of e.inferred_fields ?? []) {
    if (!lookup?.confirmed?.includes(field)) note(field, 'AI guessed this (not printed clearly). Check it.')
  }
  if (!lookup) {
    for (const field of e.uncertain_fields ?? []) note(field, 'AI isn’t sure about this. Check it.')
    return notes
  }
  for (const field of lookup.still_uncertain ?? []) note(field, 'The checklist search didn’t settle this. Check it.')
  for (const field of lookup.changed ?? []) {
    note(field, `Corrected by the checklist search (first read as ${shown(e[field as keyof Reading])}).`)
  }
  return notes
}

/** The fields that identify a card; doubt about these is worth the collector's attention first. */
const CORE_FIELDS = ['player', 'year', 'set_name', 'card_number']

/**
 * Inbox sections. "needs-you" is for cards the AI couldn't settle: a photo to retake, a card it
 * couldn't identify, or a checklist search that left the card's identity open. They skip the
 * checklist search (or already had their one try) and go to the collector instead.
 */
export type InboxSection = 'unread' | 'reading' | 'needs-you' | 'ready'

export function inboxSection(scan: Pick<CardScan, 'status' | 'extraction'>): InboxSection {
  if (scan.status === 'pending') return 'unread'
  if (scan.status === 'processing' || scan.status === 'looking_up') return 'reading'
  const e = asExtraction(scan.extraction)
  if (scan.status !== 'ready' || !e) return 'needs-you'
  if (e.triage === 'retake' || e.triage === 'unidentified' || e.retake?.trim()) return 'needs-you'
  if (e.lookup?.still_uncertain?.some((f) => CORE_FIELDS.includes(f))) return 'needs-you'
  return 'ready'
}

const SECTION_ORDER: InboxSection[] = ['ready', 'needs-you', 'reading', 'unread']

/** Inbox order: ready cards first (quick to save), then the ones that need the collector. Stable within a section. */
export function sortForReview<T extends Pick<CardScan, 'status' | 'extraction'>>(scans: T[]): T[] {
  return scans
    .map((scan, index) => ({ scan, index, rank: SECTION_ORDER.indexOf(inboxSection(scan)) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((x) => x.scan)
}

/** One line on why a card is waiting on the collector, for the inbox list. */
export function needsYouReason(scan: Pick<CardScan, 'status' | 'extraction'>): string {
  const e = asExtraction(scan.extraction)
  if (scan.status === 'failed' || !e) return 'Couldn’t read: fill in by hand'
  if (e.triage === 'retake' || e.retake?.trim()) return 'Retake suggested'
  if (e.triage === 'unidentified') return 'AI couldn’t identify it'
  const open = (e.lookup?.still_uncertain ?? []).filter((f) => CORE_FIELDS.includes(f))
  return `Checklist didn’t settle: ${open.map(fieldLabel).join(', ')}`
}

/** Batch prices in dollars per million tokens (half the standard rate). */
const BATCH_PRICES: { prefix: string; label: string; input: number; output: number }[] = [
  { prefix: 'claude-sonnet-5-5', label: 'Sonnet 5.5', input: 1, output: 5 },
  { prefix: 'claude-opus-5-5', label: 'Opus 5.5', input: 2, output: 10 },
  { prefix: 'claude-haiku-4-5', label: 'Haiku 4.5', input: 0.5, output: 2.5 },
]

/** Web search is billed per search, on top of tokens. */
const SEARCH_DOLLARS = 0.01

function tokenDollars(model: string | undefined, u: Usage | undefined): number | null {
  const price = BATCH_PRICES.find((p) => model?.startsWith(p.prefix))
  if (!price || !u) return null
  const input =
    (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) * 1.25 + (u.cache_read_input_tokens ?? 0) * 0.1
  return (input * price.input + (u.output_tokens ?? 0) * price.output) / 1_000_000
}

/** Roughly what reading this card cost (with its checklist search, if any), in dollars, or null if unknown. */
export function extractionCost(e: Extraction): { dollars: number; model: string } | null {
  const reading = tokenDollars(e.model, e.usage)
  if (reading == null) return null
  const lookup = e.lookup
    ? (tokenDollars(e.lookup.model, e.lookup.usage) ?? 0) + (e.lookup.searches ?? 0) * SEARCH_DOLLARS
    : 0
  const label = BATCH_PRICES.find((p) => e.model?.startsWith(p.prefix))!.label
  return { dollars: reading + lookup, model: label }
}
