/**
 * Set parallel lists (public.set_parallels): each set's colors and finishes with their print runs. A
 * print run read off the card often names the parallel the photo can't (red against pink under a
 * toploader). Checked right after the first reading, before triage, so a settled parallel needs no web
 * search. Pure, so it's unit tested (rainbow.test.ts, run by Vitest from the app). The app's form has a
 * twin in src/features/cards/parallels.ts.
 */
export type Rainbow = {
  year: string
  set_name: string
  insert_name: string
  parallel: string
  print_run: number | null
  source: 'collection' | 'search' | 'manual'
  source_url: string | null
}

/** What the parallel list did to a reading; stored as extraction.rainbow and shown in review. */
export type RainbowNote = {
  kind: 'settled' | 'conflict' | 'choices'
  /** The parallel as first read, when it was changed. */
  was?: string
  note: string
}

type Reading = Record<string, unknown> & { uncertain_fields?: string[]; needs_lookup?: boolean; notes?: string }

const norm = (value: unknown) => (typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9]/g, '') : '')
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

/** The parallels of the set and insert the reading names. */
export function rainbowFor(reading: Reading, list: Rainbow[]): Rainbow[] {
  return list.filter(
    (p) =>
      norm(p.year) === norm(reading.year) &&
      norm(p.set_name) === norm(reading.set_name) &&
      norm(p.insert_name) === norm(reading.insert_name),
  )
}

/**
 * Settles or checks the parallel from the print run. Needs the year, set, insert and print run read with
 * confidence. One parallel with that print run: it's that one. Several (the 1/1s): the choices go in the
 * note. A confident parallel whose known print run differs: flagged for the collector.
 */
export function settleParallel(reading: Reading, list: Rainbow[]): { reading: Reading; rainbow: RainbowNote } | null {
  const unsure = new Set(reading.uncertain_fields ?? [])
  if (['year', 'set_name', 'insert_name', 'print_run'].some((f) => unsure.has(f))) return null
  const run = typeof reading.print_run === 'number' ? reading.print_run : null
  if (run == null) return null
  const rows = rainbowFor(reading, list)
  if (rows.length === 0) return null
  const set = [text(rows[0].year), text(rows[0].set_name), text(rows[0].insert_name)].filter(Boolean).join(' ')
  const sameRun = rows.filter((p) => p.print_run === run)
  const read = text(reading.parallel)

  if (unsure.has('parallel') || !read) {
    if (sameRun.length === 1) {
      const parallel = sameRun[0].parallel
      const doubts = [...unsure].filter((f) => f !== 'parallel')
      return {
        reading: {
          ...reading,
          parallel,
          uncertain_fields: doubts,
          // The parallel was the only doubt left, so there's nothing for a checklist search to do.
          needs_lookup: doubts.length > 0 && reading.needs_lookup === true,
        },
        rainbow: {
          kind: 'settled',
          ...(norm(read) !== norm(parallel) ? { was: read } : {}),
          note: `The only /${run} parallel in ${set} is ${parallel}.`,
        },
      }
    }
    if (sameRun.length > 1) {
      const names = sameRun.map((p) => p.parallel).join(', ')
      return { reading, rainbow: { kind: 'choices', note: `Numbered /${run} in ${set}: ${names}. Check which one.` } }
    }
    return null
  }

  const known = rows.find((p) => norm(p.parallel) === norm(read))
  const conflict =
    known?.print_run != null && known.print_run !== run
      ? `${known.parallel} is /${known.print_run} in ${set}, but the serial reads /${run}. Check both.`
      : !known && sameRun.length > 0
        ? `In ${set}, /${run} is ${sameRun.map((p) => p.parallel).join(' or ')}, not ${read}. Check both.`
        : null
  if (!conflict) return null
  return {
    reading: { ...reading, uncertain_fields: [...unsure, 'parallel'] },
    rainbow: { kind: 'conflict', note: conflict },
  }
}

/** The set's parallel list for the checklist search prompt, or "" when none is known. */
export function rainbowHint(reading: Reading, list: Rainbow[]): string {
  const rows = rainbowFor(reading, list)
  if (rows.length === 0) return ''
  const items = rows.map((p) => `${p.parallel}${p.print_run != null ? ` /${p.print_run}` : ' (not numbered)'}`)
  return `Known parallels of this set: ${items.join(', ')}.`
}

/** Whether a fetched or entered parallel list exists for the reading's year and set (any insert). */
export function hasList(reading: Reading, list: Rainbow[]): boolean {
  return list.some(
    (p) => p.source !== 'collection' && norm(p.year) === norm(reading.year) && norm(p.set_name) === norm(reading.set_name),
  )
}

/** Cleans the rows a parallel-list search recorded into set_parallels rows (source 'search'). */
export function rowsFromSearch(
  year: string,
  setName: string,
  groups: { insert_name?: unknown; parallels?: unknown }[],
  sourceUrl: string | null,
): Rainbow[] {
  const rows = new Map<string, Rainbow>()
  for (const group of groups) {
    const insert = text(group.insert_name)
    for (const item of Array.isArray(group.parallels) ? group.parallels : []) {
      const parallel = text((item as { name?: unknown }).name)
      const run = (item as { print_run?: unknown }).print_run
      if (!parallel || /^base$/i.test(parallel)) continue
      const row: Rainbow = {
        year: year.trim(),
        set_name: setName.trim(),
        insert_name: insert,
        parallel,
        print_run: typeof run === 'number' && Number.isInteger(run) && run > 0 ? run : null,
        source: 'search',
        source_url: sourceUrl,
      }
      rows.set(`${norm(insert)}|${norm(parallel)}`, row)
    }
  }
  return [...rows.values()]
}
