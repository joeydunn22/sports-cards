import type { SortingState } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { inputClass } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { buttonPrimary, buttonSecondary, panel } from '../../components/ui'
import { NO_CARDS, useCards } from '../../hooks/useCards'
import { useSessionState } from '../../hooks/useSessionState'
import { formatMoney } from '../../lib/format'
import { CardList, CardTable } from './CardTable'
import { countActiveFilters, emptyFilters, filterCards, summarize, type CardFilters } from './collection'
import { FilterPanel } from './FilterPanel'
import { DEFAULT_SORTING, SORT_OPTIONS, useCardTable } from './useCardTable'

const sortKey = (s: SortingState) => s.map((c) => `${c.id}:${c.desc}`).join(',')

export function CollectionPage() {
  const { data, isPending, error } = useCards()
  const cards = data ?? NO_CARDS
  const [filters, setFilters] = useSessionState<CardFilters>('sports-cards:filters', emptyFilters)
  const [sorting, setSorting] = useSessionState<SortingState>('sports-cards:sorting', DEFAULT_SORTING)
  const [showFilters, setShowFilters] = useState(false)

  const filtered = useMemo(() => filterCards(cards, filters), [cards, filters])
  const summary = useMemo(() => summarize(cards), [cards])
  const table = useCardTable(filtered, sorting, setSorting)
  const activeFilters = countActiveFilters(filters)
  const currentSort = sortKey(sorting)

  const addButton = (
    <Link to="/cards/new" className={`${buttonPrimary} max-md:hidden`}>
      <Icon name="plus" size={18} /> Add card
    </Link>
  )

  if (isPending) return <CollectionSkeleton />
  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-4 pt-6">
        <p className="rounded-xl bg-red-950/50 p-4 text-red-300">Couldn’t load cards: {error.message}</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 md:pt-6">
      <PageHeader title="Collection" actions={addButton} />

      <section className="mb-5 grid grid-cols-3 gap-2" aria-label="Summary">
        <Stat label={summary.totalCards === 1 ? 'Card' : 'Cards'} value={summary.totalCards.toLocaleString()} />
        <Stat
          label="Est. value"
          value={summary.valuedCards > 0 ? formatMoney(summary.totalValue, { whole: true }) : '—'}
          note={
            summary.valuedCards > 0 && summary.valuedCards < summary.totalCards
              ? `${summary.valuedCards} of ${summary.totalCards} valued`
              : undefined
          }
        />
        <Stat label="Paid" value={summary.totalCost > 0 ? formatMoney(summary.totalCost, { whole: true }) : '—'} />
      </section>

      {cards.length === 0 ? (
        <EmptyCollection />
      ) : (
        <>
          <div className="mb-3 flex gap-2">
            <div className="relative flex-1">
              <Icon
                name="search"
                size={18}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500"
              />
              <input
                type="search"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search player, set, team…"
                aria-label="Search cards"
                className={`${inputClass} pl-10`}
              />
            </div>
            <button
              type="button"
              aria-expanded={showFilters}
              aria-label={`Filters${activeFilters ? ` (${activeFilters} active)` : ''}`}
              onClick={() => setShowFilters((v) => !v)}
              className={`relative grid min-h-11 w-12 shrink-0 place-items-center rounded-xl border ${
                activeFilters || showFilters
                  ? 'border-sky-500 bg-sky-500/10 text-sky-400'
                  : 'border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              <Icon name="sliders" size={20} />
              {activeFilters > 0 && (
                <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-sky-500 text-[11px] font-bold text-slate-950">
                  {activeFilters}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="mb-3">
              <FilterPanel cards={cards} filters={filters} onChange={setFilters} />
            </div>
          )}

          <div className="mb-3 flex items-center justify-between gap-3 text-sm text-slate-400">
            <p>
              {filtered.length === cards.length
                ? `${cards.length} ${cards.length === 1 ? 'entry' : 'entries'}`
                : `Showing ${filtered.length} of ${cards.length}`}
            </p>
            <label className="flex items-center gap-1 md:hidden">
              <span className="sr-only">Sort by</span>
              <select
                value={currentSort}
                onChange={(e) => {
                  const option = SORT_OPTIONS.find((o) => sortKey(o.sorting) === e.target.value)
                  if (option) setSorting(option.sorting)
                }}
                className="min-h-11 rounded-lg bg-transparent px-1 text-right font-medium text-slate-200"
              >
                {!SORT_OPTIONS.some((o) => sortKey(o.sorting) === currentSort) && (
                  <option value={currentSort}>Custom</option>
                )}
                {SORT_OPTIONS.map((o) => (
                  <option key={o.label} value={sortKey(o.sorting)}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filtered.length === 0 ? (
            <div className={`${panel} p-8 text-center`}>
              <p className="text-slate-300">No cards match.</p>
              <button
                type="button"
                onClick={() => setFilters({ ...emptyFilters })}
                className="mt-2 min-h-11 text-sm text-sky-400"
              >
                Clear search and filters
              </button>
            </div>
          ) : (
            <>
              <div className="md:hidden">
                <CardList table={table} />
              </div>
              <div className="hidden md:block">
                <CardTable table={table} />
              </div>
            </>
          )}
        </>
      )}
    </main>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={`${panel} px-3 py-2.5`}>
      <p className="truncate text-lg font-semibold tabular-nums">{value}</p>
      <p className="truncate text-xs text-slate-400">{note ?? label}</p>
    </div>
  )
}

function EmptyCollection() {
  return (
    <div className={`${panel} flex flex-col items-center gap-4 px-6 py-10 text-center`}>
      <span className="grid size-14 place-items-center rounded-2xl bg-sky-500/10 text-sky-400">
        <Icon name="cards" size={28} />
      </span>
      <div>
        <p className="text-lg font-semibold">No cards yet</p>
        <p className="mt-1 text-sm text-slate-400">Scan a stack with your camera, or add one by hand.</p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Link to="/scan" className={buttonPrimary}>
          <Icon name="camera" size={18} /> Scan cards
        </Link>
        <Link to="/cards/new" className={buttonSecondary}>
          <Icon name="plus" size={18} /> Add a card
        </Link>
        <Link to="/more" className="min-h-11 content-center text-sm text-slate-400">
          or import a spreadsheet
        </Link>
      </div>
    </div>
  )
}

function CollectionSkeleton() {
  return (
    <main className="mx-auto max-w-6xl animate-pulse px-4 pt-[max(1.5rem,env(safe-area-inset-top))] md:pt-6" aria-busy>
      <span className="sr-only">Loading your collection…</span>
      <div className="mb-5 h-8 w-40 rounded-lg bg-slate-800" />
      <div className="mb-5 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-2xl bg-slate-900" />
        ))}
      </div>
      <div className="mb-4 h-11 rounded-xl bg-slate-900" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="mb-2 h-20 rounded-2xl bg-slate-900" />
      ))}
    </main>
  )
}
