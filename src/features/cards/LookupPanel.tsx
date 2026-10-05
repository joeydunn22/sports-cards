import { buttonSecondary } from '../../components/ui'
import { formatCost } from '../ai/costEstimate'
import { fieldName, type LookupMerge } from './autofill'
import type { CardFormValues } from './cardSchema'

/** What an AI lookup returned; null when it was cancelled at the cost prompt. */
export type LookupOutcome = {
  found?: CardFormValues
  uncertain?: string[]
  notes?: string
  sources?: { url: string; title?: string }[]
  dollars?: number
  error?: string
} | null

type Props = {
  costLabel: string
  canRun: boolean
  busy: boolean
  result: { outcome: LookupOutcome; merge: LookupMerge | null } | null
  onRun: () => void
  onUse: (field: keyof CardFormValues, value: string) => void
}

/** "Look up details" on the card form, and what the lookup filled in or disagreed with. */
export function LookupPanel({ costLabel, canRun, busy, result, onRun, onUse }: Props) {
  const outcome = result?.outcome
  const merge = result?.merge
  return (
    <div className="mt-3 flex flex-col gap-2">
      <button type="button" disabled={!canRun || busy} onClick={onRun} className={`${buttonSecondary} min-h-11 text-sm`}>
        {busy ? 'Searching the checklist… (up to a minute)' : `Look up details with AI · ~${costLabel}`}
      </button>
      {!canRun && !result && (
        <p className="text-xs text-slate-500">Enter the player and the set or card # to look up the rest.</p>
      )}
      {outcome?.error && <p className="rounded-xl bg-amber-950/60 px-3 py-2 text-sm text-amber-200">{outcome.error}</p>}
      {merge && (
        <div className="flex flex-col gap-1 rounded-xl border border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-sm text-slate-300">
          <p className="font-medium text-emerald-200">
            {merge.filled.length
              ? `Filled ${merge.filled.map(fieldName).join(', ')}`
              : 'Nothing new to fill in'}
            {outcome?.dollars != null && <span className="font-normal text-slate-400"> · cost {formatCost(outcome.dollars)}</span>}
          </p>
          {merge.conflicts.map(({ field, found }) => (
            <p key={field} className="flex flex-wrap items-center gap-x-2 text-amber-200">
              The checklist says {fieldName(field)} “{found}”.
              <button
                type="button"
                onClick={() => onUse(field as keyof CardFormValues, found)}
                className="min-h-11 font-medium text-sky-400"
              >
                Use it
              </button>
            </p>
          ))}
          {outcome?.uncertain && outcome.uncertain.length > 0 && (
            <p className="text-amber-200">Couldn’t confirm: {outcome.uncertain.map(fieldName).join(', ')}.</p>
          )}
          {outcome?.notes && <p>{outcome.notes}</p>}
          {outcome?.sources?.map((source) => (
            <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="truncate text-sky-400 underline">
              {source.title || source.url}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
