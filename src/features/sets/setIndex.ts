/**
 * The Sets page's view of the card database: one entry per year + set, from its parallel list
 * (public.set_parallels), the checklist spots it knows (public.checklist_entries), and AI fetches of
 * its parallel list (public.parallel_fetches). Pure, so it's unit tested.
 */
import { parseCsv, toCsv } from '../../lib/csv'

export type SetRef = { year: string; set_name: string }
type ParallelLike = SetRef & { source: string }
type FetchLike = SetRef & { status: string }

export type SetSummary = SetRef & {
  key: string
  parallels: number
  cards: number
  /** A fetched or hand-entered list, not just parallels learned from single cards. */
  hasList: boolean
  fetch: FetchLike | null
}

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
export const setKey = (s: SetRef) => `${norm(s.year)}|${norm(s.set_name)}`
export const sameSet = (a: SetRef, b: SetRef) => setKey(a) === setKey(b)
export const setPath = (s: SetRef) => `/sets/${encodeURIComponent(s.year)}/${encodeURIComponent(s.set_name)}`

/** Every set the database knows anything about, newest year first. */
export function listSets<F extends FetchLike>(
  parallels: ParallelLike[],
  spots: SetRef[],
  fetches: F[],
): (SetSummary & { fetch: F | null })[] {
  const sets = new Map<string, SetSummary & { fetch: F | null }>()
  const entry = (s: SetRef) => {
    const key = setKey(s)
    let found = sets.get(key)
    if (!found) {
      found = { year: s.year, set_name: s.set_name, key, parallels: 0, cards: 0, hasList: false, fetch: null }
      sets.set(key, found)
    }
    return found
  }
  for (const p of parallels) {
    const s = entry(p)
    s.parallels++
    if (p.source !== 'collection') s.hasList = true
  }
  for (const spot of spots) entry(spot).cards++
  for (const f of fetches) entry(f).fetch = f
  return [...sets.values()].sort((a, b) => b.year.localeCompare(a.year) || a.set_name.localeCompare(b.set_name))
}

/** "2011 Bowman Chrome Draft" per line (a season like "2023-24" works too). */
export function parseSetLines(text: string): { sets: SetRef[]; bad: string[] } {
  const sets = new Map<string, SetRef>()
  const bad: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/\s+/g, ' ')
    if (!line) continue
    const match = /^(\d{4}(?:[-/]\d{2,4})?) (.+)$/.exec(line)
    if (!match) {
      bad.push(line)
      continue
    }
    const set = { year: match[1].replace('/', '-'), set_name: match[2] }
    if (!sets.has(setKey(set))) sets.set(setKey(set), set)
  }
  return { sets: [...sets.values()], bad }
}

const COLUMNS = ['year', 'set', 'insert', 'parallel', 'print_run'] as const
const ALIASES: Record<string, (typeof COLUMNS)[number]> = {
  year: 'year',
  set: 'set',
  set_name: 'set',
  insert: 'insert',
  insert_name: 'insert',
  parallel: 'parallel',
  print_run: 'print_run',
  printrun: 'print_run',
  numbered: 'print_run',
}

export type ParallelCsvRow = SetRef & { insert_name: string; parallel: string; print_run: number | null }

export function parallelsTemplate(): string {
  return toCsv([
    [...COLUMNS],
    ['2011', 'Bowman Chrome Draft', '', 'Refractor', ''],
    ['2011', 'Bowman Chrome Draft', '', 'Red Refractor', '5'],
    ['2011', 'Bowman Chrome Draft', 'Prospect Autographs', 'Gold Refractor', '50'],
  ])
}

/** Parallels from a CSV with columns year, set, insert, parallel, print_run (blank = not numbered). */
export function parseParallelsCsv(text: string): { rows: ParallelCsvRow[]; errors: string[] } {
  const [header, ...lines] = parseCsv(text.replace(/^﻿/, ''))
  const columns = (header ?? []).map((h) => ALIASES[h.trim().toLowerCase().replace(/[\s-]+/g, '_')])
  const missing = ['year', 'set', 'parallel'].filter((c) => !columns.includes(c as (typeof COLUMNS)[number]))
  if (missing.length) return { rows: [], errors: [`The first row needs the columns ${COLUMNS.join(', ')}.`] }
  const rows: ParallelCsvRow[] = []
  const errors: string[] = []
  lines.forEach((cells, i) => {
    if (cells.every((c) => !c.trim())) return
    const get = (name: (typeof COLUMNS)[number]) => (cells[columns.indexOf(name)] ?? '').trim()
    const run = get('print_run').replace(/^\//, '')
    const row = {
      year: get('year'),
      set_name: get('set'),
      insert_name: get('insert'),
      parallel: get('parallel'),
      print_run: /^\d+$/.test(run) && Number(run) > 0 ? Number(run) : null,
    }
    const line = i + 2
    if (!row.year || !row.set_name || !row.parallel) errors.push(`Line ${line}: year, set and parallel are required.`)
    else if (run && row.print_run == null) errors.push(`Line ${line}: the print run should be a number, like 99.`)
    else rows.push(row)
  })
  return { rows, errors }
}
