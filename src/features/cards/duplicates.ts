import type { Card, CardInput } from '../../types/card'
import { isSold } from './collection'

/** The fields that identify a card. Two cards matching on all of them are the same card. */
const IDENTITY = ['player', 'year', 'set_name', 'insert_name', 'parallel', 'card_number'] as const

type Candidate = Pick<
  CardInput,
  (typeof IDENTITY)[number] | 'serial_number' | 'is_graded' | 'cert_number'
>

/**
 * How an existing card relates to the one being saved:
 * - same-copy: the very same physical card (same serial or same grading cert), probably entered twice.
 * - mergeable: plain raw copies, so adding to the existing card's quantity is the tidy option.
 * - other-copy: another copy that stays its own row (graded slabs and numbered cards are tracked one by one).
 */
export type DuplicateKind = 'same-copy' | 'mergeable' | 'other-copy'
export type DuplicateMatch = { card: Card; kind: DuplicateKind }

/** Case, spacing and punctuation don't matter: "Ken Griffey Jr." matches "ken griffey jr", "RC-12" matches "RC12". */
function norm(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function sameIdentity(a: Candidate, b: Candidate): boolean {
  return IDENTITY.every((field) => norm(a[field]) === norm(b[field]))
}

function kindOf(candidate: Candidate, card: Card): DuplicateKind | null {
  const serialA = candidate.serial_number ?? null
  const serialB = card.serial_number
  // 12/99 and 45/99 are different cards that merely share a checklist spot.
  if (serialA != null && serialB != null) return serialA === serialB ? 'same-copy' : null
  const certA = norm(candidate.cert_number)
  if (candidate.is_graded && card.is_graded && certA && certA === norm(card.cert_number)) return 'same-copy'
  if (!candidate.is_graded && !card.is_graded && serialA == null && serialB == null) return 'mergeable'
  return 'other-copy'
}

const ORDER: Record<DuplicateKind, number> = { 'same-copy': 0, mergeable: 1, 'other-copy': 2 }

/** Owned cards that are the same card as `candidate`, most relevant first. Sold cards don't count. */
export function findDuplicates(candidate: Candidate, cards: Card[], excludeId?: string): DuplicateMatch[] {
  if (!norm(candidate.player) || !norm(candidate.card_number)) return []
  const matches: DuplicateMatch[] = []
  for (const card of cards) {
    if (card.id === excludeId || isSold(card) || !sameIdentity(candidate, card)) continue
    const kind = kindOf(candidate, card)
    if (kind) matches.push({ card, kind })
  }
  return matches.sort((a, b) => ORDER[a.kind] - ORDER[b.kind])
}
