/**
 * MLB team colours for the card screens. A team is matched through standardTeam(), so "Reds", "CIN" and
 * "Cincinnati Reds" are all the same club, and an old card keeps its old club's colours ("Expos", the
 * Florida Marlins' teal). Other sports aren't covered yet: they get no colour, like unknown teams.
 */

import { standardTeam } from './teams'

export type TeamColors = {
  /** The club's signature colour; used for washes behind the card. */
  primary: string
  secondary: string
  /** Whichever team colour reads on the app's near-black background, for text and edges. */
  onDark: string
}

/** [signature colour, second colour], keyed by the full names in teams.ts. */
const MLB: Record<string, [string, string]> = {
  'Arizona Diamondbacks': ['#A71930', '#E3D4AD'],
  'Atlanta Braves': ['#CE1141', '#13274F'],
  'Milwaukee Braves': ['#C8102E', '#0C2340'],
  'Boston Braves': ['#C8102E', '#0C2340'],
  'Baltimore Orioles': ['#DF4601', '#000000'],
  'St. Louis Browns': ['#5C3317', '#F47B20'],
  'Boston Red Sox': ['#BD3039', '#0C2340'],
  'Chicago Cubs': ['#0E3386', '#CC3433'],
  'Chicago White Sox': ['#27251F', '#C4CED4'],
  'Cincinnati Reds': ['#C6011F', '#000000'],
  'Cleveland Indians': ['#E31937', '#0C2340'],
  'Cleveland Guardians': ['#E50022', '#00385D'],
  'Colorado Rockies': ['#33006F', '#C4CED4'],
  'Detroit Tigers': ['#0C2340', '#FA4616'],
  'Houston Astros': ['#EB6E1F', '#002D62'],
  'Houston Colt .45s': ['#002D62', '#EB6E1F'],
  'Kansas City Royals': ['#004687', '#BD9B60'],
  'Los Angeles Angels': ['#BA0021', '#003263'],
  'Anaheim Angels': ['#BA0021', '#003263'],
  'California Angels': ['#003263', '#BA0021'],
  'Los Angeles Dodgers': ['#005A9C', '#EF3E42'],
  'Brooklyn Dodgers': ['#005A9C', '#EF3E42'],
  'Miami Marlins': ['#00A3E0', '#EF3340'],
  'Florida Marlins': ['#00A3AD', '#000000'],
  'Milwaukee Brewers': ['#12284B', '#FFC52F'],
  'Seattle Pilots': ['#0C2C56', '#FFC52F'],
  'Minnesota Twins': ['#002B5C', '#D31145'],
  'Washington Senators': ['#0C2340', '#C8102E'],
  'New York Mets': ['#FF5910', '#002D72'],
  'New York Yankees': ['#0C2340', '#C4CED3'],
  Athletics: ['#003831', '#EFB21E'],
  'Oakland Athletics': ['#003831', '#EFB21E'],
  'Kansas City Athletics': ['#003831', '#EFB21E'],
  'Philadelphia Athletics': ['#003831', '#EFB21E'],
  'Philadelphia Phillies': ['#E81828', '#002D72'],
  'Pittsburgh Pirates': ['#FDB827', '#27251F'],
  'San Diego Padres': ['#2F241D', '#FFC425'],
  'San Francisco Giants': ['#FD5A1E', '#27251F'],
  'New York Giants': ['#FD5A1E', '#27251F'],
  'Seattle Mariners': ['#005C5C', '#0C2C56'],
  'St. Louis Cardinals': ['#C41E3A', '#0C2340'],
  'Tampa Bay Rays': ['#092C5C', '#8FBCE6'],
  'Tampa Bay Devil Rays': ['#00843D', '#092C5C'],
  'Texas Rangers': ['#003278', '#C0111F'],
  'Toronto Blue Jays': ['#134A8E', '#E8291C'],
  'Washington Nationals': ['#AB0003', '#14225A'],
  'Montreal Expos': ['#003087', '#E4002B'],
}

/** The page background (ink-950 in index.css). */
export const BACKGROUND = '#0B0B0C'
const MIN_CONTRAST = 3

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const toHex = (rgb: number[]) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`.toUpperCase()

function luminance(hex: string) {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two colours (1 to 21). */
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** The first colour that reads on the background; failing both, the first mixed toward white until it does. */
function readable(primary: string, secondary: string) {
  for (const c of [primary, secondary]) if (contrast(c, BACKGROUND) >= MIN_CONTRAST) return c
  const rgb = channels(primary)
  for (let t = 0.05; t < 1; t += 0.05) {
    const mixed = toHex(rgb.map((c) => c + (255 - c) * t))
    if (contrast(mixed, BACKGROUND) >= MIN_CONTRAST) return mixed
  }
  return '#FFFFFF'
}

/** The card's MLB club colours, or null for other sports, several teams or a team the table doesn't know. */
export function teamColors(team: string | null | undefined, card: { year?: string; sport?: string } = {}): TeamColors | null {
  if (!team?.trim()) return null
  const sport = card.sport?.trim() ?? ''
  if (sport && !/baseball|mlb/i.test(sport)) return null
  const colors = MLB[standardTeam(team, { year: card.year, sport: 'baseball' })]
  if (!colors) return null
  const [primary, secondary] = colors
  return { primary, secondary, onDark: readable(primary, secondary) }
}

/** Every club in the table, for tests. */
export const MLB_TEAMS = Object.keys(MLB)
