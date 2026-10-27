import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { buttonPrimary, buttonSecondary, panel } from '../../components/ui'
import { NO_CARDS, useCards } from '../../hooks/useCards'
import { useSessionState } from '../../hooks/useSessionState'
import { NO_SCANS, useConfirmScan, useScanPolling, useScans } from '../../hooks/useScans'
import { flashSaved, recordSave, savedThisSession } from '../../lib/feedback'
import { formatSerial } from '../../lib/format'
import type { CardScan } from '../../types/card'
import { CardPhotos } from '../cards/CardPhotos'
import { toCardInput, type CardFormValues } from '../cards/cardSchema'
import { cardTitle } from '../cards/cardText'
import { buildSuggestions, rememberSport } from '../cards/suggestions'
import { asExtraction, fieldNotes, inboxSection, sortForReview, type FieldNotes } from './extraction'
import { quickSaveBlocker } from './rapidReview'
import { rememberScanValues, reviewValues } from './scanDefaults'

/** How far (px) a card has to be dragged sideways to count as a swipe. */
const SWIPE = 110

/**
 * Rapid review: the inbox's ready cards one at a time, every field on show. Swipe right (or Save) to
 * save it as read, left (or Fix) to open the full form. Cards the deck can't save safely (a blank
 * required field, a card already owned) only offer the form.
 */
export function RapidReviewPage() {
  const navigate = useNavigate()
  const { data: scansData, isPending } = useScans()
  const { data: cardsData } = useCards()
  const cards = cardsData ?? NO_CARDS
  const scans = scansData ?? NO_SCANS
  const suggestions = useMemo(() => buildSuggestions(cards), [cards])
  const confirmScan = useConfirmScan()
  useScanPolling(scans)
  // Skips last the session, so coming back from the form doesn't put them first again.
  const [skipped, setSkipped] = useSessionState<string[]>('sports-cards:deck-skipped', [])
  // Saves run in the background; the deck moves on at once.
  const [saving, setSaving] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState(savedThisSession)

  const ready = useMemo(() => sortForReview(scans).filter((s) => inboxSection(s) === 'ready'), [scans])
  const queue = ready.filter((s) => !skipped.includes(s.id) && !saving.includes(s.id))
  const scan = queue[0]
  const values = useMemo(() => (scan ? reviewValues(scan, suggestions.team) : null), [scan, suggestions.team])
  const blocker = values ? quickSaveBlocker(values, cards) : null

  function save(scan: CardScan, values: CardFormValues) {
    setError(null)
    setSaving((ids) => [...ids, scan.id])
    rememberScanValues(values)
    rememberSport(values.sport)
    setSavedCount(recordSave())
    flashSaved()
    confirmScan.mutate(
      { scan, input: toCardInput(values) },
      {
        onError: (err) => {
          setError(`Couldn’t save ${values.player || 'a card'}: ${err.message}. It’s back in the deck.`)
          setSaving((ids) => ids.filter((id) => id !== scan.id))
        },
      },
    )
  }

  const fix = (scan: CardScan) => navigate(`/scan/${scan.id}?from=deck`)
  const skip = (scan: CardScan) => setSkipped((ids) => [...ids, scan.id])

  // Desktop: arrow keys swipe.
  const keys = useRef({ save, fix, scan, values, blocker })
  useEffect(() => {
    keys.current = { save, fix, scan, values, blocker }
  })
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const { scan, values, blocker, save, fix } = keys.current
      if (!scan || !values || (e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === 'ArrowRight' && !blocker) save(scan, values)
      if (e.key === 'ArrowLeft') fix(scan)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (isPending) return <p className="p-6 text-ink-400">Loading…</p>

  // Saved cards leave the inbox, so the count is what's left rather than a position.
  const subtitle = (
    <span className="tabular-nums">
      {scan ? `${queue.length} ready ${queue.length === 1 ? 'card' : 'cards'} left` : 'Ready cards'}
      {savedCount > 0 && ` · ${savedCount} saved this session`}
    </span>
  )

  return (
    <main className="mx-auto max-w-xl px-4 pt-[env(safe-area-inset-top)] pb-36 md:pt-4">
      <PageHeader title="Quick review" subtitle={subtitle} backTo="/scan" backLabel="Inbox" />
      {error && <p className="mb-3 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-300">{error}</p>}

      {!scan || !values ? (
        <DeckDone
          skipped={ready.filter((s) => skipped.includes(s.id)).length}
          onRetrySkipped={() => setSkipped([])}
        />
      ) : (
        <>
          <SwipeCard key={scan.id} onSave={blocker ? undefined : () => save(scan, values)} onFix={() => fix(scan)}>
            <CardPhotos front={scan.front_image_path} back={scan.back_image_path} />
            <Readout scan={scan} values={values} />
          </SwipeCard>

          <div className="fixed inset-x-0 bottom-0 z-10 border-t border-white/[0.05] bg-ink-950/85 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
            <div className="mx-auto flex max-w-xl flex-col gap-2">
              {blocker && <p className="text-center text-sm text-amber-300">{blocker}: check it in the form.</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => skip(scan)} className={`${buttonSecondary} min-h-12 px-4`}>
                  Skip
                </button>
                <button
                  type="button"
                  onClick={() => fix(scan)}
                  className={`${blocker ? buttonPrimary : buttonSecondary} min-h-12 flex-1`}
                >
                  <Icon name="edit" size={18} /> {blocker ? 'Open to check' : 'Fix'}
                </button>
                {!blocker && (
                  <button type="button" onClick={() => save(scan, values)} className={`${buttonPrimary} min-h-12 flex-[2]`}>
                    <Icon name="check" size={20} /> Save
                  </button>
                )}
              </div>
              <p className="text-center text-xs text-ink-500 max-md:hidden">← fix · save →</p>
            </div>
          </div>
        </>
      )}
    </main>
  )
}

/** The card follows a sideways drag and tilts; let go past the threshold to save (right) or fix (left). */
function SwipeCard({ children, onSave, onFix }: { children: ReactNode; onSave?: () => void; onFix: () => void }) {
  const [dx, setDx] = useState(0)
  const start = useRef<{ x: number; y: number; id: number; dragging: boolean } | null>(null)

  function down(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse') return
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, dragging: false }
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    const x = e.clientX - s.x
    if (!s.dragging) {
      // Mostly sideways: it's a swipe (taps and vertical scrolls are left alone).
      if (Math.abs(x) < 12 || Math.abs(x) < Math.abs(e.clientY - s.y) * 1.5) return
      s.dragging = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    setDx(onSave || x < 0 ? x : Math.min(x, 40))
  }
  function up() {
    const dragging = start.current?.dragging
    start.current = null
    if (!dragging) return
    if (dx > SWIPE && onSave) onSave()
    else if (dx < -SWIPE) onFix()
    setDx(0)
  }

  const hint = dx > 40 && onSave ? 'save' : dx < -40 ? 'fix' : null
  return (
    <div
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      className={`relative touch-pan-y ${dx === 0 ? 'transition-transform duration-200' : ''}`}
      style={{ transform: `translateX(${dx}px) rotate(${dx / 30}deg)` }}
    >
      {hint && (
        <span
          className={`pointer-events-none absolute top-3 z-10 rounded-full px-4 py-2 text-sm font-bold tracking-wide uppercase ${
            hint === 'save' ? 'left-3 bg-accent-400 text-ink-950' : 'right-3 bg-ink-100 text-ink-950'
          }`}
          style={{ opacity: Math.min(1, (Math.abs(dx) - 40) / (SWIPE - 40)) }}
        >
          {hint === 'save' ? 'Save' : 'Fix'}
        </span>
      )}
      {children}
    </div>
  )
}

const FLAG_NAMES = [
  ['is_rookie', 'RC'],
  ['is_auto', 'Auto'],
  ['is_relic', 'Relic'],
] as const

/** Every field the card will be saved with; the ones the AI flagged are amber with its note. */
function Readout({ scan, values: v }: { scan: CardScan; values: CardFormValues }) {
  const extraction = asExtraction(scan.extraction)
  const notes: FieldNotes = extraction ? fieldNotes(extraction) : {}
  const serial = formatSerial(v.serial_number ? Number(v.serial_number) : null, v.print_run ? Number(v.print_run) : null)
  const flags = FLAG_NAMES.filter(([name]) => v[name]).map(([, label]) => label)
  const flagNote = FLAG_NAMES.map(([name]) => notes[name]).find(Boolean)
  const rows: [label: string, value: string, note?: string][] = [
    ['Year', v.year, notes.year],
    ['Set', v.set_name, notes.set_name],
    ['Card #', v.card_number, notes.card_number],
    ['Insert', v.insert_name || 'Base', notes.insert_name],
    ['Parallel', v.parallel || 'Base', notes.parallel],
    ['Numbered', serial || 'No', notes.serial_number ?? notes.print_run],
    ['Team', v.team, notes.team],
    ['Sport', v.sport, notes.sport],
    ['Flags', flags.join(' · ') || 'None', flagNote],
  ]
  if (Number(v.quantity) > 1) rows.push(['Quantity', v.quantity])

  return (
    <section className={`${panel} -mt-2 p-4`}>
      <p className="text-[13px] text-ink-500">{cardTitle(toCardInput(v))}</p>
      <h2 className={`mt-0.5 text-2xl font-bold tracking-tight ${notes.player ? 'text-amber-200' : 'text-ink-50'}`}>
        {v.player || 'No player'}
      </h2>
      {notes.player && <p className="text-xs text-amber-300">{notes.player}</p>}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
        {rows.map(([label, value, note]) => (
          <div key={label} className={note ? '-mx-2 col-span-2 rounded-lg bg-amber-950/50 px-2 py-1.5' : ''}>
            <dt className="text-[11px] font-semibold tracking-[0.06em] text-ink-500 uppercase">{label}</dt>
            <dd className={`text-[15px] ${note ? 'text-amber-100' : value ? 'text-ink-100' : 'text-ink-600'}`}>
              {value || 'Blank'}
            </dd>
            {note && <p className="text-xs text-amber-300">{note}</p>}
          </div>
        ))}
      </dl>
      {extraction?.notes && <p className="mt-3 text-sm text-ink-400">{extraction.notes}</p>}
    </section>
  )
}

function DeckDone({ skipped, onRetrySkipped }: { skipped: number; onRetrySkipped: () => void }) {
  return (
    <div className={`${panel} flex flex-col items-center gap-3 px-6 py-10 text-center`}>
      <span className="grid size-14 place-items-center rounded-full bg-accent-400/15 text-accent-400">
        <Icon name="check" size={28} />
      </span>
      <p className="text-lg font-semibold">No ready cards left</p>
      <p className="text-sm text-ink-400">
        {skipped > 0
          ? `You skipped ${skipped} ${skipped === 1 ? 'card' : 'cards'}.`
          : 'Cards that need you are still in the inbox.'}
      </p>
      <div className="flex w-full max-w-xs flex-col gap-2">
        {skipped > 0 && (
          <button type="button" onClick={onRetrySkipped} className={buttonPrimary}>
            Review skipped cards
          </button>
        )}
        <Link to="/scan" className={skipped > 0 ? buttonSecondary : buttonPrimary}>
          Back to inbox
        </Link>
      </div>
    </div>
  )
}
