import { useMemo, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router'
import { inputClass } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { buttonPrimary, buttonSecondary, panel } from '../../components/ui'
import { NO_CARDS, useCards } from '../../hooks/useCards'
import { NO_ENTRIES, useChecklist } from '../../hooks/useChecklist'
import {
  NO_FETCHES,
  NO_PARALLELS,
  useFetchParallels,
  useForgetFetch,
  useParallelFetches,
  useSaveParallels,
  useSetParallels,
  type ParallelFetch,
} from '../../hooks/useSetParallels'
import { downloadFile } from '../../lib/csv'
import { formatCost } from '../ai/costEstimate'
import { parallelsRequest } from '../ai/requests'
import { useAiApproval } from '../ai/useAiApproval'
import { getAiModel } from '../scan/aiModel'
import {
  listSets,
  parallelsTemplate,
  parseParallelsCsv,
  parseSetLines,
  sameSet,
  setKey,
  setPath,
  type SetRef,
  type SetSummary,
} from './setIndex'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const label = (s: SetRef) => `${s.year} ${s.set_name}`

/** The card database, set by set: what the app knows, getting sets ready before scanning, and fixes. */
export function SetsPage() {
  const { data: parallels = NO_PARALLELS } = useSetParallels()
  const { data: spots = NO_ENTRIES } = useChecklist()
  const { data: fetches = NO_FETCHES } = useParallelFetches()
  const sets = useMemo(() => listSets(parallels, spots, fetches), [parallels, spots, fetches])
  const [query, setQuery] = useState('')
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const shown = sets.filter((s) => words.every((w) => label(s).toLowerCase().includes(w)))

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 md:pt-6">
      <PageHeader title="Sets" backTo="/more" backLabel="More" />

      <section className={`${panel} flex flex-col gap-2 p-4 text-sm text-slate-300`}>
        <p>What the app has learned about each set, used to fill in cards for free before any paid AI search:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="font-medium text-slate-100">Parallels</span>: each color or finish and what it’s numbered
            to. In 2011 Bowman Chrome Draft, a card numbered /5 can only be the Red Refractor.
          </li>
          <li>
            <span className="font-medium text-slate-100">Cards</span>: who each card number is, from cards you save and
            checklist searches.
          </li>
        </ul>
      </section>

      <PrepareSets sets={sets} />

      <FetchStatus fetches={fetches} />

      <section className={`${panel} flex flex-col gap-3 p-4`}>
        <h2 className="text-lg font-semibold">Known sets</h2>
        {sets.length > 6 && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sets"
            aria-label="Search sets"
            className={inputClass}
          />
        )}
        {shown.length === 0 ? (
          <p className="text-sm text-slate-400">
            {sets.length ? 'No set matches.' : 'Nothing yet. Save cards or look up a set’s parallels above.'}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-800">
            {shown.map((s) => (
              <SetRow key={s.key} set={s} />
            ))}
          </ul>
        )}
      </section>

      <ImportParallels />
    </main>
  )
}

function SetRow({ set }: { set: SetSummary & { fetch: ParallelFetch | null } }) {
  const status =
    set.fetch?.status === 'pending'
      ? 'Looking up…'
      : set.hasList
        ? null
        : set.parallels
          ? 'Partial list'
          : 'No parallel list'
  return (
    <li>
      <Link to={setPath(set)} className="flex min-h-14 items-center justify-between gap-3 py-2 active:bg-slate-900">
        <div className="min-w-0">
          <p className="truncate font-medium">{label(set)}</p>
          <p className="text-xs text-slate-400">
            {plural(set.parallels, 'parallel')} · {plural(set.cards, 'card')}
            {status && <span className="text-amber-300"> · {status}</span>}
          </p>
        </div>
        <Icon name="back" size={18} className="shrink-0 rotate-180 text-slate-500" />
      </Link>
    </li>
  )
}

/** Look up parallel lists ahead of scanning: typed sets, or the collection's sets that have none. */
function PrepareSets({ sets }: { sets: (SetSummary & { fetch: ParallelFetch | null })[] }) {
  const { data: cards = NO_CARDS } = useCards()
  const ai = useAiApproval()
  const fetchParallels = useFetchParallels()
  const [text, setText] = useState('')
  const model = getAiModel()

  const ready = (s: SetRef) => sets.some((k) => sameSet(k, s) && (k.hasList || k.fetch?.status === 'pending'))
  const { sets: typed, bad } = parseSetLines(text)
  const todo = typed.filter((s) => !ready(s))
  const fromCards = useMemo(() => {
    const seen = new Map<string, SetRef>()
    for (const c of cards) if (!seen.has(setKey(c))) seen.set(setKey(c), { year: c.year, set_name: c.set_name })
    return [...seen.values()]
  }, [cards])
  const missing = fromCards.filter((s) => !ready(s))
  const estimate = ai.estimate.parallels(todo.length, model)

  async function lookUp() {
    const ok = await ai.approve(parallelsRequest(todo.map(label), model, estimate, false))
    if (!ok) return
    fetchParallels.mutate({ sets: todo, model, now: false }, { onSuccess: () => setText('') })
  }

  return (
    <section className={`${panel} flex flex-col gap-3 p-4`}>
      <div>
        <h2 className="text-lg font-semibold">Get sets ready</h2>
        <p className="text-sm text-slate-400">
          List the sets you’re about to scan or enter, one per line. Each set’s parallels are looked up once (about{' '}
          {formatCost(ai.estimate.parallels(1, model).expected)} a set) and kept.
        </p>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={'2011 Bowman Chrome Draft\n2023 Topps Finest'}
        aria-label="Sets to look up, one per line"
        className={`${inputClass} py-2`}
      />
      {missing.length > 0 && (
        <button
          type="button"
          onClick={() => setText([...new Set([...text.split('\n').filter((l) => l.trim()), ...missing.map(label)])].join('\n'))}
          className="self-start text-sm text-sky-400 underline"
        >
          Add the {plural(missing.length, 'set')} from your cards without a list
        </button>
      )}
      {bad.length > 0 && (
        <p className="text-xs text-amber-300">Start each line with the year: {bad.slice(0, 3).join('; ')}</p>
      )}
      {typed.length > todo.length && (
        <p className="text-xs text-slate-500">
          {plural(typed.length - todo.length, 'set')} already {typed.length - todo.length === 1 ? 'has' : 'have'} a list.
        </p>
      )}
      {fetchParallels.error && (
        <p className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">{fetchParallels.error.message}</p>
      )}
      <button
        type="button"
        disabled={todo.length === 0 || fetchParallels.isPending}
        onClick={() => void lookUp()}
        className={`${buttonPrimary} min-h-12`}
      >
        {fetchParallels.isPending
          ? 'Sending…'
          : todo.length
            ? `Look up parallels for ${plural(todo.length, 'set')} (~${formatCost(estimate.expected)})`
            : 'Look up parallels'}
      </button>
      {ai.dialog}
    </section>
  )
}

function FetchStatus({ fetches }: { fetches: ParallelFetch[] }) {
  const forget = useForgetFetch()
  const pending = fetches.filter((f) => f.status === 'pending')
  const problems = fetches.filter((f) => f.status === 'failed' || (f.status === 'done' && !f.found))
  if (!pending.length && !problems.length) return null
  return (
    <section className={`${panel} flex flex-col gap-2 p-4 text-sm`}>
      {pending.length > 0 && (
        <p className="text-slate-300">
          Looking up {plural(pending.length, 'set')}. Results usually arrive within minutes; this page updates on its
          own.
        </p>
      )}
      {problems.map((f) => (
        <div key={f.id} className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-amber-300">
            {label(f)}: {f.error ?? (f.notes || 'no parallel list found.')}
          </p>
          <button
            type="button"
            onClick={() => forget.mutate(f.id)}
            className="min-h-11 shrink-0 px-2 font-medium text-slate-300"
          >
            Dismiss
          </button>
        </div>
      ))}
    </section>
  )
}

/** Parallel lists from a CSV (yours, or one researched for you), saved as entered by hand. */
function ImportParallels() {
  const save = useSaveParallels()
  const [result, setResult] = useState<{ saved: number; errors: string[] } | null>(null)

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const { rows, errors } = parseParallelsCsv(await file.text())
    if (rows.length) await save.mutateAsync(rows).catch(() => undefined)
    setResult({ saved: rows.length, errors })
  }

  return (
    <section className={`${panel} flex flex-col gap-3 p-4`}>
      <div>
        <h2 className="text-lg font-semibold">Import parallels</h2>
        <p className="text-sm text-slate-400">
          Free alternative to looking sets up: a CSV with columns year, set, insert, parallel, print_run (blank when not
          numbered).
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className={`${buttonSecondary} cursor-pointer`}>
          <Icon name="upload" size={18} /> Choose CSV file…
          <input type="file" accept=".csv,text/csv" onChange={handleFile} className="sr-only" />
        </label>
        <button
          type="button"
          onClick={() => downloadFile('parallels-template.csv', parallelsTemplate())}
          className={buttonSecondary}
        >
          <Icon name="download" size={18} /> Template
        </button>
      </div>
      {save.error && <p className="text-sm text-red-300">{save.error.message}</p>}
      {result && !save.error && (
        <div className="text-sm">
          <p className="text-emerald-300">Saved {plural(result.saved, 'parallel')}.</p>
          {result.errors.slice(0, 5).map((err) => (
            <p key={err} className="text-amber-300">
              {err}
            </p>
          ))}
        </div>
      )}
    </section>
  )
}
