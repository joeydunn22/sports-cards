import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Icon } from '../../components/Icon'
import { buttonPrimary, buttonSecondary, panel } from '../../components/ui'
import { NO_CARDS, useCards, useSaveTouchUps, type PhotoReplacement } from '../../hooks/useCards'
import type { TouchUpChange } from '../../lib/photoEdit'
import { cardTitle } from '../cards/cardText'
import { BATCH_SIZE, touchUpQueue, useTouchUpBatch, type CardResult } from './useTouchUpBatch'

type Pick = 'before' | 'after'

const CHANGE_LABELS: Record<TouchUpChange, string> = {
  straightened: 'Trimmed & straightened',
  glare: 'Glare filled',
  lighting: 'Lighting fixed',
}

/** Automatic touch-up for the whole collection: a batch at a time, every change reviewed before it's kept. */
export function TouchUpPage() {
  const navigate = useNavigate()
  const { data, isPending } = useCards()
  const save = useSaveTouchUps()
  const { batch, progress, run, clear } = useTouchUpBatch()
  const [picks, setPicks] = useState<Record<string, Pick>>({})
  // Cards whose photos couldn't be read this visit, so they don't come round again in every batch.
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set())
  const [zoom, setZoom] = useState<string | null>(null)

  const queue = touchUpQueue(data ?? NO_CARDS).filter((c) => !skipped.has(c.id))
  const pickOf = (cardId: string, side: string): Pick => picks[`${cardId}:${side}`] ?? 'after'

  function stop() {
    clear()
    navigate('/more')
  }

  async function saveAndContinue() {
    if (!batch) return
    const replacements: PhotoReplacement[] = batch.changed.flatMap(({ card, sides }) =>
      sides.filter((s) => pickOf(card.id, s.side) === 'after').map((s) => ({ card, side: s.side, crop: s.crop })),
    )
    const failed = new Set(batch.failed.map((c) => c.id))
    const checkedIds = batch.cards.filter((c) => !failed.has(c.id)).map((c) => c.id)
    await save.mutateAsync({ replacements, checkedIds })
    setSkipped((s) => new Set([...s, ...failed]))
    setPicks({})
    const done = new Set(batch.cards.map((c) => c.id))
    const next = queue.filter((c) => !done.has(c.id)).slice(0, BATCH_SIZE)
    if (next.length) await run(next)
    else clear()
    window.scrollTo(0, 0)
  }

  if (isPending) return <p className="p-6 text-slate-400">Loading…</p>

  if (progress) {
    return (
      <Shell onStop={stop}>
        <section className={`${panel} p-4`}>
          <p className="font-medium">
            Touching up card {Math.min(progress.done + 1, progress.total)} of {progress.total}…
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-sky-500 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
        </section>
      </Shell>
    )
  }

  if (!batch) {
    return (
      <Shell onStop={stop}>
        <section className={`${panel} flex flex-col gap-3 p-4`}>
          {queue.length ? (
            <>
              <p>
                <span className="font-semibold">{queue.length}</span> {queue.length === 1 ? 'card has' : 'cards have'}{' '}
                photos that haven’t been touched up yet.
              </p>
              <p className="text-sm text-slate-400">
                The background is trimmed off, crooked cards straightened and small glare spots filled, right here on your phone, at no cost. You
                see the old and new version of every change and pick which to keep; {BATCH_SIZE} cards at a time.
              </p>
              <button type="button" onClick={() => run(queue.slice(0, BATCH_SIZE))} className={`${buttonPrimary} min-h-12`}>
                Start
              </button>
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 font-semibold">
                <Icon name="check" size={20} className="text-emerald-400" /> All photos checked
              </p>
              <p className="text-sm text-slate-400">New cards show up here once they’re saved from the inbox.</p>
              <Link to="/more" className={buttonSecondary}>
                Back to More
              </Link>
            </>
          )}
        </section>
      </Shell>
    )
  }

  const unchanged = batch.cards.length - batch.changed.length - batch.failed.length
  const left = queue.length - batch.cards.length
  return (
    <Shell onStop={stop}>
      <p className="mb-3 text-sm text-slate-400">
        {batch.changed.length ? 'Tap the version to keep. The new one is picked unless you choose otherwise.' : ''}{' '}
        {unchanged > 0 && `${unchanged} ${unchanged === 1 ? 'card needed' : 'cards needed'} no changes. `}
        {batch.failed.length > 0 && `${batch.failed.length} couldn’t be loaded and will be skipped. `}
        {left > 0 ? `${left} more after this batch.` : 'This is the last batch.'}
      </p>
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
          <button type="button" onClick={stop} className={`${buttonSecondary} min-h-12 flex-1`}>
            Stop
          </button>
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => saveAndContinue().catch(() => {})}
            className={`${buttonPrimary} min-h-12 flex-[2]`}
          >
            {save.isPending ? 'Saving…' : left > 0 ? 'Save & next batch' : 'Save & finish'}
          </button>
        </div>
      </div>
      {zoom && <Zoom url={zoom} onClose={() => setZoom(null)} />}
    </Shell>
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

function Shell({ onStop, children }: { onStop: () => void; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 pt-[env(safe-area-inset-top)] pb-28 md:pt-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Touch up photos</h1>
        <button type="button" onClick={onStop} className="min-h-11 px-2 text-sm font-medium text-sky-400">
          Close
        </button>
      </header>
      {children}
    </main>
  )
}
