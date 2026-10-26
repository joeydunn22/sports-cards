import type { Session } from '@supabase/supabase-js'
import type { Card, CardScan } from '../types/card'
import type { ChecklistEntry } from '../hooks/useChecklist'
import type { ParallelRow } from '../hooks/useSetParallels'

/**
 * Dev-only demo mode for checking the UI without a real account: open the dev server with `?demo`
 * (e.g. http://localhost:5173/sports-cards/?demo#/). `import.meta.env.DEV` is false in production
 * builds, so this is always off there and the sample data is dropped from the bundle.
 */
export const IS_DEMO = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo')

export const demoSession = { user: { id: 'demo', email: 'demo@example.com' } } as Session

const base: Omit<Card, 'id' | 'player' | 'year' | 'set_name' | 'card_number'> = {
  user_id: 'demo',
  sport: 'Baseball',
  team: null,
  insert_name: null,
  parallel: null,
  is_rookie: false,
  is_auto: false,
  is_relic: false,
  serial_number: null,
  print_run: null,
  quantity: 1,
  is_graded: false,
  grade_company: null,
  grade: null,
  cert_number: null,
  raw_condition: null,
  purchase_price: null,
  purchase_date: null,
  estimated_value: null,
  sold_price: null,
  sold_date: null,
  front_image_path: null,
  back_image_path: null,
  photos_checked_at: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
}

export const demoCards: Card[] = [
  { ...base, id: 'd1', front_image_path: 'demo/d1-front.webp', player: 'Shohei Ohtani', year: '2023', set_name: 'Topps Finest', card_number: '12', team: 'Angels', parallel: 'Red Refractor', serial_number: 3, print_run: 5, estimated_value: 450 },
  { ...base, id: 'd2', player: 'Jackson Holliday', year: '2022', set_name: 'Bowman Chrome', card_number: 'CPA-JH', team: 'Orioles', insert_name: 'Prospect Autographs', is_auto: true, is_rookie: true, estimated_value: 120, purchase_price: 80 },
  { ...base, id: 'd3', player: 'Victor Wembanyama', year: '2023-24', set_name: 'Panini Prizm', card_number: '136', sport: 'Basketball', team: 'Spurs', parallel: 'Silver', is_rookie: true, is_graded: true, grade_company: 'PSA', grade: '10', estimated_value: 300 },
  { ...base, id: 'd4', player: 'Connor Bedard', year: '2023-24', set_name: 'Upper Deck Series 1', card_number: '201', sport: 'Hockey', team: 'Blackhawks', insert_name: 'Young Guns', is_rookie: true, quantity: 2 },
  { ...base, id: 'd5', player: 'Elly De La Cruz', year: '2024', set_name: 'Topps Chrome', card_number: 'USC1', team: 'Reds', insert_name: 'Update Rookie Patch', is_relic: true, is_auto: true, serial_number: 12, print_run: 50 },
  { ...base, id: 'd6', player: 'Julio Rodríguez', year: '2022', set_name: 'Topps Heritage', card_number: '650', team: 'Mariners', is_rookie: true },
]

const usage = { input_tokens: 5200, output_tokens: 900, cache_read_input_tokens: 2400 }
const scan = (id: string, status: string, extraction: object | null): CardScan => ({
  id,
  user_id: 'demo',
  front_image_path: `demo/${id}-front.webp`,
  back_image_path: `demo/${id}-back.webp`,
  status,
  extraction: extraction as CardScan['extraction'],
  error: status === 'failed' ? 'The AI’s answer was incomplete. Try reading it again.' : null,
  batch_id: null,
  created_at: '2026-10-04T00:00:00Z',
  updated_at: '2026-10-04T00:00:00Z',
})
const reading = {
  sport: 'Baseball', team: '', insert_name: '', parallel: '', is_rookie: false, is_auto: false,  is_relic: false, serial_number: null, print_run: null, inferred_fields: [], uncertain_fields: [], needs_lookup: false,
  retake: '', notes: '', model: 'claude-sonnet-5-5', usage,
}

/** One scan in each inbox state, for checking the inbox and review screens. */
export const demoScans: CardScan[] = [
  scan('s1', 'ready', { ...reading, triage: 'ready', player: 'Gunnar Henderson', year: '2023', set_name: 'Topps', card_number: '18', is_rookie: true }),
  scan('s2', 'ready', {
    ...reading, triage: 'lookup', player: 'Corbin Carroll', year: '2023', set_name: 'Topps Chrome', card_number: '150',
    parallel: 'Refractor', uncertain_fields: ['set_name', 'parallel'], inferred_fields: ['year'], needs_lookup: true,
    lookup: {
      fields: { ...reading, player: 'Corbin Carroll', year: '2023', set_name: 'Bowman Chrome', card_number: '150', parallel: 'Refractor' },
      changed: ['set_name'], confirmed: ['set_name', 'year', 'card_number'], still_uncertain: ['parallel'],
      sources: [{ url: 'https://www.beckett.com/news/2023-bowman-chrome-baseball-cards/', title: '2023 Bowman Chrome Baseball Checklist' }],
      notes: 'Card #150 in 2023 Bowman Chrome is Corbin Carroll; the refractor finish can’t be confirmed from the photo.',
      model: 'claude-sonnet-5-5', usage: { input_tokens: 21000, output_tokens: 1400 }, searches: 2,
    },
  }),
  scan('s3', 'looking_up', { ...reading, triage: 'lookup', player: 'Jackson Chourio', year: '2024', set_name: 'Topps', card_number: '?', uncertain_fields: ['card_number'], needs_lookup: true }),
  scan('s4', 'ready', { ...reading, triage: 'retake', player: 'Bobby Witt Jr.', year: '2022', set_name: 'Topps Chrome', card_number: '1', retake: 'Glare hides the serial number on the back; tilt the toploader away from the light and retake.' }),
  scan('s5', 'ready', { ...reading, triage: 'unidentified', player: 'Unknown', year: '2021', set_name: '', card_number: '', uncertain_fields: ['player', 'set_name', 'card_number'], notes: 'The front is mostly glare.' }),
  scan('s6', 'pending', null),
  scan('s7', 'ready', { ...reading, triage: 'ready', player: 'Billy Hamilton', year: '2011', set_name: 'Bowman Chrome Draft', card_number: 'BDPP71', team: 'CIN', serial_number: 12, print_run: 25 }),
]


const rainbow = (
  set_name: string,
  year: string,
  rows: [parallel: string, print_run: number | null, insert_name?: string][],
): ParallelRow[] =>
  rows.map(([parallel, print_run, insert_name = ''], i) => ({
    id: `${year}-${set_name}-${i}`,
    year,
    set_name,
    insert_name,
    parallel,
    print_run,
    source: 'search',
    source_url: null,
  }))

/** Sample parallel lists, so the form's fill-in and the Sets page can be checked in demo mode. */
export const demoParallels: ParallelRow[] = [
  ...rainbow('Bowman Chrome Draft', '2011', [
    ['Refractor', null],
    ['Blue Refractor', 199],
    ['Gold Refractor', 50],
    ['Orange Refractor', 25],
    ['Red Refractor', 5],
    ['Superfractor', 1],
    ['Printing Plate Black', 1],
    ['Printing Plate Cyan', 1],
    ['Refractor', 500, 'Prospect Autographs'],
    ['Blue Refractor', 150, 'Prospect Autographs'],
    ['Gold Refractor', 50, 'Prospect Autographs'],
    ['Red Refractor', 5, 'Prospect Autographs'],
    ['Superfractor', 1, 'Prospect Autographs'],
  ]),
  ...rainbow('Topps Finest', '2023', [
    ['Refractor', null],
    ['Gold Refractor', 50],
    ['Red Refractor', 5],
  ]).map((p, i) => (i === 2 ? { ...p, source: 'collection' } : p)),
]

const spot = (
  year: string,
  set_name: string,
  insert_name: string,
  card_number: string,
  player: string,
  is_rookie = false,
): ChecklistEntry => ({
  id: `${year}-${set_name}-${insert_name}-${card_number}`,
  year,
  set_name,
  insert_name,
  card_number,
  player,
  team: null,
  sport: null,
  is_rookie,
  source: 'cardpedia',
})

/** Sample checklist spots (made up), so Card # fill-in and voice entry can be checked in demo mode. */
export const demoChecklist: ChecklistEntry[] = [
  spot('2011', 'Bowman Chrome Draft', '', '1', 'Gerrit Cole', true),
  spot('2011', 'Bowman Chrome Draft', '', '2', 'Danny Hultzen', true),
  spot('2011', 'Bowman Chrome Draft', '', '38', 'Francisco Lindor', true),
  spot('2011', 'Bowman Chrome Draft', 'Prospect Autographs', 'BCAP-FL', 'Francisco Lindor'),
  spot('2011', 'Bowman Chrome Draft', 'Prospect Autographs', 'BCAP-JB', 'Javier Báez'),
  spot('2023', 'Topps Finest', '', '12', 'Shohei Ohtani'),
  spot('2023', 'Topps Finest', '', '50', 'Julio Rodríguez'),
]

let samplePhoto: string | null = null

/** Every demo photo: a card sitting crooked in its crop, with a glare spot, for checking the photo editor. */
export function demoPhotoUrl(): string {
  if (samplePhoto) return samplePhoto
  const c = document.createElement('canvas')
  c.width = 760
  c.height = 1000
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#1f2937'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.translate(380, 500)
  ctx.rotate((6 * Math.PI) / 180)
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(-300, -420, 600, 840)
  ctx.fillStyle = '#b91c1c'
  ctx.fillRect(-270, -390, 540, 640)
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 54px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('SHOHEI OHTANI', 0, 330)
  ctx.font = '36px sans-serif'
  ctx.fillText('ANGELS · #12', 0, 385)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const glare = ctx.createRadialGradient(470, 330, 10, 470, 330, 75)
  glare.addColorStop(0, 'rgba(255,255,255,1)')
  glare.addColorStop(0.6, 'rgba(255,255,255,0.85)')
  glare.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glare
  ctx.fillRect(0, 0, c.width, c.height)
  samplePhoto = c.toDataURL('image/jpeg', 0.9)
  return samplePhoto
}
