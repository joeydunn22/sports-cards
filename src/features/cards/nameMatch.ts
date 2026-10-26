/**
 * Loose player-name matching, for names typed fast or heard by dictation: "ronald acuna jr" is the
 * checklist's "Ronald Acuña, Jr.", and "Fransisco Lindor" is "Francisco Lindor".
 */

/** Letters and digits only, accents dropped, without a Jr./Sr./II suffix. */
export function nameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[,.]?\s+(jr|sr|ii|iii|iv)\.?$/, '')
    .replace(/[^a-z0-9]/g, '')
}

/** Levenshtein distance, giving up (returning max + 1) once it's over `max`. */
export function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      best = Math.min(best, row[j])
    }
    if (best > max) return max + 1
    prev = row
  }
  return prev[b.length]
}

/** How far apart two names may be and still count as the same player: one slip, two in a long name. */
const allowed = (key: string) => (key.length < 6 ? 0 : key.length < 12 ? 1 : 2)

/** Whether two spellings are the same player. */
export function samePlayer(a: string, b: string): boolean {
  const x = nameKey(a)
  const y = nameKey(b)
  if (!x || !y) return false
  return x === y || editDistance(x, y, allowed(x)) <= allowed(x)
}

/** The closest of `names` to `typed`, if one counts as the same player (an exact key wins). */
export function closestName(typed: string, names: string[]): string | null {
  const key = nameKey(typed)
  if (!key) return null
  let best: { name: string; distance: number } | null = null
  for (const name of names) {
    const distance = editDistance(key, nameKey(name), allowed(key))
    if (distance <= allowed(key) && (!best || distance < best.distance)) best = { name, distance }
    if (distance === 0) break
  }
  return best?.name ?? null
}
