import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Icon } from '../../components/Icon'
import { buttonPrimary, buttonSecondary, panel } from '../../components/ui'
import { NO_CARDS, useCards, useSaveTouchUps, type PhotoReplacement } from '../../hooks/useCards'
import { CHANGE_LABELS } from '../../lib/photoEdit'
import type { Card } from '../../types/card'
import { cardTitle } from '../cards/cardText'
import { BATCH_SIZE, touchUpQueue, useTouchUpBatch, type Batch, type CardResult } from './useTouchUpBatch'

type Pick = 'before' | 'after'

/**
 * Automatic touch-up for the whole collection: starts on opening, a batch at a time, and every change is reviewed
 * before it's kept. Batches with nothing to review are saved and passed by themselves.
 */
export function TouchUpPage() {
  const navigate = useNavigate()
  const { data, isPending } = useCards()
  const save = useSaveTouchUps()
  const { batch, progress, load, clear } = useTouchUpBatch()
  const [picks, setPicks] = useState<Record<string, Pick>>({})
  // Cards whose photos couldn't be read this visit, so they don't come round again in every batch.
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set())
  // This visit's tally, for the progress line and the summary at the end.
  const [checked, setChecked] = useState(0)
  const [improved, setImproved] = useState(0)
  const [zoom, setZoom] = useState<string | null>(null)
  const started = useRef(false)
  const passedBy = useRef<Batch | null>(null)

  const queue = touchUpQueue(data ?? NO_CARDS).filter((c) => !skipped.has(c.id))
  const total = checked + queue.length
  const pickOf = (cardId: string, side: string): Pick => picks[`${cardId}:${side}`] ?? 'after'

  /** The next batch from `cards`, with the one after it got ready in the background. */
  const loadFrom = (cards: Card[]) => load(cards.slice(0, BATCH_SIZE), cards.slice(BATCH_SIZE, 2 * BATCH_SIZE))

  // Opening the page is the request: start without a Start button.
  useEffect(() => {
    if (isPending || started.current || queue.length === 0) return
    started.current = true
    void loadFrom(queue)
  })

  async function saveBatch() {
    if (!batch) return
    const replacements: PhotoReplacement[] = batch.changed.flatMap(({ card, sides }) =>
      sides.filter((s) => pickOf(card.id, s.side) === 'after').map((s) => ({ card, side: s.side, crop: s.crop })),
    )
    const failed = new Set(batch.failed.map((c) => c.id))
    const checkedIds = batch.cards.filter((c) => !failed.has(c.id)).map((c) => c.id)
    await save.mutateAsync({ replacements, checkedIds })
    setSkipped((s) => new Set([...s, ...failed]))
    setChecked((n) => n + checkedIds.length)
    setImproved((n) => n + replacements.length)
    setPicks({})
  }

  async function saveAndNext() {
    if (!batch) return
    await saveBatch()
    const done = new Set(batch.cards.map((c) => c.id))
    const rest = queue.filter((c) => !done.has(c.id))
    if (rest.length) void loadFrom(rest)
    else clear()
    window.scrollTo(0, 0)
  }

  async function saveAndStop() {
    await saveBatch()
    clear()
    navigate('/more')
  }

  // Nothing to choose in this batch (no photo needed a change): save it and move on by itself, once.
  useEffect(() => {
    if (!batch || batch.changed.length > 0 || passedBy.current === batch) return
    passedBy.current = batch
    saveAndNext().catch(() => {})
  })

  function close() {
    if (batch?.changed.length && !window.confirm('Leave without saving this batch? Its cards come up again next time.')) return
    clear()
    navigate('/more')
  }

  if (isPending) return <p className="p-6 text-slate-400">Loading…</p>

  const bar = total > 0 && <Progress done={checked + (progress?.done ?? 0)} total={total} />

  if (progress || (batch && batch.changed.length === 0 && !save.isError)) {
    const at = Math.min(checked + (progress?.done ?? 0) + 1, total)
    return (
      <Shell onClose={close}>
        <section className={`${panel} flex flex-col gap-3 p-4`}>
          <p className="flex items-center gap-2 font-medium">
            <span className="size-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
            Touching up card {at} of {total}…
          </p>
          {bar}
          <p className="text-sm text-slate-400">
            Cropping to the card, filling glare and fixing the lighting, here on your phone at no cost. You’ll see
            before and after for every change.
          </p>
        </section>
      </Shell>
    )
  }

  if (!batch) {
    return (
      <Shell onClose={close}>
        <section className={`${panel} flex flex-col gap-3 p-4`}>
          <p className="flex items-center gap-2 font-semibold">
            <Icon name="check" size={20} className="text-emerald-400" /> All photos checked
          </p>
          <p className="text-sm text-slate-400">
            {checked > 0 &&
              `${checked} ${checked === 1 ? 'card' : 'cards'} checked this time, ${improved} ${improved === 1 ? 'photo' : 'photos'} improved. `}
            New cards are touched up as they’re photographed, so they never need this page.
          </p>
          <Link to="/more" className={buttonSecondary}>
            Done
          </Link>
        </section>
      </Shell>
    )
  }

  const unchanged = batch.cards.length - batch.changed.length - batch.failed.length
  const left = queue.length - batch.cards.length
  return (
    <Shell onClose={close}>
      <div className="mb-3 flex flex-col gap-2">
        {bar}
        <p className="text-sm text-slate-400">
          Tap the one to keep. After is kept unless you tap Before.
          {unchanged > 0 && ` ${unchanged} ${unchanged === 1 ? 'card needed' : 'cards needed'} no changes.`}
          {batch.failed.length > 0 && ` ${batch.failed.length} couldn’t be loaded and will be skipped.`}
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {batch.changed.map((result) => (
          <ReviewCard
            key={result.card.id}
            result={result}
            pickOf={pickOf}
            onPick={(side, pick) => setPicks((p) => ({ ...p, [`${result.card.id}:${side}`]: pick }))}
            onZoom={setZoom}
          />
        ))}
      </ul>
      {save.isError && (
        <p className="mt-3 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-300">
          Couldn’t save: {save.error.message}. Try again.
        </p>
      )}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-800 bg-slate-950/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-3">
          {left > 0 && (
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => saveAndStop().catch(() => {})}
              className={`${buttonSecondary} min-h-12 flex-1`}
            >
              Save & stop
            </button>
          )}
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => saveAndNext().catch(() => {})}
            className={`${buttonPrimary} min-h-12 flex-[2]`}
          >
            {save.isPending ? 'Saving…' : left > 0 ? 'Save & next' : 'Save & finish'}
          </button>
        </div>
      </div>
      {zoom && <Zoom url={zoom} onClose={() => setZoom(null)} />}
    </Shell>
  )
}

function Progress({ done, total }: { done: number; total: number }) {
  return (
    <div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full bg-sky-500 transition-all" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <p className="mt-1 text-right text-xs text-slate-500 tabular-nums">
        {done} of {total} cards done
      </p>
    </div>
  )
}

type ReviewCardProps = {
  result: CardResult
  pickOf: (cardId: string, side: string) => Pick
  onPick: (side: string, pick: Pick) => void
  onZoom: (url: string) => void
}

function ReviewCard({ result: { card, sides }, pickOf, onPick, onZoom }: ReviewCardProps) {
  return (
    <li className={`${panel} flex flex-col gap-3 p-3`}>
      <p className="truncate text-sm font-medium">{cardTitle(card)}</p>
      {sides.map((s) => (
        <div key={s.side}>
          <p className="mb-1.5 text-xs text-slate-400">
            <span className="font-semibold text-slate-300 capitalize">{s.side}</span> ·{' '}
            {s.changes.map((c) => CHANGE_LABELS[c]).join(' · ')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(['before', 'after'] as const).map((version) => (
              <Version
                key={version}
                label={version === 'before' ? 'Before' : 'After'}
                url={version === 'before' ? s.before : s.after}
                picked={pickOf(card.id, s.side) === version}
                onPick={() => onPick(s.side, version)}
                onZoom={onZoom}
              />
            ))}
          </div>
        </div>
      ))}
    </li>
  )
}

type VersionProps = { label: string; url: string; picked: boolean; onPick: () => void; onZoom: (url: string) => void }

function Version({ label, url, picked, onPick, onZoom }: VersionProps) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onPick}
        aria-pressed={picked}
        aria-label={`Keep ${label.toLowerCase()}`}
        className={`grid aspect-[5/7] w-full place-items-center overflow-hidden rounded-xl border bg-slate-900 ${
          picked ? 'border-sky-400 ring-2 ring-sky-400' : 'border-slate-800 opacity-60'
        }`}
      >
        <img src={url} alt={label} className="size-full object-contain" />
      </button>
      <span
        className={`pointer-events-none absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
          picked ? 'bg-sky-500 text-slate-950' : 'bg-slate-950/80 text-slate-200'
        }`}
      >
        {picked && <Icon name="check" size={12} />}
        {label}
      </span>
      <button
        type="button"
        onClick={() => onZoom(url)}
        aria-label={`View ${label.toLowerCase()} full size`}
        className="absolute top-1 right-1 grid size-11 place-items-center rounded-full bg-slate-950/80 text-slate-100"
      >
        <Icon name="search" size={18} />
      </button>
    </div>
  )
}

function Zoom({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Photo"
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-black/95 p-2 pt-[max(0.5rem,env(safe-area-inset-top))]"
    >
      <img src={url} alt="" className="max-h-full max-w-full object-contain" />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 grid size-11 place-items-center rounded-full bg-slate-800/90 text-slate-100"
      >
        <Icon name="close" size={22} />
      </button>
    </div>
  )
}

function Shell({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 pt-[env(safe-area-inset-top)] pb-28 md:pt-4">
      <header className="mb-4 flex items-center justify-between gap-3 pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Touch up photos</h1>
        <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm font-medium text-sky-400">
          Close
        </button>
      </header>
      {children}
    </main>
  )
}
