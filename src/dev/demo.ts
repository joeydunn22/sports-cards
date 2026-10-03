import type { Session } from '@supabase/supabase-js'
import type { Card } from '../types/card'

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
  is_patch: false,
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
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
}

export const demoCards: Card[] = [
  { ...base, id: 'd1', player: 'Shohei Ohtani', year: '2023', set_name: 'Topps Finest', card_number: '12', team: 'Angels', parallel: 'Red Refractor', serial_number: 3, print_run: 5, estimated_value: 450 },
  { ...base, id: 'd2', player: 'Jackson Holliday', year: '2022', set_name: 'Bowman Chrome', card_number: 'CPA-JH', team: 'Orioles', insert_name: 'Prospect Autographs', is_auto: true, is_rookie: true, estimated_value: 120, purchase_price: 80 },
  { ...base, id: 'd3', player: 'Victor Wembanyama', year: '2023-24', set_name: 'Panini Prizm', card_number: '136', sport: 'Basketball', team: 'Spurs', parallel: 'Silver', is_rookie: true, is_graded: true, grade_company: 'PSA', grade: '10', estimated_value: 300 },
  { ...base, id: 'd4', player: 'Connor Bedard', year: '2023-24', set_name: 'Upper Deck Series 1', card_number: '201', sport: 'Hockey', team: 'Blackhawks', insert_name: 'Young Guns', is_rookie: true, quantity: 2 },
  { ...base, id: 'd5', player: 'Elly De La Cruz', year: '2024', set_name: 'Topps Chrome', card_number: 'USC1', team: 'Reds', insert_name: 'Update Rookie Patch', is_patch: true, is_auto: true, serial_number: 12, print_run: 50 },
  { ...base, id: 'd6', player: 'Julio Rodríguez', year: '2022', set_name: 'Topps Heritage', card_number: '650', team: 'Mariners', is_rookie: true },
]
