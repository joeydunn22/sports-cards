/**
 * Baseball Cardpedia (baseballcardpedia.com), a free baseball card wiki with an open API: a set's page
 * has an odds table naming every parallel with what it's numbered to, and the full checklist by insert.
 * Fetching it costs nothing, so baseball sets get their parallel list and checklist from here before any
 * paid AI search. Pure (page matching and parsing), so it's unit tested (cardpedia.test.ts, run by Vitest).
 */

export type PageMatch = {
  title: string
  /**
   * A version the page holds that's its own set by our rules: "Chrome" for 2011 Bowman Chrome Draft,
   * found on the 2011 Bowman Draft Picks & Prospects page as "Chrome Red Refractor" and so on.
   */
  variant: string | null
}
export type ParsedParallel = { insert_name: string; parallel: string; print_run: number | null }
export type ParsedCard = { insert_name: string; card_number: string; player: string; is_rookie: boolean }
export type ParsedSet = { parallels: ParsedParallel[]; cards: ParsedCard[]; inserts: string[] }

// ---- Matching our set name to a page ----

/** Brands Cardpedia sometimes leaves off ("2024 Finest" for Topps Finest). */
const OPTIONAL_BRANDS = new Set(['topps', 'panini'])
/** Words our set name may add to a page's: a series of the same product, or the Chrome version. */
const SERIES_WORDS = new Set(['series', '1', '2', '3', 'high', 'number', 'numbers'])
const NUMBER_WORDS: Record<string, string> = { one: '1', two: '2', three: '3' }

function words(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[’']s\b/g, '')
    .replace(/\bpicks\s*(&|and)\s*prospects\b/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && w !== 'and')
    .map((w) => NUMBER_WORDS[w] ?? w)
}

/** The words that identify a set, without a brand Cardpedia may or may not use. */
function core(name: string): Set<string> {
  const all = words(name)
  const without = all.filter((w) => !OPTIONAL_BRANDS.has(w))
  return new Set(without.length ? without : all)
}

/**
 * The page for a set, from the year's page titles: same words, ignoring the brand ("Topps Finest" is
 * "2024 Finest"), or the page plus a series ("Topps Series 1" is "2024 Topps") or "Chrome" ("Bowman
 * Chrome Draft" is "2019 Bowman Draft", whose Chrome cards are listed there). Null when nothing fits.
 */
export function matchPage(year: string, setName: string, titles: string[]): PageMatch | null {
  const ours = new Set(words(setName))
  const prefix = `${year.trim()} `
  let best: { title: string; variant: string | null; score: number } | null = null
  for (const title of titles) {
    if (!title.startsWith(prefix)) continue
    const name = title.slice(prefix.length)
    if (![...core(name)].every((w) => ours.has(w))) continue
    const theirs = new Set(words(name))
    const extra = [...core(setName)].filter((w) => !theirs.has(w))
    if (!extra.every((w) => SERIES_WORDS.has(w) || w === 'chrome')) continue
    const variant = extra.includes('chrome') ? 'Chrome' : null
    // An exact match beats a series or Chrome match; then the title closest to how we wrote it.
    const shared = words(title).filter((w) => words(setName).includes(w)).length
    const score = extra.length * 100 - shared + title.length / 1000
    if (!best || score < best.score) best = { title, variant, score }
  }
  return best && { title: best.title, variant: best.variant }
}

// ---- Reading the page ----

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code: string) => {
    if (code[0] !== '#') return ENTITIES[code.toLowerCase()] ?? all
    const n = /^#x/i.test(code) ? parseInt(code.slice(2), 16) : Number(code.slice(1))
    return Number.isFinite(n) ? String.fromCodePoint(n) : all
  })
}

const clean = (html: string) =>
  decode(html.replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim()

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'ratio'; rows: string[][] }
  | { kind: 'list'; items: string[] }

/** The page as a flat run of headings, odds tables and lists, in order. */
function blocks(html: string): Block[] {
  const out: Block[] = []
  const pattern = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>|<table class="ratio"[^>]*>([\s\S]*?)<\/table>|<ul[^>]*>([\s\S]*?)<\/ul>/g
  for (const m of html.matchAll(pattern)) {
    if (m[1]) out.push({ kind: 'heading', level: Number(m[1]), text: clean(m[2]) })
    else if (m[3] != null) {
      const rows = [...m[3].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) =>
        [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => clean(c[1])),
      )
      out.push({ kind: 'ratio', rows })
    } else out.push({ kind: 'list', items: [...(m[4] ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((i) => clean(i[1])) })
  }
  return out
}

/** The blocks under one top-level (h1) section, such as "Checklist", each with its heading path. */
function section(all: Block[], name: string): { block: Block; path: string[] }[] {
  const out: { block: Block; path: string[] }[] = []
  let inside = false
  const path: string[] = []
  for (const block of all) {
    if (block.kind === 'heading') {
      if (block.level === 1) {
        inside = block.text.toLowerCase() === name.toLowerCase()
        path.length = 0
        continue
      }
      path.length = Math.max(0, block.level - 2)
      path[block.level - 2] = block.text
      continue
    }
    if (inside) out.push({ block, path: path.filter(Boolean) })
  }
  return out
}

const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
/** "Ascensions" and "Ascension", "Prospects" and "Prospect" are the same subset. */
const stem = (value: string) => key(value).replace(/s$/, '')

/** Headings that split a list without naming a subset: series, tiers, the base set itself. */
const SPLIT = /^(base( set| cards)?|short (set|prints?)|series (one|two|three|\d)|(heritage|high number) series|tier [ivx\d]+|common|uncommon|rare|epic|legendary|hobby|retail|jumbo|update)$/i
/** Lists that repeat base card numbers with a twist; they'd shadow the real card in the checklist. */
const VARIATIONS = /gimmick|variation|error|factory|photo|image|throwback|traded|kayfabe|fun face|winners?|stats|twinks|code cards?|redemption|mini|oversized/i
/** Rows of the odds table that aren't a parallel anyone would write on a card. */
const NOT_A_PARALLEL = /gimmick|variation|error|code card|redemption|exchange|box ?loader|:|^(topps|panini|bowman|donruss)$/i

/** "one-of-one", "four for each" (printing plates are 1/1 each), "2,024", "220*". Null when not numbered or unknown. */
function printRun(value: string): number | null {
  const text = value.toLowerCase()
  if (/one-of-one|one of one|^1\/1$|for each/.test(text)) return 1
  const digits = text.replace(/[,*\s]/g, '')
  return /^\d+$/.test(digits) && Number(digits) > 0 ? Number(digits) : null
}

const total = (value: string) => {
  const digits = value.replace(/[,*\s]/g, '')
  return /^\d+$/.test(digits) ? Number(digits) : null
}

/** "Refractors" in an odds row is one Refractor parallel. */
const singular = (name: string) =>
  name
    .replace(/\b(Refractor|Fractor|Prizm|X-Fractor)s\b/gi, '$1')
    .replace(/(Fractor)s\b/gi, '$1')
    .trim()

/**
 * What's left of an odds row after a subset's name in front ("Grand Gamers Blue" → "Blue"), allowing
 * for spelling drift between the table and the headings ("Autograph Black" under "Autographs").
 */
function after(name: string, head: string): string | null {
  const parts = name.split(' ')
  // The table often drops a heading's leading year: "Summer Camp" for "2020 Summer Camp".
  const heads = [stem(head), stem(head.replace(/^\d{4} /, ''))]
  for (let i = 1; i < parts.length; i++) {
    if (heads.includes(stem(parts.slice(0, i).join(' ')))) return parts.slice(i).join(' ')
  }
  return null
}

/** The same with the subset's name behind ("Holo Autographed Rated Rookies" → "Holo"). */
function before(name: string, head: string): string | null {
  const parts = name.split(' ')
  for (let i = parts.length - 1; i > 0; i--) {
    if (stem(parts.slice(i).join(' ')) === stem(head)) return parts.slice(0, i).join(' ')
  }
  return null
}

/** A row like "Stars Of MLB Chrome" or "Major League Material Autographs" is another subset, not a parallel. */
const VERSION = /^(chrome|foil|foilboard|mini|s?sp|relics?|autographs?|autographed|patch(es)?|(dual|triple) (autographs?|relics?))$/i
/** Base-set tiers in front of a parallel: "Common Refractor" and "Uncommon Refractor" are both the Refractor. */
const TIER = /^(common|uncommon|rare|epic|tier [ivx\d]+) (.+)$/i

type Head = { name: string; base: boolean }

/** A card number with letters ("BCP-151") rather than a plain base number ("151"). */
const prefixed = (cardNumber: string) => /[a-z]/i.test(cardNumber)

/**
 * The checklist's subsets: inserts and autographs (named by their heading under Inserts, Autographs,
 * and so on) and subsets of the base set with their own numbering (Bowman's BCP Prospects; Heritage's
 * League Leaders share the base numbers, so they're base cards). Splits such as series and tiers aren't
 * subsets.
 */
function checklistHeads(checklist: { block: Block; path: string[] }[]): Head[] {
  const heads = new Map<string, Head>()
  for (const { block, path } of checklist) {
    const [top, ...rest] = path
    const sub = rest.find((p) => !SPLIT.test(p))
    if (!top || !sub || /^parallels?$/i.test(top)) continue
    const base = /^base/i.test(top)
    if (base) {
      if (VARIATIONS.test(sub) || block.kind !== 'list') continue
      const first = block.items.map(parseCard).find(Boolean)
      if (!first || !prefixed(first.card_number)) continue
    }
    if (!heads.has(key(sub))) heads.set(key(sub), { name: sub, base })
  }
  return [...heads.values()]
}

/**
 * Parallels from the odds table: base parallels follow the base row ("Gold", numbered to 2024), and an
 * insert's follow its own row with its name in front ("Grand Gamers Blue", or "Holo Autographed Rated
 * Rookies" with it behind). With a variant, only that version's rows count, without the variant word.
 */
function parseParallels(rows: string[][], heads: Head[], variant: string | null): ParsedParallel[] {
  const known: Head[] = [...heads]
  const headFor = (name: string) =>
    known.find((h) => stem(h.name) === stem(name) || stem(h.name.replace(/^\d{4} /, '')) === stem(name)) ?? null
  const found = new Map<string, ParsedParallel & { runs: Set<number | null> }>()
  let baseTotal: number | null = null
  let sawVariant = false

  const add = (insert: string, rawName: string, run: number | null) => {
    const parallel = singular(rawName.replace(/\s+/g, ' '))
    if (!/[a-z]/i.test(parallel) || NOT_A_PARALLEL.test(parallel) || SPLIT.test(parallel)) return
    const id = `${key(insert)}|${key(parallel)}`
    const seen = found.get(id)
    if (seen) seen.runs.add(run)
    else found.set(id, { insert_name: insert, parallel, print_run: run, runs: new Set([run]) })
  }

  for (const row of rows) {
    let [name = '', count = '', numbered = ''] = row
    if (!name || /^cards?$/i.test(name)) continue
    if (variant) {
      // Only the variant's rows: "Chrome Red Refractor" is the Red Refractor of the Chrome set.
      if (name.toLowerCase() === variant.toLowerCase()) {
        baseTotal = total(count)
        sawVariant = true
        continue
      }
      const rest = after(name, variant)
      if (rest) {
        name = rest
        sawVariant = true
      }
      else if (SPLIT.test(name) || !known.some((h) => !h.base && after(name, h.name))) continue
    }
    const run = printRun(numbered)
    if (SPLIT.test(name)) {
      baseTotal ??= total(count)
      continue
    }
    if (headFor(name)) continue
    // "Chrome" on its own is a version of the set with its own parallels after it ("Chrome Red Refractor").
    if (VERSION.test(name)) {
      known.push({ name, base: false })
      continue
    }
    const tier = TIER.exec(name)
    if (tier) {
      add('', tier[2], run)
      continue
    }

    // The longest subset whose name starts (or ends) the row.
    const byLength = [...known].sort((a, b) => b.name.length - a.name.length)
    const front = byLength.find((h) => after(name, h.name))
    if (front) {
      const rest = after(name, front.name)!
      if (VERSION.test(rest)) known.push({ name, base: false })
      else add(front.name, rest, run)
      continue
    }
    const back = byLength.find((h) => !h.base && before(name, h.name))
    if (back) {
      add(back.name, before(name, back.name)!, run)
      continue
    }
    // A subset named inside the row: "Speckle Prospect Refractors" for Prospects.
    const inner = byLength.find((hd) => hd.base && innerWord(hd.name).test(name))
    if (inner) {
      add(inner.name, name.replace(innerWord(inner.name), ' '), run)
      continue
    }
    const size = total(count)
    // Not named after a subset: a base parallel if it covers most of the base set, otherwise an insert.
    if (baseTotal != null && size != null && size >= baseTotal * 0.5) {
      add('', name, run)
      // A parallel of more cards than the base has also covers the base set's own subsets (Prospects).
      if (size > baseTotal) for (const h of heads) if (h.base) add(h.name, name, run)
    } else {
      known.push({ name, base: false })
    }
  }

  // A page without the variant's rows (no Chrome cards on it) isn't that set's page after all.
  if (variant && !sawVariant) return []
  // Tiers can number one parallel differently (Common Gold /50, Uncommon Gold /25): leave those blank.
  return [...found.values()].map(({ runs, ...p }) => ({ ...p, print_run: runs.size === 1 ? p.print_run : null }))
}

/** A one-word subset's name as a word inside an odds row, singular or plural ("Prospect", "Prospects"). */
function innerWord(name: string): RegExp {
  const single = name.replace(/s$/i, '')
  return /^[a-z]+$/i.test(single) ? new RegExp(`\\s*\\b${single}s?\\b`, 'i') : /(?!)/
}

/** "89B-1 Jordan Lawlar", "BDPP1 John Hicks UER (…)", "CPA-AAM Adael Amador", "15 Henry Davis (RC)". */
const CARD = /^([A-Z0-9]+(?:[-–][A-Z0-9]+)*[a-z]?)\s+(.+)$/

function looksLikeCardNumber(token: string): boolean {
  return /\d/.test(token) || /^[A-Z0-9]+[-–][A-Z0-9]+/.test(token)
}

function parseCard(item: string): { card_number: string; player: string; is_rookie: boolean } | null {
  const m = CARD.exec(item)
  if (!m || !looksLikeCardNumber(m[1])) return null
  let rest = m[2]
  const rookie = /(^|\s)\(?K?RC\)?(\s|$)/.test(rest)
  rest = rest
    .replace(/\([^)]*\)/g, ' ')
    .replace(/(^|\s)(K?RC|UER|SP|SSP|CL)(?=\s|$)/g, ' ')
    // Trailing numbers are per-card print runs or contest tallies, not part of the name.
    .replace(/(\s+\d[\d,]*)+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!rest || !/[a-z]/i.test(rest)) return null
  return { card_number: m[1].replace('–', '-'), player: rest, is_rookie: rookie }
}

/**
 * Card numbers and players by insert. Lists under the base set's series and tiers are base cards ("");
 * lists under an insert's heading belong to it (series splits ignored). Variations that repeat base
 * numbers, and lists of a parallel's own numbering, are skipped.
 */
function parseCards(checklist: { block: Block; path: string[] }[], parallels: ParsedParallel[]): ParsedCard[] {
  const parallelNames = new Set(parallels.map((p) => key(p.parallel)))
  const cards = new Map<string, ParsedCard>()
  for (const { block, path } of checklist) {
    if (block.kind !== 'list') continue
    const [top, ...rest] = path
    if (!top || /^parallels?$/i.test(top)) continue
    const subsets = rest.filter((p) => !SPLIT.test(p))
    if (path.some((p, i) => i > 0 && (VARIATIONS.test(p) || parallelNames.has(key(p))))) continue
    const base = /^base/i.test(top)
    const parsed = block.items.map(parseCard)
    // A list of parallel names or notes, not cards.
    if (parsed.filter(Boolean).length < Math.max(1, block.items.length * 0.6)) continue
    for (const card of parsed) {
      if (!card) continue
      // In the base set, only a subset with its own numbering is an insert (see checklistHeads).
      const insert = base ? (subsets[0] && prefixed(card.card_number) ? subsets[0] : '') : (subsets[0] ?? top)
      const id = `${key(insert)}|${key(card.card_number)}`
      if (!cards.has(id)) cards.set(id, { insert_name: insert, ...card })
    }
  }
  return [...cards.values()]
}

/** Everything the page says about the set. A variant's checklist isn't on the page, so only its parallels. */
export function parseSetPage(html: string, variant: string | null = null): ParsedSet {
  const all = blocks(html)
  const checklist = section(all, 'Checklist')
  const heads = checklistHeads(checklist)
  const rows = section(all, 'Insertion Ratios').flatMap(({ block }) => (block.kind === 'ratio' ? block.rows : []))
  const parallels = parseParallels(rows, heads, variant)
  const cards = variant ? [] : parseCards(checklist, parallels)
  return { parallels, cards, inserts: heads.map((hd) => hd.name) }
}

/** Our spelling of an insert when the collector already uses one that's clearly the same subset. */
export function withCollectorInserts<T extends { insert_name: string }>(rows: T[], theirs: string[]): T[] {
  const byStem = new Map(theirs.map((name) => [stem(name), name]))
  return rows.map((row) => {
    const mine = row.insert_name && byStem.get(stem(row.insert_name))
    return mine && mine !== row.insert_name ? { ...row, insert_name: mine } : row
  })
}
