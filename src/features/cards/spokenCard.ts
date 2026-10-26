/**
 * One sentence, typed or dictated, split into the card form's fields:
 * "2011 Bowman Chrome Tyler Colvin red refractor 4 of 5" is year 2011, set Bowman Chrome, player Tyler
 * Colvin, parallel Red Refractor, serial 4/5. Free and on the phone: names are matched against what's
 * known (the set's checklist and rainbow, the collection's own values), the rest by patterns.
 */
import { insertFlags } from './autofill'
import type { CardFormValues } from './cardSchema'
import { closestName, nameKey } from './nameMatch'

/** What the sentence is matched against. Lists put the current set's own values first. */
export type QuickContext = {
  sets: string[]
  inserts: string[]
  parallels: string[]
  teams: string[]
  sports: string[]
  players: string[]
  /** The set's checklist card numbers, for their spelling ("bcp 111" is "BCP111"). */
  cardNumbers: string[]
}

export type QuickParse = {
  values: Partial<CardFormValues>
  /** The form fields filled, in form order. */
  placed: (keyof CardFormValues)[]
  /** Words that didn't fit anything. */
  leftover: string
}

const SMALL: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19,
}
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
}

/** "four of five" → "4 of 5", "one hundred fifty" → "150", "ninety-nine" → "99". */
export function numberWords(text: string): string {
  const word = '(?:' + [...Object.keys(SMALL), ...Object.keys(TENS), 'hundred', 'a'].join('|') + ')'
  return text.replace(new RegExp(`\\b${word}(?:[\\s-]+${word})*\\b`, 'gi'), (phrase) => {
    const words = phrase.toLowerCase().split(/[\s-]+/)
    // "a" counts only as "a hundred".
    if (words.every((w) => w === 'a') || (words[0] === 'a' && words[1] !== 'hundred')) return phrase
    let total = 0
    let current = 0
    for (const w of words) {
      if (w === 'hundred') current = (current || 1) * 100
      else if (w === 'a') current = current || 1
      else if (w in TENS) current += TENS[w]
      else current += SMALL[w]
    }
    total += current
    return String(total)
  })
}

/** Lower case, letters and digits only, accents dropped, and a plural "s" off: "Refractors" is "refractor". */
function tokenKey(word: string): string {
  const key = nameKey(word)
  return key.length > 3 && key.endsWith('s') && !key.endsWith('ss') ? key.slice(0, -1) : key
}

type Token = { text: string; key: string; used: boolean }

function tokenize(text: string): Token[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/^[,.;:!?"“”]+|[,.;:!?"“”]+$/g, ''))
    .filter(Boolean)
    .map((text) => ({ text, key: tokenKey(text), used: false }))
}

/**
 * The longest of `names` written out in the unused tokens (in order, each word exact), or null. Ties go
 * to the name listed first.
 */
function findPhrase(tokens: Token[], names: string[]): { name: string; start: number; end: number } | null {
  let best: { name: string; start: number; end: number } | null = null
  for (const name of names) {
    const keys = name.split(/[\s/]+/).map(tokenKey).filter(Boolean)
    if (!keys.length || (best && keys.length <= best.end - best.start)) continue
    for (let start = 0; start + keys.length <= tokens.length; start++) {
      if (keys.every((k, i) => !tokens[start + i].used && tokens[start + i].key === k)) {
        best = { name, start, end: start + keys.length }
        break
      }
    }
  }
  return best
}

function take(tokens: Token[], start: number, end: number) {
  for (let i = start; i < end; i++) tokens[i].used = true
}

/** Words that join the others and say nothing on their own. */
const FILLER = new Set(
  ['the', 'a', 'an', 'card', 'cards', 'and', 'with', 'parallel', 'version', 'numbered', 'number', 'serial', 'of', 'to', 'out', 'is', 'his', 'its', 'set', 'insert', 'base'].map(tokenKey),
)

const COLORS =
  'red|blue|gold|green|orange|purple|black|silver|pink|yellow|aqua|sky blue|white|bronze|platinum|sapphire|magenta|teal|fuchsia|neon green|copper|rose gold|camo|sepia|negative'
const FINISHES =
  'refractor|x-?fractor|superfractor|prizm|wave|shimmer|mojo|lava|atomic|speckle|holo|foil|cracked ice|disco|mini-diamond|raywave|pulsar|scope|shock|velocity|hyper|mosaic|sparkle|geometric'
/** A parallel nobody has listed yet: colors and finishes ("Green Shimmer Refractor"), or a color on its own. */
const GENERIC_PARALLEL = new RegExp(
  `^(?:(?:${COLORS})\\s+)*(?:(?:${FINISHES})\\s+)*(?:${FINISHES})s?$|^(?:${COLORS})$`,
  'i',
)

/** Words after a color that make it a team's name (as token keys: plural "s" off). */
const TEAM_WORDS = new Set(['sox', 'jay', 'wing', 'devil', 'hawk', 'bird', 'raider'])

const FLAGS: [keyof CardFormValues, RegExp][] = [
  ['is_rookie', /^(rookie|rc)$/],
  ['is_auto', /^(auto|autograph|autographed|signed|signature)$/],
  ['is_relic', /^(relic|patch|jersey|memorabilia|swatch)$/],
]

const FORM_ORDER: (keyof CardFormValues)[] = [
  'year', 'set_name', 'sport', 'player', 'card_number', 'insert_name', 'team', 'parallel', 'serial_number',
  'print_run', 'is_rookie', 'is_auto', 'is_relic', 'is_graded', 'grade_company', 'grade',
]

const titleCase = (text: string) =>
  text.replace(/\S+/g, (w) => (/[A-Z]/.test(w) ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()))

const GRADERS: Record<string, string> = { psa: 'PSA', bgs: 'BGS', beckett: 'BGS', sgc: 'SGC', cgc: 'CGC', hga: 'HGA', csg: 'CSG' }

/** The longest run of unused words that reads as a parallel, if any. */
function looseParallel(tokens: Token[]): { name: string; start: number; end: number } | null {
  for (let size = 4; size >= 1; size--) {
    for (let start = 0; start + size <= tokens.length; start++) {
      const run = tokens.slice(start, start + size)
      if (run.some((t) => t.used)) continue
      // "Red Sox" and "Blue Jays" are teams, not parallels.
      if (TEAM_WORDS.has(tokens[start + size]?.key ?? '')) continue
      const words = run.map((t) => t.text).join(' ')
      if (GENERIC_PARALLEL.test(words)) {
        return { name: titleCase(words.toLowerCase()).replace(/s$/, ''), start, end: start + size }
      }
    }
  }
  return null
}

export function parseCardText(input: string, context: QuickContext): QuickParse {
  const values: Partial<CardFormValues> = {}
  let text = ` ${numberWords(input.replace(/[–—]/g, '-'))} `
  // Patterns first, on the text, each blanking out what it read.
  const read = (pattern: RegExp, onMatch: (m: RegExpExecArray) => boolean) => {
    const m = pattern.exec(text)
    if (m && onMatch(m)) text = text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)
  }

  // "4 of 5", "4 out of 5", "4/5", "numbered 4 of 5"; never a season like "2023/24".
  read(/(?:\b(?:serial\s+)?(?:numbered|number|no\.?)\s+|#\s*)?\b(\d{1,4})\s*(?:\/|\bof\b|\bout of\b)\s*(\d{1,4})\b/i, (m) => {
    const [serial, run] = [Number(m[1]), Number(m[2])]
    if (serial < 1 || serial > run || (m[1].length === 4 && m[2].length === 2)) return false
    values.serial_number = String(serial)
    values.print_run = String(run)
    return true
  })
  // Only the print run: "numbered to 99", "#'d to 99", "out of 99", "/99".
  if (!values.print_run) {
    read(/(?:\b(?:serial\s+)?numbered\s+(?:to|out of|of)?|#'?d\s+(?:to|out of)?|\bout of|\bprint run(?: of)?|(?:^|\s)\/)\s*(\d{1,4})\b/i, (m) => {
      if (Number(m[1]) < 1) return false
      values.print_run = String(Number(m[1]))
      return true
    })
  }
  read(/\b(psa|bgs|beckett|sgc|cgc|hga|csg)\s+(\d{1,2}(?:\.5)?|authentic)\b/i, (m) => {
    values.is_graded = true
    values.grade_company = GRADERS[m[1].toLowerCase()]
    values.grade = /authentic/i.test(m[2]) ? 'Authentic' : m[2]
    return true
  })
  read(/\b((?:19|20)\d{2})(?:\s*[-/]\s*(\d{2}))?\b/, (m) => {
    values.year = m[2] ? `${m[1]}-${m[2]}` : m[1]
    return true
  })
  // "number 38", "card 38", "#38", "number BCP 111"; then a code like "BDC-150", "CPA-JH" or "BCP111".
  const cardNumber = (raw: string) => {
    const key = raw.toLowerCase().replace(/[^a-z0-9]/g, '')
    const known = context.cardNumbers.find((n) => n.toLowerCase().replace(/[^a-z0-9]/g, '') === key)
    if (known) return known
    const parts = /^([a-z]+)[\s-]*(\d.*)$/i.exec(raw.trim())
    return parts ? `${parts[1].toUpperCase()}-${parts[2].toUpperCase()}` : raw.trim().toUpperCase()
  }
  read(/(?:\bcard\s+(?:number\s+|no\.?\s*|#\s*)?|\bnumber\s+|\bno\.\s*|#\s*)([a-z]{0,5}[\s-]?\d{1,4}[a-z]?|[a-z]{2,5}-[a-z0-9]{1,5})\b/i, (m) => {
    values.card_number = cardNumber(m[1])
    return true
  })
  if (!values.card_number) {
    read(/\b([A-Z]{1,5}-?\d{1,4}[A-Z]?|[A-Z]{1,5}-[A-Z0-9]{1,5})\b/, (m) => {
      if (!/\d/.test(m[1]) && !/-/.test(m[1])) return false
      values.card_number = cardNumber(m[1])
      return true
    })
  }

  // Then names, longest first: the set, its inserts and parallels, teams, players.
  const tokens = tokenize(text)
  const phrase = (names: string[], onMatch: (name: string) => void) => {
    const found = findPhrase(tokens, names)
    if (!found) return false
    take(tokens, found.start, found.end)
    onMatch(found.name)
    return true
  }
  phrase(context.sets, (name) => (values.set_name = name))
  phrase(context.inserts, (name) => {
    values.insert_name = name
    for (const flag of insertFlags(name)) values[flag] = true
  })
  // A listed parallel, unless it's part of a longer one said ("Green Shimmer Refractor" over "Refractor").
  const listed = findPhrase(tokens, context.parallels)
  const longer = listed && looseParallel(tokens)
  const parallel = longer && longer.end - longer.start > listed.end - listed.start ? longer : listed
  if (parallel) {
    values.parallel = parallel.name
    take(tokens, parallel.start, parallel.end)
  }
  phrase(context.teams, (name) => (values.team = name))
  phrase(context.sports, (name) => (values.sport = name))
  if (!phrase(context.players, (name) => (values.player = name))) {
    // A name heard a little wrong: the closest known player to any two or three words in a row.
    for (const size of [3, 2]) {
      if (values.player) break
      for (let start = 0; start + size <= tokens.length && !values.player; start++) {
        const run = tokens.slice(start, start + size)
        if (run.some((t) => t.used || !/[a-z]/i.test(t.text) || FILLER.has(t.key))) continue
        const name = closestName(run.map((t) => t.text).join(' '), context.players)
        if (name) {
          values.player = name
          take(tokens, start, start + size)
        }
      }
    }
  }

  // Yes/no flags, from what's left.
  for (const token of tokens) {
    if (token.used) continue
    const flag = FLAGS.find(([, pattern]) => pattern.test(token.key))
    if (flag) {
      Object.assign(values, { [flag[0]]: true })
      token.used = true
    }
  }

  // A parallel nobody has listed yet ("Green Shimmer Refractor").
  if (values.parallel === undefined) {
    const loose = looseParallel(tokens)
    if (loose) {
      values.parallel = loose.name
      take(tokens, loose.start, loose.end)
    }
  }
  // "Base" said out loud: no parallel.
  if (values.parallel === undefined && tokens.some((t) => !t.used && t.key === 'base')) values.parallel = ''

  // An unknown player: the longest run of plain words left, two at least.
  if (!values.player) {
    let best: [number, number] | null = null
    for (let start = 0; start < tokens.length; start++) {
      let end = start
      while (end < tokens.length && !tokens[end].used && /^[a-z][a-z'.-]*$/i.test(tokens[end].text) && !FILLER.has(tokens[end].key)) end++
      if (end - start >= 2 && (!best || end - start > best[1] - best[0])) best = [start, end]
    }
    if (best) {
      values.player = titleCase(tokens.slice(best[0], best[1]).map((t) => t.text).join(' '))
      take(tokens, best[0], best[1])
    }
  }
  // A lone number left over is the card number ("Tyler Colvin 38"), with letters said just before it
  // ("rd 12" is RD-12).
  if (!values.card_number) {
    const at = tokens.findIndex((t) => !t.used && /^\d{1,4}[a-z]?$/i.test(t.text))
    if (at >= 0) {
      const before = tokens[at - 1]
      const prefix = before && !before.used && /^[a-z]{1,4}$/i.test(before.text) && !FILLER.has(before.key) ? before : null
      values.card_number = cardNumber(prefix ? `${prefix.text} ${tokens[at].text}` : tokens[at].text)
      take(tokens, prefix ? at - 1 : at, at + 1)
    }
  }

  const leftover = tokens
    .filter((t) => !t.used && !FILLER.has(t.key))
    .map((t) => t.text)
    .join(' ')
  return { values, placed: FORM_ORDER.filter((field) => field in values), leftover }
}

const uniq = (lists: string[][]): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const name of lists.flat()) {
    const key = name.trim().toLowerCase()
    if (key && !seen.has(key)) {
      seen.add(key)
      out.push(name.trim())
    }
  }
  return out
}

/**
 * What to match a sentence against: the set's own checklist and rainbow first (its current insert's
 * parallels before the rest), then the collection's values and every known set name.
 */
export function buildQuickContext(
  collection: { sets: string[]; inserts: string[]; parallels: string[]; teams: string[]; sports: string[]; players: string[] },
  set: { parallels: { insert_name: string; parallel: string }[]; spots: { player: string; insert_name: string | null; card_number: string }[] },
  insertName: string,
): QuickContext {
  const here = (insert: string | null) => (insert ?? '').trim().toLowerCase() === insertName.trim().toLowerCase()
  return {
    sets: collection.sets,
    inserts: uniq([set.spots.map((s) => s.insert_name ?? ''), set.parallels.map((p) => p.insert_name), collection.inserts]),
    parallels: uniq([
      set.parallels.filter((p) => here(p.insert_name)).map((p) => p.parallel),
      set.parallels.map((p) => p.parallel),
      collection.parallels,
    ]),
    teams: collection.teams,
    sports: collection.sports,
    players: uniq([set.spots.filter((s) => here(s.insert_name)).map((s) => s.player), set.spots.map((s) => s.player), collection.players]),
    cardNumbers: set.spots.map((s) => s.card_number),
  }
}
