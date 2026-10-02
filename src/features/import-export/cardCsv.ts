import { parseCsv, toCsv } from '../../lib/csv'
import type { Card, CardInput } from '../../types/card'
import { cardFormSchema, emptyCardForm, FLAG_FIELDS, toCardInput, type CardFormValues } from '../cards/cardSchema'

/** Column order for export, the template, and import. `id` lets a re-import update existing cards. */
export const CSV_COLUMNS = [
  'id',
  'player',
  'year',
  'set_name',
  'insert_name',
  'parallel',
  'card_number',
  'sport',
  'team',
  'is_rookie',
  'is_auto',
  'is_patch',
  'is_relic',
  'serial_number',
  'print_run',
  'quantity',
  'is_graded',
  'grade_company',
  'grade',
  'cert_number',
  'raw_condition',
  'purchase_price',
  'purchase_date',
  'estimated_value',
  'sold_price',
  'sold_date',
] as const

const REQUIRED_COLUMNS = ['player', 'year', 'set_name', 'card_number', 'sport'] as const

function cell(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  return String(value)
}

export function cardsToCsv(cards: Card[]): string {
  return toCsv([[...CSV_COLUMNS], ...cards.map((card) => CSV_COLUMNS.map((col) => cell(card[col])))])
}

export function csvTemplate(): string {
  return toCsv([[...CSV_COLUMNS]])
}

const TRUE = /^(yes|y|true|1|x)$/i
const FALSE = /^(no|n|false|0|)$/i

export type ImportRow = { line: number; id: string | null; input: CardInput }
export type ImportError = { line: number; messages: string[] }
export type ImportResult = { rows: ImportRow[]; errors: ImportError[]; fatal: string | null }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Header names are matched loosely: "Set Name", "set_name" and "SET NAME" all work. */
function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

export function parseCardsCsv(text: string): ImportResult {
  const [header, ...body] = parseCsv(text)
  if (!header) return { rows: [], errors: [], fatal: 'The file is empty.' }

  const columns = header.map(normalizeHeader)
  const missing = REQUIRED_COLUMNS.filter((c) => !columns.includes(c))
  if (missing.length) {
    return { rows: [], errors: [], fatal: `Missing required columns: ${missing.join(', ')}. Download the template to see the expected headers.` }
  }

  const rows: ImportRow[] = []
  const errors: ImportError[] = []

  body.forEach((cells, index) => {
    const line = index + 2 // 1-based, after the header row
    const raw: Record<string, string> = {}
    columns.forEach((col, i) => (raw[col] = (cells[i] ?? '').trim()))

    const messages: string[] = []
    const values: CardFormValues = { ...emptyCardForm }
    for (const key of Object.keys(emptyCardForm) as (keyof CardFormValues)[]) {
      if (!(key in raw)) continue
      if ((FLAG_FIELDS as readonly string[]).includes(key)) {
        const v = raw[key]
        if (TRUE.test(v)) (values[key] as boolean) = true
        else if (FALSE.test(v)) (values[key] as boolean) = false
        else messages.push(`${key}: "${v}" isn't yes/no`)
      } else {
        ;(values[key] as string) = raw[key]
      }
    }
    if (values.quantity === '') values.quantity = '1'

    const parsed = cardFormSchema.safeParse(values)
    if (!parsed.success) messages.push(...parsed.error.issues.map((i) => i.message))

    const id = raw.id || null
    if (id && !UUID.test(id)) messages.push(`id "${id}" isn't valid (leave it blank for new cards)`)

    if (messages.length) errors.push({ line, messages })
    else rows.push({ line, id, input: toCardInput(values) })
  })

  return { rows, errors, fatal: null }
}
