import type { Json } from '../../lib/database.types'
import type { CardFormValues } from '../cards/cardSchema'

/** What the scan-cards Edge Function stores in card_scans.extraction (see supabase/functions/scan-cards). */
export type Extraction = {
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
  inferred_fields?: string[]
  uncertain_fields?: string[]
  needs_lookup?: boolean
  retake?: string
  notes?: string
  model?: string
  usage?: {
    input_tokens?: number
    output_tokens?: number
    cache_creation_input_tokens?: number | null
    cache_read_input_tokens?: number | null
  }
}

export function asExtraction(value: Json | null): Extraction | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Extraction) : null
}

const TEXT_FIELDS = ['player', 'year', 'set_name', 'insert_name', 'parallel', 'card_number', 'sport', 'team'] as const
const FLAG_FIELDS = ['is_rookie', 'is_auto', 'is_patch', 'is_relic'] as const

/** The AI's reading as form values. Anything it didn't return keeps the fallback value. */
export function extractionToForm(e: Extraction, fallback: CardFormValues): CardFormValues {
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

/** Per-field flags shown under the form inputs so the collector knows what to double-check. */
export function fieldNotes(e: Extraction): FieldNotes {
  const notes: FieldNotes = {}
  for (const field of e.inferred_fields ?? []) {
    notes[field as keyof CardFormValues] = 'AI guessed this (not printed clearly). Check it.'
  }
  for (const field of e.uncertain_fields ?? []) {
    notes[field as keyof CardFormValues] = 'AI isn’t sure about this. Check it.'
  }
  return notes
}

/** Batch prices in dollars per million tokens (half the standard rate). */
const BATCH_PRICES: { prefix: string; label: string; input: number; output: number }[] = [
  { prefix: 'claude-sonnet-5-5', label: 'Sonnet 5.5', input: 1, output: 5 },
  { prefix: 'claude-opus-5-5', label: 'Opus 5.5', input: 2, output: 10 },
  { prefix: 'claude-haiku-4-5', label: 'Haiku 4.5', input: 0.5, output: 2.5 },
]

/** Roughly what reading this card cost, in dollars, or null if unknown. */
export function extractionCost(e: Extraction): { dollars: number; model: string } | null {
  const price = BATCH_PRICES.find((p) => e.model?.startsWith(p.prefix))
  const u = e.usage
  if (!price || !u) return null
  const input =
    (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) * 1.25 + (u.cache_read_input_tokens ?? 0) * 0.1
  const dollars = (input * price.input + (u.output_tokens ?? 0) * price.output) / 1_000_000
  return { dollars, model: price.label }
}
