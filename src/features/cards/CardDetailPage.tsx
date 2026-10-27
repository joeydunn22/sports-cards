import { useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { Icon } from '../../components/Icon'
import { buttonSecondary, panel, sectionTitle } from '../../components/ui'
import { NO_CARDS, useCards } from '../../hooks/useCards'
import { usePhotoUrl } from '../../hooks/usePhotos'
import { formatSerial } from '../../lib/format'
import type { Card } from '../../types/card'
import { CardBadges } from './CardBadges'
import { Lightbox } from './CardPhotos'
import { isSold } from './collection'
import { teamColors } from './teamColors'
import { TeamRule, TeamWash } from './TeamWash'

/** Router state from the collection list: its current order, for next/previous on the card screen. */
export type CardOrder = { order?: string[] }

/** One card, view first: big photos, every field that's filled in, and Edit for changes. */
export function CardDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const { data, isPending } = useCards()
  const cards = data ?? NO_CARDS
  const card = cards.find((c) => c.id === id)
  const order = (location.state as CardOrder | null)?.order
  const at = order && id ? order.indexOf(id) : -1

  if (isPending) return <p className="p-6 text-ink-400">Loading…</p>
  if (!card) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-ink-300">That card doesn’t exist (it may have been deleted).</p>
        <Link to="/" className={`${buttonSecondary} mt-4`}>
          Back to collection
        </Link>
      </main>
    )
  }

  const colors = teamColors(card.team, card)
  const version = [card.insert_name, card.parallel].filter(Boolean).join(' · ')
  const step = (by: number) => (order && at >= 0 ? order[at + by] : undefined)
  const prev = step(-1)
  const next = step(1)

  return (
    <main className="relative isolate mx-auto max-w-3xl px-4 pt-[env(safe-area-inset-top)] pb-10 md:pt-4">
      <TeamWash colors={colors} />
      <div className="flex min-h-11 items-center justify-between">
        <Link
          to="/"
          className="-ml-2 flex min-h-11 items-center gap-0.5 pr-2 text-[15px] font-medium text-accent-400 active:text-accent-300"
        >
          <Icon name="back" size={20} /> Collection
        </Link>
        <div className="flex items-center gap-1">
          {order && (
            <>
              <StepLink to={prev} state={location.state} label="Previous card" flip />
              <span className="px-1 text-[13px] text-ink-500 tabular-nums">
                {at + 1} / {order.length}
              </span>
              <StepLink to={next} state={location.state} label="Next card" />
            </>
          )}
          <Link
            to={`/cards/${card.id}/edit`}
            state={location.state}
            className="ml-1 flex min-h-11 items-center gap-1.5 rounded-full bg-ink-800/80 px-4 text-sm font-medium text-ink-100 backdrop-blur active:bg-ink-700"
          >
            <Icon name="edit" size={16} /> Edit
          </Link>
        </div>
      </div>

      <PhotoCarousel card={card} />

      <header className="mt-5 mb-5 flex flex-col gap-1">
        {card.team && (
          <p
            className={`text-[12px] font-semibold tracking-[0.08em] uppercase ${colors ? '' : 'text-ink-500'}`}
            style={{ color: colors?.onDark }}
          >
            {card.team}
          </p>
        )}
        <h1 className="text-[32px] leading-tight font-bold tracking-tight text-ink-50">
          {card.player}
          {card.quantity > 1 && <span className="font-normal text-ink-500"> ×{card.quantity}</span>}
        </h1>
        <p className="text-[15px] text-ink-400">
          {card.year} {card.set_name} <span className="text-ink-500">#{card.card_number}</span>
          {version && <span className="block text-ink-300">{version}</span>}
        </p>
        <div className="mt-1 empty:hidden">
          <CardBadges card={card} />
        </div>
      </header>

      <TeamRule colors={colors} />
      <Details card={card} />
    </main>
  )
}

function StepLink({ to, state, label, flip }: { to?: string; state: unknown; label: string; flip?: boolean }) {
  const icon = <Icon name="back" size={20} className={flip ? '' : 'rotate-180'} />
  if (!to) {
    return (
      <span aria-hidden className="grid size-11 place-items-center text-ink-700">
        {icon}
      </span>
    )
  }
  return (
    <Link
      to={`/cards/${to}`}
      state={state}
      replace
      aria-label={label}
      className="grid size-11 place-items-center rounded-full text-ink-200 active:bg-ink-800"
    >
      {icon}
    </Link>
  )
}

/** Front and back, one at a time: swipe between them, tap to open full screen (pinch to zoom there). */
function PhotoCarousel({ card }: { card: Card }) {
  const [shown, setShown] = useState(0)
  const [open, setOpen] = useState<string | null>(null)
  const sides = (
    [
      ['front', card.front_image_path],
      ['back', card.back_image_path],
    ] as const
  ).filter(([, path]) => path)
  if (sides.length === 0) return null

  return (
    <div className="mt-2">
      <div
        className="-mx-4 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => {
          const el = e.currentTarget
          setShown(Math.round(el.scrollLeft / el.clientWidth))
        }}
      >
        {sides.map(([side, path]) => (
          <div key={side} className="relative flex w-full shrink-0 snap-center justify-center px-4">
            <BigPhoto path={path!} label={side === 'front' ? 'Front' : 'Back'} onOpen={() => setOpen(path)} />
            <Link
              to={`/cards/${card.id}/photo/${side}`}
              aria-label={`Edit ${side} photo`}
              className="absolute right-6 bottom-2 flex min-h-11 items-center gap-1.5 rounded-full bg-ink-950/75 px-3 text-sm font-medium text-ink-100 backdrop-blur active:bg-ink-800"
            >
              <Icon name="edit" size={16} /> Photo
            </Link>
          </div>
        ))}
      </div>
      {sides.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
          {sides.map(([side], i) => (
            <span
              key={side}
              className={`h-1.5 rounded-full transition-all ${i === shown ? 'w-5 bg-ink-100' : 'w-1.5 bg-ink-600'}`}
            />
          ))}
        </div>
      )}
      {open && <Lightbox path={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function BigPhoto({ path, label, onOpen }: { path: string; label: string; onOpen: () => void }) {
  const { data: url, isError } = usePhotoUrl(path)
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`View ${label.toLowerCase()} full size`}
      className="grid aspect-[5/7] max-h-[60vh] w-full max-w-sm place-items-center overflow-hidden rounded-2xl bg-ink-900 shadow-[0_24px_50px_-18px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.06]"
    >
      {url ? (
        <img src={url} alt={label} className="size-full object-contain" />
      ) : (
        <span className="text-sm text-ink-500">{isError ? 'Couldn’t load' : 'Loading…'}</span>
      )}
    </button>
  )
}

const money = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
const day = (d: string) =>
  new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

/** Every field that has a value; empty ones are left out. Money sits in its own collapsed section. */
function Details({ card }: { card: Card }) {
  const grade = card.is_graded ? [card.grade_company, card.grade].filter(Boolean).join(' ') || 'Yes' : null
  const identity: [string, ReactNode][] = [
    ['Year', card.year],
    ['Set', card.set_name],
    ['Card #', card.card_number],
    ['Insert', card.insert_name || 'Base'],
    ['Parallel', card.parallel || 'Base'],
    ['Numbered', formatSerial(card.serial_number, card.print_run) || null],
    ['Team', card.team],
    ['Sport', card.sport],
    ['Graded', grade],
    ['Cert #', card.is_graded ? card.cert_number : null],
    ['Condition', card.raw_condition],
    ['Quantity', card.quantity > 1 ? card.quantity : null],
    ['Added', day(card.created_at)],
  ]
  const value: [string, ReactNode][] = [
    ['Est. value', card.estimated_value != null ? money(card.estimated_value) : null],
    ['Paid', card.purchase_price != null ? money(card.purchase_price) : null],
    ['Bought', card.purchase_date ? day(card.purchase_date) : null],
    ['Sold for', card.sold_price != null ? money(card.sold_price) : null],
    ['Sold', card.sold_date ? day(card.sold_date) : null],
  ]
  const hasValue = value.some(([, v]) => v != null)

  return (
    <div className="flex flex-col gap-4">
      {isSold(card) && (
        <p className="rounded-xl bg-amber-950/60 px-3 py-2 text-sm text-amber-200">Sold: not counted in the collection.</p>
      )}
      <section className={`${panel} p-4`}>
        <h2 className={`${sectionTitle} mb-3`}>Card</h2>
        <FieldList rows={identity} />
      </section>
      {hasValue && (
        <details className={`${panel} group`}>
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 [&::-webkit-details-marker]:hidden">
            <span className={sectionTitle}>Value</span>
            <Icon name="chevron" size={18} className="text-ink-500 transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4">
            <FieldList rows={value} />
          </div>
        </details>
      )}
    </div>
  )
}

function FieldList({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
      {rows
        .filter(([, v]) => v != null && v !== '')
        .map(([label, v]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[11px] font-semibold tracking-[0.06em] text-ink-500 uppercase">{label}</dt>
            <dd className="text-[15px] break-words text-ink-100">{v}</dd>
          </div>
        ))}
    </dl>
  )
}
