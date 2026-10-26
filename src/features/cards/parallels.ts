/**
 * A set's parallels ("rainbow", public.set_parallels): which colors and finishes exist, and what each is
 * numbered to. In a given set the print run often names the parallel: in 2011 Bowman Chrome Draft, /5 can
 * only be the Red Refractor. Matched per year + set + insert, since base cards and autographs usually
 * have different rainbows. The scan-cards function has a twin (supabase/functions/scan-cards/rainbow.ts).
 */
export type SetParallel = {
  year: string
  set_name: string
  insert_name: string
  parallel: string
  print_run: number | null
  source: string
}

export type ParallelMatch =
  /** Exactly one parallel has this print run. */
  | { kind: 'fill'; parallel: string; text: string }
  /** Several do (usually the 1/1s); the collector picks. */
  | { kind: 'choices'; options: string[]; text: string }
  /** The parallel is known and so is its print run. */
  | { kind: 'printRun'; printRun: number; text: string }
  /** What was typed doesn't fit the list. A soft warning: lists can be incomplete. */
  | { kind: 'conflict'; text: string }

type Spot = { year: string; set_name: string; insert_name: string }

const norm = (value: string | null | undefined) => (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

export const setLabel = ({ year, set_name, insert_name }: Spot) =>
  [year, set_name, insert_name].map((s) => s.trim()).filter(Boolean).join(' ')

/** The parallels of one set and insert, unnumbered first, then from the most to the fewest copies. */
export function parallelsFor<T extends SetParallel>(list: T[], spot: Spot): T[] {
  return list
    .filter(
      (p) =>
        norm(p.year) === norm(spot.year) &&
        norm(p.set_name) === norm(spot.set_name) &&
        norm(p.insert_name) === norm(spot.insert_name),
    )
    .sort((a, b) => (b.print_run ?? Infinity) - (a.print_run ?? Infinity) || a.parallel.localeCompare(b.parallel))
}

/**
 * Whether the set's full parallel list is known (fetched or entered), as opposed to only the parallels
 * of cards saved so far. Any insert counts: one fetch covers the whole set.
 */
export function hasParallelList(list: SetParallel[], year: string, setName: string): boolean {
  return list.some(
    (p) => p.source !== 'collection' && norm(p.year) === norm(year) && norm(p.set_name) === norm(setName),
  )
}

const parseRun = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : null)

const names = (rows: SetParallel[]) => rows.map((p) => p.parallel)

/** What the set's parallel list says about the parallel and print run typed so far, if anything. */
export function matchParallel(
  list: SetParallel[],
  values: Spot & { parallel: string; print_run: string },
): ParallelMatch | null {
  if (!norm(values.year) || !norm(values.set_name)) return null
  const rows = parallelsFor(list, values)
  if (rows.length === 0) return null
  const set = setLabel(rows[0])
  const run = parseRun(values.print_run)
  const sameRun = run == null ? [] : rows.filter((p) => p.print_run === run)

  if (!norm(values.parallel)) {
    if (sameRun.length === 1) {
      return { kind: 'fill', parallel: sameRun[0].parallel, text: `the only /${run} parallel in ${set}` }
    }
    if (sameRun.length > 1) {
      return { kind: 'choices', options: names(sameRun), text: `Numbered /${run} in ${set}:` }
    }
    return null
  }

  const known = rows.find((p) => norm(p.parallel) === norm(values.parallel))
  if (known?.print_run != null) {
    if (run == null) return { kind: 'printRun', printRun: known.print_run, text: `${known.parallel} is /${known.print_run} in ${set}` }
    if (run !== known.print_run) return { kind: 'conflict', text: `${known.parallel} is /${known.print_run} in ${set}, not /${run}.` }
    return null
  }
  if (!known && sameRun.length > 0) {
    return { kind: 'conflict', text: `In ${set}, /${run} is ${names(sameRun).join(' or ')}.` }
  }
  return null
}

/** Parallel suggestions: this set's parallels first, then every other one the collector has used. */
export function parallelSuggestions(list: SetParallel[], spot: Spot, others: string[]): string[] {
  const own = names(parallelsFor(list, spot))
  const seen = new Set(own.map(norm))
  return [...own, ...others.filter((name) => !seen.has(norm(name)))]
}

export type ParallelOption = {
  parallel: string
  print_run: number | null
  /** "Gold Refractor /50", "SuperFractor 1/1". */
  label: string
  /** The parallel typed, or (with none typed) one numbered to the print run typed. */
  state: 'selected' | 'suggested' | null
}

/** The picker under Parallel: the set and insert's rainbow, marking what fits what's typed. */
export function parallelOptions(
  list: SetParallel[],
  values: Spot & { parallel: string; print_run: string },
): ParallelOption[] {
  const run = parseRun(values.print_run)
  const typed = norm(values.parallel)
  return parallelsFor(list, values).map((p) => ({
    parallel: p.parallel,
    print_run: p.print_run,
    label: p.print_run == null ? p.parallel : p.print_run === 1 ? `${p.parallel} 1/1` : `${p.parallel} /${p.print_run}`,
    state: typed
      ? norm(p.parallel) === typed
        ? 'selected'
        : null
      : run != null && p.print_run === run
        ? 'suggested'
        : null,
  }))
}

/** The first `limit` options, plus any marked one further down, so a long rainbow stays short. */
export function firstOptions(options: ParallelOption[], limit: number): ParallelOption[] {
  return options.filter((o, i) => i < limit || o.state != null)
}

/**
 * The card's numbering, as far as the picker goes: the print run typed, 'none' when a scan found no
 * serial number (and none is typed), or null when it isn't known yet.
 */
export type Numbering = number | 'none' | null

export function cardNumbering(printRun: string, unnumbered: boolean): Numbering {
  return parseRun(printRun) ?? (unnumbered && !printRun.trim() ? 'none' : null)
}

/**
 * What the picker shows before "All". With the card's numbering known, only the parallels numbered the
 * same way (Base counts as unnumbered); otherwise the first `limit`. The marked ones always show.
 */
export function shortlist(
  options: ParallelOption[],
  numbering: Numbering,
  limit: number,
): { options: ParallelOption[]; base: boolean } {
  if (numbering == null) return { options: firstOptions(options, limit), base: true }
  const fits = (o: ParallelOption) => (numbering === 'none' ? o.print_run == null : o.print_run === numbering)
  return { options: options.filter((o) => fits(o) || o.state != null), base: numbering === 'none' }
}
