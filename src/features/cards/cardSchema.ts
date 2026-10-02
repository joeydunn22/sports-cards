import { z } from 'zod'
import type { Card, CardInput } from '../../types/card'
import { cleanCardNumber } from './cardText'

/** Form state: text inputs are strings, toggles are booleans. Converted to a CardInput on save. */
export type CardFormValues = {
  player: string
  year: string
  set_name: string
  card_number: string
  sport: string
  team: string
  insert_name: string
  parallel: string
  is_rookie: boolean
  is_auto: boolean
  is_patch: boolean
  is_relic: boolean
  serial_number: string
  print_run: string
  quantity: string
  is_graded: boolean
  grade_company: string
  grade: string
  cert_number: string
  raw_condition: string
  purchase_price: string
  purchase_date: string
  estimated_value: string
  sold_price: string
  sold_date: string
}

export const FLAG_FIELDS = ['is_rookie', 'is_auto', 'is_patch', 'is_relic', 'is_graded'] as const

export const emptyCardForm: CardFormValues = {
  player: '',
  year: '',
  set_name: '',
  card_number: '',
  sport: '',
  team: '',
  insert_name: '',
  parallel: '',
  is_rookie: false,
  is_auto: false,
  is_patch: false,
  is_relic: false,
  serial_number: '',
  print_run: '',
  quantity: '1',
  is_graded: false,
  grade_company: '',
  grade: '',
  cert_number: '',
  raw_condition: '',
  purchase_price: '',
  purchase_date: '',
  estimated_value: '',
  sold_price: '',
  sold_date: '',
}

/** Fields kept by "Save & add another": cards are usually entered in batches from one set. */
export const STICKY_FIELDS = ['year', 'set_name', 'insert_name', 'sport'] as const

export function stickyForm(previous: CardFormValues): CardFormValues {
  const next = { ...emptyCardForm }
  for (const field of STICKY_FIELDS) next[field] = previous[field]
  return next
}

const required = (label: string) => z.string().trim().min(1, `${label} is required`)

const positiveInt = z
  .string()
  .trim()
  .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) > 0), 'Use a whole number above 0')

/** Accepts "$1,200.50" style input. */
export function normalizeMoney(value: string): string {
  return value.trim().replace(/[$,\s]/g, '')
}

const money = z
  .string()
  .refine((v) => {
    const n = normalizeMoney(v)
    return n === '' || /^\d+(\.\d{1,2})?$/.test(n)
  }, 'Use an amount like 12.50')

const date = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Use a date like 2024-03-15')

export const cardFormSchema = z
  .object({
    player: required('Player'),
    year: required('Year'),
    set_name: required('Set'),
    card_number: z
      .string()
      .trim()
      .refine((v) => cleanCardNumber(v) !== '', 'Card # is required'),
    sport: required('Sport'),
    team: z.string(),
    insert_name: z.string(),
    parallel: z.string(),
    is_rookie: z.boolean(),
    is_auto: z.boolean(),
    is_patch: z.boolean(),
    is_relic: z.boolean(),
    serial_number: positiveInt,
    print_run: positiveInt,
    quantity: z
      .string()
      .trim()
      .refine((v) => /^\d+$/.test(v) && Number(v) >= 1, 'Quantity must be at least 1'),
    is_graded: z.boolean(),
    grade_company: z.string(),
    grade: z.string(),
    cert_number: z.string(),
    raw_condition: z.string(),
    purchase_price: money,
    purchase_date: date,
    estimated_value: money,
    sold_price: money,
    sold_date: date,
  })
  .superRefine((v, ctx) => {
    const serial = v.serial_number.trim()
    const run = v.print_run.trim()
    if (serial && !run) {
      ctx.addIssue({ code: 'custom', path: ['print_run'], message: 'Add the print run (the /99)' })
    }
    if (serial && run && Number(serial) > Number(run)) {
      ctx.addIssue({ code: 'custom', path: ['serial_number'], message: 'Serial can’t exceed the print run' })
    }
  })

const text = (v: string) => (v.trim() === '' ? null : v.trim())
const int = (v: string) => (v.trim() === '' ? null : Number(v.trim()))
const amount = (v: string) => {
  const n = normalizeMoney(v)
  return n === '' ? null : Number(n)
}

/** Converts validated form values into a database row. */
export function toCardInput(v: CardFormValues): CardInput {
  return {
    player: v.player.trim(),
    year: v.year.trim(),
    set_name: v.set_name.trim(),
    card_number: cleanCardNumber(v.card_number),
    sport: v.sport.trim(),
    team: text(v.team),
    insert_name: text(v.insert_name),
    parallel: text(v.parallel),
    is_rookie: v.is_rookie,
    is_auto: v.is_auto,
    is_patch: v.is_patch,
    is_relic: v.is_relic,
    serial_number: int(v.serial_number),
    print_run: int(v.print_run),
    quantity: Number(v.quantity.trim()),
    is_graded: v.is_graded,
    // Grading and raw condition are mutually exclusive.
    grade_company: v.is_graded ? text(v.grade_company) : null,
    grade: v.is_graded ? text(v.grade) : null,
    cert_number: v.is_graded ? text(v.cert_number) : null,
    raw_condition: v.is_graded ? null : text(v.raw_condition),
    purchase_price: amount(v.purchase_price),
    purchase_date: text(v.purchase_date),
    estimated_value: amount(v.estimated_value),
    sold_price: amount(v.sold_price),
    sold_date: text(v.sold_date),
  }
}

const str = (v: string | number | null) => (v == null ? '' : String(v))

export function fromCard(card: Card): CardFormValues {
  return {
    player: card.player,
    year: card.year,
    set_name: card.set_name,
    card_number: card.card_number,
    sport: card.sport,
    team: str(card.team),
    insert_name: str(card.insert_name),
    parallel: str(card.parallel),
    is_rookie: card.is_rookie,
    is_auto: card.is_auto,
    is_patch: card.is_patch,
    is_relic: card.is_relic,
    serial_number: str(card.serial_number),
    print_run: str(card.print_run),
    quantity: String(card.quantity),
    is_graded: card.is_graded,
    grade_company: str(card.grade_company),
    grade: str(card.grade),
    cert_number: str(card.cert_number),
    raw_condition: str(card.raw_condition),
    purchase_price: str(card.purchase_price),
    purchase_date: str(card.purchase_date),
    estimated_value: str(card.estimated_value),
    sold_price: str(card.sold_price),
    sold_date: str(card.sold_date),
  }
}
