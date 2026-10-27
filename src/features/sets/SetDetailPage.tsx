import { useMemo, useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import { inputClass } from '../../components/Field'
import { PageHeader } from '../../components/PageHeader'
import { buttonPrimary, buttonSecondary, panel, sectionTitle } from '../../components/ui'
import {
  NO_IMPORTS,
  useCardpediaImports,
  useImportFromCardpedia,
  type CardpediaImport,
} from '../../hooks/useCardpedia'
import { NO_ENTRIES, useChecklist, useDeleteChecklistEntry, type ChecklistEntry } from '../../hooks/useChecklist'
import {
  NO_FETCHES,
  NO_PARALLELS,
  useDeleteParallel,
  useParallelFetches,
  useSaveParallels,
  useSetParallels,
  useUpdateParallel,
  type ParallelRow,
} from '../../hooks/useSetParallels'
import { useAiApproval } from '../ai/useAiApproval'
import { parallelsFor } from '../cards/parallels'
import { sameSet, type SetRef } from './setIndex'
import { useParallelLookup } from './useParallelLookup'

const SOURCE: Record<string, string> = {
  collection: 'your card',
  search: 'AI search',
  manual: 'you added',
  cardpedia: 'Baseball Cardpedia',
}
const numbered = (run: number | null) => (run == null ? 'not numbered' : `/${run}`)
const parseRun = (value: string) => (/^\d+$/.test(value.trim()) && Number(value) > 0 ? Number(value) : null)
const byInsert = (a: string, b: string) => (a ? (b ? a.localeCompare(b) : 1) : -1)
/** Enough to scroll through on a phone; the search narrows a big checklist down. */
const MAX_SPOTS = 150

/** One set: its parallels by insert, and the card numbers the app knows. Everything here can be corrected. */
export function SetDetailPage() {
  const params = useParams()
  const set = useMemo(() => ({ year: params.year ?? '', set_name: params.set ?? '' }), [params.year, params.set])
  const { data: parallels = NO_PARALLELS } = useSetParallels(set)
  const { data: spots = NO_ENTRIES } = useChecklist(set)
  const { data: fetches = NO_FETCHES } = useParallelFetches()
  const { data: imports = NO_IMPORTS } = useCardpediaImports()
  const ai = useAiApproval()
  const lookup = useParallelLookup(ai)

  const inserts = [...new Set(parallels.map((p) => p.insert_name))].sort(byInsert)
  const fetch = fetches.find((f) => sameSet(f, set))
  const cardpedia = imports.find((i) => sameSet(i, set)) ?? null
  const hasList = parallels.some((p) => p.source !== 'collection')

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 md:pt-6">
      <PageHeader title={`${set.year} ${set.set_name}`} backTo="/sets" backLabel="Sets" />

      <CardpediaPanel set={set} found={cardpedia} />

      <section className={`${panel} flex flex-col gap-3 p-4`}>
        <h2 className="text-lg font-semibold">Parallels</h2>
        {fetch?.status === 'pending' && <p className="text-sm text-ink-300">Looking up this set’s parallels…</p>}
        {fetch?.status === 'done' && (
          <p className="text-xs text-ink-500">
            Looked up {new Date(fetch.updated_at).toLocaleDateString()}
            {fetch.notes ? `: ${fetch.notes}` : '.'}
          </p>
        )}
        {!hasList && fetch?.status !== 'pending' && (
          <div className="flex flex-col gap-1">
            <p className="text-sm text-ink-400">
              {parallels.length
                ? 'Only the parallels of cards you’ve saved are known so far.'
                : 'No parallels known yet.'}
            </p>
            <button
              type="button"
              disabled={lookup.busy}
              onClick={() => void lookup.run(set.year, set.set_name)}
              className={`${buttonSecondary} min-h-11 self-start text-sm`}
            >
              {lookup.busy ? 'Looking up parallels…' : `Look up the full list (~${lookup.cost})`}
            </button>
            {lookup.error && <p className="text-xs text-amber-300">{lookup.error}</p>}
          </div>
        )}
        {inserts.map((insert) => (
          <div key={insert} className="flex flex-col gap-1">
            <h3 className={sectionTitle}>{insert || 'Base set'}</h3>
            <ul className="flex flex-col divide-y divide-ink-800">
              {parallelsFor(parallels, { ...set, insert_name: insert }).map((p) => (
                <ParallelItem key={p.id} parallel={p} />
              ))}
            </ul>
          </div>
        ))}
        <AddParallel set={set} inserts={inserts} />
      </section>

      <Checklist spots={spots} />
      {ai.dialog}
    </main>
  )
}

/**
 * Where the set's Baseball Cardpedia data came from, with a way to read it again or, when the names
 * don't match, to point the set at the right page (say, "2011 Bowman Draft Picks & Prospects").
 */
function CardpediaPanel({ set, found }: { set: SetRef; found: CardpediaImport | null }) {
  const importer = useImportFromCardpedia()
  const [editing, setEditing] = useState(false)
  const [page, setPage] = useState('')
  const search = `https://baseballcardpedia.com/index.php?search=${encodeURIComponent(`${set.year} ${set.set_name}`)}`
  const pageUrl = (title: string) =>
    `https://baseballcardpedia.com/index.php/${encodeURIComponent(title.replace(/ \(Chrome\)$/, '').replace(/ /g, '_'))}`

  function submitPage(e: FormEvent) {
    e.preventDefault()
    if (!page.trim()) return
    importer.mutate({ sets: [{ ...set, page: page.trim() }] }, { onSuccess: () => setEditing(false) })
  }

  return (
    <section className={`${panel} flex flex-col gap-2 p-4 text-sm`}>
      <h2 className="text-lg font-semibold">Baseball Cardpedia</h2>
      {!found ? (
        <p className="text-ink-400">Not looked up yet. Baseball sets are read from there for free.</p>
      ) : found.status === 'done' ? (
        <p className="text-ink-300">
          Read from{' '}
          <a href={pageUrl(found.page ?? '')} target="_blank" rel="noreferrer" className="text-accent-400 underline">
            {found.page}
          </a>{' '}
          on {new Date(found.updated_at).toLocaleDateString()}: {found.parallels.toLocaleString()} parallels,{' '}
          {found.cards.toLocaleString()} cards.
        </p>
      ) : found.status === 'not_found' ? (
        <p className="text-amber-300">
          {found.error ?? 'No page matches this set’s name.'} If it’s there under another name,{' '}
          <a href={search} target="_blank" rel="noreferrer" className="underline">
            search Cardpedia
          </a>{' '}
          and enter the page’s title below.
        </p>
      ) : (
        <p className="text-amber-300">Couldn’t read it: {found.error}</p>
      )}
      {importer.error && <p className="text-red-300">{importer.error.message}</p>}
      {editing || found?.status === 'not_found' ? (
        <form onSubmit={submitPage} className="flex flex-wrap items-center gap-2">
          <input
            value={page}
            onChange={(e) => setPage(e.target.value)}
            placeholder={`e.g. ${set.year} Bowman Draft Picks & Prospects`}
            aria-label="Cardpedia page title"
            className={`${inputClass} min-w-0 flex-1`}
          />
          <button type="submit" disabled={importer.isPending || !page.trim()} className={`${buttonPrimary} min-h-11`}>
            {importer.isPending ? 'Reading…' : 'Use this page'}
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={importer.isPending}
            onClick={() => importer.mutate({ sets: [set], again: true })}
            className={`${buttonSecondary} min-h-11 text-sm`}
          >
            {importer.isPending ? 'Reading…' : found ? 'Read again' : 'Get it from Cardpedia (free)'}
          </button>
          {found && (
            <button type="button" onClick={() => setEditing(true)} className="min-h-11 px-2 text-sm text-accent-400">
              Use a different page
            </button>
          )}
        </div>
      )}
    </section>
  )
}

/** Who each card number is, by insert, searchable (a full checklist runs to thousands). */
function Checklist({ spots }: { spots: ChecklistEntry[] }) {
  const [query, setQuery] = useState('')
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = spots
    .filter((s) => {
      const text = `${s.card_number} ${s.player} ${s.insert_name} ${s.team ?? ''}`.toLowerCase()
      return words.every((w) => text.includes(w))
    })
    .sort(
      (a, b) =>
        byInsert(a.insert_name, b.insert_name) || a.card_number.localeCompare(b.card_number, undefined, { numeric: true }),
    )
  const inserts = [...new Set(shown.slice(0, MAX_SPOTS).map((s) => s.insert_name))]

  return (
    <section className={`${panel} flex flex-col gap-3 p-4`}>
      <div>
        <h2 className="text-lg font-semibold">Cards</h2>
        <p className="text-sm text-ink-400">
          Who each card number is. Scans and Add card fill in the player, team and RC from these.
        </p>
      </div>
      {spots.length > 20 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by number, player or insert"
          aria-label="Search this set’s cards"
          className={inputClass}
        />
      )}
      {spots.length === 0 ? (
        <p className="text-sm text-ink-400">None yet.</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-ink-400">No card matches.</p>
      ) : (
        inserts.map((insert) => (
          <div key={insert} className="flex flex-col gap-1">
            <h3 className={sectionTitle}>{insert || 'Base set'}</h3>
            <ul className="flex flex-col divide-y divide-ink-800">
              {shown
                .slice(0, MAX_SPOTS)
                .filter((s) => s.insert_name === insert)
                .map((s) => (
                  <SpotItem key={s.id} spot={s} />
                ))}
            </ul>
          </div>
        ))
      )}
      {shown.length > MAX_SPOTS && (
        <p className="text-xs text-ink-500">
          Showing {MAX_SPOTS} of {shown.length.toLocaleString()}. Search to find the rest.
        </p>
      )}
    </section>
  )
}

function ParallelItem({ parallel }: { parallel: ParallelRow }) {
  const update = useUpdateParallel()
  const remove = useDeleteParallel()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(parallel.parallel)
  const [run, setRun] = useState(parallel.print_run?.toString() ?? '')

  function save(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    update.mutate({ id: parallel.id, parallel: name.trim(), print_run: parseRun(run) })
    setEditing(false)
  }

  if (editing) {
    return (
      <li className="py-2">
        <form onSubmit={save} className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Parallel"
            autoCapitalize="words"
            className={`${inputClass} min-w-0 flex-[2]`}
          />
          <span className="text-ink-500">/</span>
          <input
            value={run}
            onChange={(e) => setRun(e.target.value)}
            aria-label="Print run"
            inputMode="numeric"
            placeholder="—"
            className={`${inputClass} w-20 flex-none`}
          />
          <button type="submit" className={`${buttonPrimary} min-h-11`}>
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className="min-h-11 px-2 text-sm text-ink-400">
            Cancel
          </button>
        </form>
      </li>
    )
  }
  return (
    <li className="flex min-h-12 items-center justify-between gap-2 py-1">
      <button type="button" onClick={() => setEditing(true)} className="min-h-11 min-w-0 flex-1 text-left">
        <span className="font-medium">{parallel.parallel}</span>{' '}
        <span className="text-ink-300">{numbered(parallel.print_run)}</span>
        <span className="block text-xs text-ink-500">from {SOURCE[parallel.source] ?? parallel.source}</span>
      </button>
      <button
        type="button"
        disabled={remove.isPending}
        onClick={() => {
          if (window.confirm(`Remove ${parallel.parallel} from this set’s list?`)) remove.mutate(parallel.id)
        }}
        className="min-h-11 shrink-0 px-2 text-sm font-medium text-red-300"
      >
        Remove
      </button>
    </li>
  )
}

function AddParallel({ set, inserts }: { set: { year: string; set_name: string }; inserts: string[] }) {
  const save = useSaveParallels()
  const [open, setOpen] = useState(false)
  const [insert, setInsert] = useState('')
  const [name, setName] = useState('')
  const [run, setRun] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await save.mutateAsync([{ ...set, insert_name: insert.trim(), parallel: name.trim(), print_run: parseRun(run) }])
    setName('')
    setRun('')
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 self-start text-sm text-accent-400">
        + Add a parallel
      </button>
    )
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-2 border-t border-ink-800 pt-3">
      <datalist id="set-inserts">
        {inserts.filter(Boolean).map((i) => (
          <option key={i} value={i} />
        ))}
      </datalist>
      <input
        value={insert}
        onChange={(e) => setInsert(e.target.value)}
        list="set-inserts"
        placeholder="Insert (blank for the base set)"
        aria-label="Insert"
        autoCapitalize="words"
        className={inputClass}
      />
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Parallel, e.g. Red Refractor"
          aria-label="Parallel"
          autoCapitalize="words"
          className={`${inputClass} min-w-0 flex-[2]`}
        />
        <span className="text-ink-500">/</span>
        <input
          value={run}
          onChange={(e) => setRun(e.target.value)}
          placeholder="5"
          aria-label="Print run"
          inputMode="numeric"
          className={`${inputClass} w-20 flex-none`}
        />
      </div>
      {save.error && <p className="text-sm text-red-300">{save.error.message}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={save.isPending || !name.trim()} className={`${buttonPrimary} min-h-11`}>
          Add
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 px-2 text-sm text-ink-400">
          Done
        </button>
      </div>
    </form>
  )
}

function SpotItem({ spot }: { spot: ChecklistEntry }) {
  const remove = useDeleteChecklistEntry()
  const fromCard = spot.source === 'collection'
  return (
    <li className="flex min-h-12 items-center justify-between gap-2 py-1">
      <div className="min-w-0">
        <p className="truncate">
          <span className="text-ink-400">#{spot.card_number}</span> <span className="font-medium">{spot.player}</span>
          {spot.is_rookie && <span className="text-xs text-accent-300"> RC</span>}
        </p>
        <p className="truncate text-xs text-ink-500">
          {spot.team ? `${spot.team} · ` : ''}from {SOURCE[spot.source] ?? spot.source}
        </p>
      </div>
      <button
        type="button"
        disabled={remove.isPending}
        onClick={() => {
          const note = fromCard ? ' It comes back the next time that card is saved.' : ''
          if (window.confirm(`Forget #${spot.card_number} ${spot.player}?${note}`)) remove.mutate(spot.id)
        }}
        className="min-h-11 shrink-0 px-2 text-sm font-medium text-red-300"
      >
        Forget
      </button>
    </li>
  )
}
