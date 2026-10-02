import type { SortingState } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { inputClass } from '../../components/Field'
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

  if (isPending) return <p className="p-4 text-slate-400">Loading your collection…</p>
  if (error) return <p className="p-4 text-red-400">Couldn’t load cards: {error.message}</p>

  return (
    <main className="mx-auto max-w-6xl px-4 py-4 pb-28">
      <section className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-xl font-semibold">
          {summary.totalCards.toLocaleString()} {summary.totalCards === 1 ? 'card' : 'cards'}
        </h1>
        {summary.valuedCards > 0 && (
          <p className="text-sm text-slate-400">
            <span className="text-slate-200">{formatMoney(summary.totalValue, { whole: true })}</span> est. value
            {summary.valuedCards < summary.totalCards && ` (${summary.valuedCards} of ${summary.totalCards} valued)`}
          </p>
        )}
        {summary.totalCost > 0 && (
          <p className="text-sm text-slate-400">
            <span className="text-slate-200">{formatMoney(summary.totalCost, { whole: true })}</span> paid
          </p>
        )}
      </section>

      {cards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center">
          <p className="text-slate-300">No cards yet.</p>
          <p className="mt-1 text-sm text-slate-500">
            Tap <strong>Add card</strong> to start, or{' '}
            <Link to="/import-export" className="text-sky-400">
              import a spreadsheet
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex gap-2">
            <input
              type="search"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search player, set, team…"
              aria-label="Search cards"
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              aria-expanded={showFilters}
              onClick={() => setShowFilters((v) => !v)}
              className={`min-h-11 shrink-0 rounded-lg border px-4 text-sm ${
                activeFilters ? 'border-sky-500 text-sky-400' : 'border-slate-700 text-slate-300'
              }`}
            >
              Filters{activeFilters ? ` (${activeFilters})` : ''}
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
            <label className="flex items-center gap-2 md:hidden">
              Sort
              <select
                value={currentSort}
                onChange={(e) => {
                  const option = SORT_OPTIONS.find((o) => sortKey(o.sorting) === e.target.value)
                  if (option) setSorting(option.sorting)
                }}
                className="min-h-11 rounded-lg border border-slate-700 bg-slate-900 px-2 text-slate-200"
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
            <p className="py-8 text-center text-slate-400">No cards match. Try clearing filters.</p>
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

      <Link
        to="/cards/new"
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 flex min-h-14 items-center rounded-full bg-sky-500 px-6 font-semibold text-slate-950 shadow-lg shadow-sky-950"
      >
        + Add card
      </Link>
    </main>
  )
}
