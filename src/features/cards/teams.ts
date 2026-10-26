/**
 * One spelling per team. Checklists and the AI often give a nickname ("Reds") or an abbreviation
 * ("CIN") where the collection uses the full name ("Cincinnati Reds"). The table below covers the four
 * big North American leagues, with each franchise's names by year, so an old card keeps its old team
 * ("Expos" is "Montreal Expos"; "Indians" on a 2015 card is "Cleveland Indians", on a 2023 card
 * "Cleveland Guardians"). Anything else (college, minor league, other sports) is matched against the
 * collection's own team names, or left as it is. Cards showing more than one team become MULTIPLE_TEAMS.
 */

export const MULTIPLE_TEAMS = 'Multiple Teams'

type League = 'baseball' | 'football' | 'basketball' | 'hockey'

/** [full name, nickname, first year, last year, other spellings]. Years are card years (season start). */
type Row = [name: string, nickname: string, from?: number, to?: number, aliases?: string[]]

const TEAMS: Record<League, Row[]> = {
  baseball: [
    ['Arizona Diamondbacks', 'Diamondbacks', 1998, undefined, ['D-backs', 'Dbacks', 'ARI', 'AZ']],
    ['Atlanta Braves', 'Braves', 1966, undefined, ['ATL']],
    ['Milwaukee Braves', 'Braves', 1953, 1965],
    ['Boston Braves', 'Braves', undefined, 1952],
    ['Baltimore Orioles', 'Orioles', 1954, undefined, ["O's", 'BAL']],
    ['St. Louis Browns', 'Browns', undefined, 1953],
    ['Boston Red Sox', 'Red Sox', undefined, undefined, ['BOS']],
    ['Chicago Cubs', 'Cubs', undefined, undefined, ['CHC']],
    ['Chicago White Sox', 'White Sox', undefined, undefined, ['CWS', 'CHW']],
    ['Cincinnati Reds', 'Reds', undefined, undefined, ['Redlegs', 'CIN']],
    ['Cleveland Indians', 'Indians', undefined, 2021, ['CLE']],
    ['Cleveland Guardians', 'Guardians', 2022, undefined, ['CLE']],
    ['Colorado Rockies', 'Rockies', 1993, undefined, ['COL']],
    ['Detroit Tigers', 'Tigers', undefined, undefined, ['DET']],
    ['Houston Astros', 'Astros', 1965, undefined, ['HOU']],
    ['Houston Colt .45s', 'Colt .45s', 1962, 1964],
    ['Kansas City Royals', 'Royals', 1969, undefined, ['KC', 'KCR']],
    ['Los Angeles Angels', 'Angels', 2005, undefined, ['Los Angeles Angels of Anaheim', 'LA Angels', 'LAA']],
    ['Anaheim Angels', 'Angels', 1997, 2004, ['ANA']],
    ['California Angels', 'Angels', 1965, 1996, ['CAL']],
    ['Los Angeles Angels', 'Angels', 1961, 1964],
    ['Los Angeles Dodgers', 'Dodgers', 1958, undefined, ['LA Dodgers', 'LAD']],
    ['Brooklyn Dodgers', 'Dodgers', undefined, 1957],
    ['Miami Marlins', 'Marlins', 2012, undefined, ['MIA']],
    ['Florida Marlins', 'Marlins', 1993, 2011, ['FLA']],
    ['Milwaukee Brewers', 'Brewers', 1970, undefined, ['MIL']],
    ['Seattle Pilots', 'Pilots', 1969, 1969],
    ['Minnesota Twins', 'Twins', 1961, undefined, ['MIN']],
    ['Washington Senators', 'Senators', undefined, 1971],
    ['New York Mets', 'Mets', 1962, undefined, ['NYM']],
    ['New York Yankees', 'Yankees', undefined, undefined, ['Yanks', 'NYY']],
    ['Athletics', 'Athletics', 2025, undefined, ["A's", 'ATH']],
    ['Oakland Athletics', 'Athletics', 1968, 2024, ["A's", "Oakland A's", 'OAK']],
    ['Kansas City Athletics', 'Athletics', 1955, 1967, ["A's", "Kansas City A's"]],
    ['Philadelphia Athletics', 'Athletics', undefined, 1954, ["A's", "Philadelphia A's"]],
    ['Philadelphia Phillies', 'Phillies', undefined, undefined, ['PHI']],
    ['Pittsburgh Pirates', 'Pirates', undefined, undefined, ['Bucs', 'PIT']],
    ['San Diego Padres', 'Padres', 1969, undefined, ['SD', 'SDP']],
    ['San Francisco Giants', 'Giants', 1958, undefined, ['SF Giants', 'SF', 'SFG']],
    ['New York Giants', 'Giants', undefined, 1957],
    ['Seattle Mariners', 'Mariners', 1977, undefined, ["M's", 'SEA']],
    ['St. Louis Cardinals', 'Cardinals', undefined, undefined, ['Cards', 'STL']],
    ['Tampa Bay Rays', 'Rays', 2008, undefined, ['TB', 'TBR']],
    ['Tampa Bay Devil Rays', 'Devil Rays', 1998, 2007, ['Rays', 'TB', 'TBD']],
    ['Texas Rangers', 'Rangers', 1972, undefined, ['TEX']],
    ['Toronto Blue Jays', 'Blue Jays', 1977, undefined, ['Jays', 'TOR']],
    ['Washington Nationals', 'Nationals', 2005, undefined, ['Nats', 'WSH', 'WSN']],
    ['Montreal Expos', 'Expos', 1969, 2004, ['MON']],
  ],
  football: [
    ['Arizona Cardinals', 'Cardinals', 1994],
    ['Phoenix Cardinals', 'Cardinals', 1988, 1993],
    ['St. Louis Cardinals', 'Cardinals', 1960, 1987],
    ['Atlanta Falcons', 'Falcons'],
    ['Baltimore Ravens', 'Ravens', 1996],
    ['Buffalo Bills', 'Bills'],
    ['Carolina Panthers', 'Panthers', 1995],
    ['Chicago Bears', 'Bears'],
    ['Cincinnati Bengals', 'Bengals'],
    ['Cleveland Browns', 'Browns'],
    ['Dallas Cowboys', 'Cowboys'],
    ['Denver Broncos', 'Broncos'],
    ['Detroit Lions', 'Lions'],
    ['Green Bay Packers', 'Packers'],
    ['Houston Texans', 'Texans', 2002],
    ['Indianapolis Colts', 'Colts', 1984],
    ['Baltimore Colts', 'Colts', undefined, 1983],
    ['Jacksonville Jaguars', 'Jaguars', 1995],
    ['Kansas City Chiefs', 'Chiefs'],
    ['Las Vegas Raiders', 'Raiders', 2020],
    ['Oakland Raiders', 'Raiders', 1995, 2019],
    ['Los Angeles Raiders', 'Raiders', 1982, 1994],
    ['Oakland Raiders', 'Raiders', undefined, 1981],
    ['Los Angeles Chargers', 'Chargers', 2017],
    ['San Diego Chargers', 'Chargers', 1961, 2016],
    ['Los Angeles Rams', 'Rams', 2016],
    ['St. Louis Rams', 'Rams', 1995, 2015],
    ['Los Angeles Rams', 'Rams', undefined, 1994],
    ['Miami Dolphins', 'Dolphins'],
    ['Minnesota Vikings', 'Vikings'],
    ['New England Patriots', 'Patriots', 1971, undefined, ['Pats']],
    ['Boston Patriots', 'Patriots', undefined, 1970],
    ['New Orleans Saints', 'Saints'],
    ['New York Giants', 'Giants'],
    ['New York Jets', 'Jets'],
    ['Philadelphia Eagles', 'Eagles'],
    ['Pittsburgh Steelers', 'Steelers'],
    ['San Francisco 49ers', '49ers', undefined, undefined, ['Niners']],
    ['Seattle Seahawks', 'Seahawks'],
    ['Tampa Bay Buccaneers', 'Buccaneers', undefined, undefined, ['Bucs']],
    ['Tennessee Titans', 'Titans', 1999],
    ['Tennessee Oilers', 'Oilers', 1997, 1998],
    ['Houston Oilers', 'Oilers', undefined, 1996],
    ['Washington Commanders', 'Commanders', 2022],
    ['Washington Football Team', 'Football Team', 2020, 2021],
    ['Washington Redskins', 'Redskins', undefined, 2019],
  ],
  basketball: [
    ['Atlanta Hawks', 'Hawks'],
    ['Boston Celtics', 'Celtics'],
    ['Brooklyn Nets', 'Nets', 2012],
    ['New Jersey Nets', 'Nets', 1977, 2011],
    ['Charlotte Hornets', 'Hornets', 2014],
    ['Charlotte Bobcats', 'Bobcats', 2004, 2013],
    ['New Orleans Hornets', 'Hornets', 2002, 2012],
    ['Charlotte Hornets', 'Hornets', 1988, 2001],
    ['Chicago Bulls', 'Bulls'],
    ['Cleveland Cavaliers', 'Cavaliers', undefined, undefined, ['Cavs']],
    ['Dallas Mavericks', 'Mavericks', undefined, undefined, ['Mavs']],
    ['Denver Nuggets', 'Nuggets'],
    ['Detroit Pistons', 'Pistons'],
    ['Golden State Warriors', 'Warriors'],
    ['Houston Rockets', 'Rockets'],
    ['Indiana Pacers', 'Pacers'],
    ['Los Angeles Clippers', 'Clippers', 1984, undefined, ['LA Clippers']],
    ['San Diego Clippers', 'Clippers', 1978, 1983],
    ['Los Angeles Lakers', 'Lakers', undefined, undefined, ['LA Lakers']],
    ['Memphis Grizzlies', 'Grizzlies', 2001],
    ['Vancouver Grizzlies', 'Grizzlies', 1995, 2000],
    ['Miami Heat', 'Heat'],
    ['Milwaukee Bucks', 'Bucks'],
    ['Minnesota Timberwolves', 'Timberwolves', undefined, undefined, ['Wolves']],
    ['New Orleans Pelicans', 'Pelicans', 2013],
    ['New York Knicks', 'Knicks'],
    ['Oklahoma City Thunder', 'Thunder', 2008, undefined, ['OKC Thunder']],
    ['Seattle SuperSonics', 'SuperSonics', undefined, 2007, ['Sonics']],
    ['Orlando Magic', 'Magic'],
    ['Philadelphia 76ers', '76ers', undefined, undefined, ['Sixers']],
    ['Phoenix Suns', 'Suns'],
    ['Portland Trail Blazers', 'Trail Blazers', undefined, undefined, ['Blazers']],
    ['Sacramento Kings', 'Kings', 1985],
    ['Kansas City Kings', 'Kings', 1975, 1984],
    ['San Antonio Spurs', 'Spurs'],
    ['Toronto Raptors', 'Raptors'],
    ['Utah Jazz', 'Jazz', 1979],
    ['New Orleans Jazz', 'Jazz', undefined, 1978],
    ['Washington Wizards', 'Wizards', 1997],
    ['Washington Bullets', 'Bullets', undefined, 1996],
  ],
  hockey: [
    ['Anaheim Ducks', 'Ducks', 2006],
    ['Mighty Ducks of Anaheim', 'Mighty Ducks', 1993, 2005, ['Anaheim Mighty Ducks']],
    ['Arizona Coyotes', 'Coyotes', 2014, 2023],
    ['Phoenix Coyotes', 'Coyotes', 1996, 2013],
    ['Boston Bruins', 'Bruins'],
    ['Buffalo Sabres', 'Sabres'],
    ['Calgary Flames', 'Flames'],
    ['Carolina Hurricanes', 'Hurricanes', 1997, undefined, ['Canes']],
    ['Hartford Whalers', 'Whalers', undefined, 1996],
    ['Chicago Blackhawks', 'Blackhawks', undefined, undefined, ['Black Hawks']],
    ['Colorado Avalanche', 'Avalanche', 1995, undefined, ['Avs']],
    ['Quebec Nordiques', 'Nordiques', undefined, 1994],
    ['Columbus Blue Jackets', 'Blue Jackets', 2000],
    ['Dallas Stars', 'Stars', 1993],
    ['Minnesota North Stars', 'North Stars', undefined, 1992],
    ['Detroit Red Wings', 'Red Wings'],
    ['Edmonton Oilers', 'Oilers'],
    ['Florida Panthers', 'Panthers', 1993],
    ['Los Angeles Kings', 'Kings', undefined, undefined, ['LA Kings']],
    ['Minnesota Wild', 'Wild', 2000],
    ['Montreal Canadiens', 'Canadiens', undefined, undefined, ['Habs']],
    ['Nashville Predators', 'Predators', 1998, undefined, ['Preds']],
    ['New Jersey Devils', 'Devils', 1982],
    ['New York Islanders', 'Islanders', undefined, undefined, ['Isles']],
    ['New York Rangers', 'Rangers'],
    ['Ottawa Senators', 'Senators', 1992, undefined, ['Sens']],
    ['Philadelphia Flyers', 'Flyers'],
    ['Pittsburgh Penguins', 'Penguins', undefined, undefined, ['Pens']],
    ['San Jose Sharks', 'Sharks'],
    ['Seattle Kraken', 'Kraken', 2021],
    ['St. Louis Blues', 'Blues'],
    ['Tampa Bay Lightning', 'Lightning', 1992, undefined, ['Bolts']],
    ['Toronto Maple Leafs', 'Maple Leafs', undefined, undefined, ['Leafs']],
    ['Utah Mammoth', 'Mammoth', 2025],
    ['Utah Hockey Club', 'Hockey Club', 2024, 2024],
    ['Vancouver Canucks', 'Canucks'],
    ['Vegas Golden Knights', 'Golden Knights', 2017],
    ['Washington Capitals', 'Capitals', undefined, undefined, ['Caps']],
    ['Winnipeg Jets', 'Jets', 2011],
    ['Atlanta Thrashers', 'Thrashers', 1999, 2010],
    ['Winnipeg Jets', 'Jets', undefined, 1995],
  ],
}

const key = (value: string) =>
  value
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

type Entry = { name: string; league: League; from: number; to: number }

/** Every spelling (full name, nickname, city, extras) to the names it can mean. */
const INDEX = (() => {
  const index = new Map<string, Entry[]>()
  const add = (spelling: string, entry: Entry) => {
    const k = key(spelling)
    if (!k) return
    const list = index.get(k) ?? []
    if (!list.some((e) => e.name === entry.name && e.from === entry.from)) list.push(entry)
    index.set(k, list)
  }
  for (const [league, rows] of Object.entries(TEAMS) as [League, Row[]][]) {
    for (const [name, nickname, from = 0, to = 9999, aliases = []] of rows) {
      const entry = { name, league, from, to }
      const city = name.endsWith(` ${nickname}`) ? name.slice(0, -nickname.length - 1) : ''
      for (const spelling of [name, nickname, city, ...aliases]) add(spelling, entry)
    }
  }
  return index
})()

/** The league a free-text sport names, if it's one the table covers. */
function leagueOf(sport: string): League | 'other' | null {
  const s = sport.toLowerCase()
  if (!s.trim()) return null
  if (/baseball|mlb/.test(s)) return 'baseball'
  if (/basketball|nba/.test(s)) return 'basketball'
  if (/hockey|nhl/.test(s)) return 'hockey'
  if (/soccer/.test(s)) return 'other'
  if (/football|nfl/.test(s)) return 'football'
  return 'other'
}

/** The card year as a number: "2023-24" is the 2023 season. */
const cardYear = (year: string) => {
  const match = /\d{4}/.exec(year)
  return match ? Number(match[0]) : null
}

/** One name the table gives this spelling, by sport and year; null when none or several fit. */
function fromTable(team: string, year: string, sport: string): string | null {
  const league = leagueOf(sport)
  if (league === 'other') return null
  let entries = (INDEX.get(key(team)) ?? []).filter((e) => !league || e.league === league)
  const y = cardYear(year)
  const inYear = y == null ? entries.filter((e) => e.to === 9999) : entries.filter((e) => e.from <= y && y <= e.to)
  if (inYear.length) entries = inYear
  const names = [...new Set(entries.map((e) => e.name))]
  return names.length === 1 ? names[0] : null
}

/** A team in the collection this spelling ends with: "Buckeyes" is "Ohio State Buckeyes". */
function fromKnown(team: string, known: string[]): string | null {
  const exact = known.find((k) => key(k) === key(team))
  if (exact) return exact
  const words = team.toLowerCase().split(/\s+/)
  const matches = known.filter((k) => {
    const theirs = k.toLowerCase().split(/\s+/)
    return theirs.length > words.length && words.every((w, i) => theirs[theirs.length - words.length + i] === w)
  })
  return matches.length === 1 ? matches[0] : null
}

/** "Reds / Cubs", "Yankees & Mets", "Dodgers vs. Giants". "Texas A&M" stays one team. */
const SEPARATOR = /\s*\/\s*|\s+(?:&|\+|and|vs\.?|v\.?)\s+|\s*,\s*/i

/**
 * The collection's spelling of a team: full name by sport and year, the collector's own longer name for
 * it, or MULTIPLE_TEAMS for a card with several. An unknown name comes back unchanged.
 */
export function standardTeam(team: string, card: { year?: string; sport?: string; known?: string[] } = {}): string {
  const trimmed = team.trim().replace(/\s+/g, ' ')
  if (!trimmed) return ''
  const { year = '', sport = '', known = [] } = card
  if (key(trimmed) === key(MULTIPLE_TEAMS)) return MULTIPLE_TEAMS
  if (trimmed.split(SEPARATOR).filter((part) => key(part)).length > 1) return MULTIPLE_TEAMS
  return fromTable(trimmed, year, sport) ?? fromKnown(trimmed, known) ?? trimmed
}

export type TeamFix = { from: string; to: string; ids: string[] }

type TeamCard = { id: string; team: string | null; year: string; sport: string }

/** Saved cards whose team isn't spelled the standard way, grouped by the change. */
export function teamFixes(cards: TeamCard[]): TeamFix[] {
  const known = [...new Set(cards.map((c) => c.team?.trim() ?? '').filter(Boolean))]
  const fixes = new Map<string, TeamFix>()
  for (const card of cards) {
    if (!card.team?.trim()) continue
    const to = standardTeam(card.team, { year: card.year, sport: card.sport, known })
    if (to === card.team) continue
    const id = `${card.team}\n${to}`
    const fix = fixes.get(id) ?? { from: card.team, to, ids: [] }
    fix.ids.push(card.id)
    fixes.set(id, fix)
  }
  return [...fixes.values()].sort((a, b) => b.ids.length - a.ids.length || a.from.localeCompare(b.from))
}
