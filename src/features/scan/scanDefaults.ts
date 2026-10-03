import type { CardScan } from '../../types/card'
import { emptyCardForm, stickyForm, type CardFormValues } from '../cards/cardSchema'
import { getLastSport } from '../cards/suggestions'
import { asExtraction, extractionToForm } from './extraction'

const LAST_VALUES_KEY = 'sports-cards:last-scan-values'

/**
 * Starting values for reviewing a scan: the AI's reading on top of the year, set, insert and sport
 * carried over from the last saved scan (like "Save & add another"), since a batch is usually one set.
 */
export function scanFormValues(scan: CardScan): CardFormValues {
  const extraction = asExtraction(scan.extraction)
  const base = carriedOver()
  return extraction && scan.status === 'ready' ? extractionToForm(extraction, base) : base
}

function carriedOver(): CardFormValues {
  try {
    const stored = sessionStorage.getItem(LAST_VALUES_KEY)
    if (stored) return stickyForm({ ...emptyCardForm, ...(JSON.parse(stored) as Partial<CardFormValues>) })
  } catch {
    // Storage unavailable or corrupt: fall through to blank values.
  }
  return { ...emptyCardForm, sport: getLastSport() }
}

export function rememberScanValues(values: CardFormValues) {
  try {
    sessionStorage.setItem(LAST_VALUES_KEY, JSON.stringify(values))
  } catch {
    // Not critical: the next card just starts blank.
  }
}
