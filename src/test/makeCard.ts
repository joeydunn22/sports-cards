import type { Card } from '../types/card'

let counter = 0

/** Builds a complete Card row for tests; override only what the test cares about. */
export function makeCard(overrides: Partial<Card> = {}): Card {
  counter += 1
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    user_id: '00000000-0000-4000-8000-000000000000',
    player: 'Test Player',
    year: '2023',
    set_name: 'Topps Chrome',
    card_number: '1',
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
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  }
}
