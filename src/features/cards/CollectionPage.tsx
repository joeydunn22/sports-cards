import type { SortingState } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { inputClass } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { VersionTag } from '../../components/VersionTag'
import { buttonPrimary, buttonSecondary } from '../../components/ui'
import { NO_CARDS, useCards } from '../../hooks/useCards'
import { useSessionState } from '../../hooks/useSessionState'
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

  const headerActions = (
    <div className="flex items-center gap-3">
      <VersionTag />
      <Link to="/cards/new" className={`${buttonPrimary} max-md:hidden`}>
        <Icon name="plus" size={18} /> Add card
      </Link>
    </div>
  )

  if (isPending) return <CollectionSkeleton />
  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-4 pt-6">
        <p className="rounded-xl bg-red-950/50 p-4 text-red-300">Couldn’t load cards: {error.message}</p>
      </main>
    )
  }

  const subtitle = [
    plural(summary.totalCards, 'card'),
    plural(summary.players, 'player'),
    plural(summary.sets, 'set'),
  ].join(' · ')

  return (
    <main className="mx-auto max-w-6xl px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 md:pt-8">
      <PageHeader title="Collection" subtitle={<span className="tabular-nums">{subtitle}</span>} actions={headerActions} />

      {cards.length === 0 ? (
        <EmptyCollection />
      ) : (
        <>
          {/* Search stays in reach while scrolling a long list */}
          <div className="sticky top-[env(safe-area-inset-top)] z-10 -mx-4 mb-2 bg-ink-950/85 px-4 pt-2 pb-2 backdrop-blur-xl md:top-14">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Icon
                  name="search"
                  size={18}
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-500"
                />
                <input
                  type="search"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Search player, set, team…"
                  aria-label="Search cards"
                  className={`${inputClass} rounded-full pl-10`}
                />
              </div>
              <button
                type="button"
                aria-expanded={showFilters}
                aria-label={`Filters${activeFilters ? ` (${activeFilters} active)` : ''}`}
                onClick={() => setShowFilters((v) => !v)}
                className={`relative grid min-h-11 w-11 shrink-0 place-items-center rounded-full transition-colors ${
                  activeFilters || showFilters
                    ? 'bg-accent-400 text-ink-950'
                    : 'bg-ink-900 text-ink-300 ring-1 ring-white/[0.06]'
                }`}
              >
                <Icon name="sliders" size={19} />
                {activeFilters > 0 && (
                  <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-ink-50 text-[11px] font-bold text-ink-950 ring-2 ring-ink-950">
                    {activeFilters}
                  </span>
                )}
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="mb-3">
              <FilterPanel cards={cards} filters={filters} onChange={setFilters} />
            </div>
          )}

          <div className="mb-2 flex items-center justify-between gap-3 text-[13px] text-ink-500">
            <p className="tabular-nums">
              {filtered.length === cards.length
                ? `${cards.length} ${cards.length === 1 ? 'entry' : 'entries'}`
                : `Showing ${filtered.length} of ${cards.length}`}
            </p>
            <label className="relative flex items-center md:hidden">
              <span className="sr-only">Sort by</span>
              <select
                value={currentSort}
                onChange={(e) => {
                  const option = SORT_OPTIONS.find((o) => sortKey(o.sorting) === e.target.value)
                  if (option) setSorting(option.sorting)
                }}
                className="min-h-11 appearance-none bg-transparent pr-5 pl-2 text-right font-medium text-ink-200"
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
              <Icon name="chevron" size={14} className="pointer-events-none absolute right-0 text-ink-500" />
            </label>
          </div>

          {filtered.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-ink-300">No cards match.</p>
              <button
                type="button"
                onClick={() => setFilters({ ...emptyFilters })}
                className="mt-2 min-h-11 text-sm font-medium text-accent-400"
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

const plural = (n: number, word: string) => `${n.toLocaleString()} ${n === 1 ? word : `${word}s`}`

function EmptyCollection() {
  return (
    <div className="flex flex-col items-center gap-5 px-6 py-16 text-center">
      <span className="grid size-16 place-items-center rounded-3xl bg-accent-400/10 text-accent-400 ring-1 ring-accent-400/20">
        <Icon name="cards" size={28} />
      </span>
      <div>
        <p className="text-xl font-semibold tracking-tight">Start your collection</p>
        <p className="mt-1 text-sm text-ink-400">Scan a stack with your camera, or add one by hand.</p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Link to="/scan" className={buttonPrimary}>
          <Icon name="camera" size={18} /> Scan cards
        </Link>
        <Link to="/cards/new" className={buttonSecondary}>
          <Icon name="plus" size={18} /> Add a card
        </Link>
        <Link to="/more" className="min-h-11 content-center text-sm text-ink-400">
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
      <div className="mb-2 h-9 w-44 rounded-lg bg-ink-900" />
      <div className="mb-6 h-4 w-56 rounded bg-ink-900" />
      <div className="mb-4 h-11 rounded-full bg-ink-900" />
      <div className="h-96 rounded-2xl bg-ink-900" />
    </main>
  )
}
