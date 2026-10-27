import { useMemo } from 'react'
import { buttonPrimary, panel } from '../../components/ui'
import { NO_CARDS, useCards, useRenameTeams } from '../../hooks/useCards'
import { teamFixes } from '../cards/teams'

/** Saved cards with a short or odd team name ("Reds"), fixed in one tap. Hidden when there are none. */
export function TeamNames() {
  const { data } = useCards()
  const fixes = useMemo(() => teamFixes(data ?? NO_CARDS), [data])
  const rename = useRenameTeams()
  if (!fixes.length) return null
  const count = fixes.reduce((n, f) => n + f.ids.length, 0)

  function fixAll() {
    if (!window.confirm(`Change the team on ${count} ${count === 1 ? 'card' : 'cards'}?`)) return
    rename.mutate(fixes)
  }

  return (
    <section className={`${panel} flex flex-col gap-3 p-4`}>
      <div>
        <h2 className="text-lg font-semibold">Team names</h2>
        <p className="text-sm text-ink-400">
          Short or old-style team names, spelled out so each team filters as one.
        </p>
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {fixes.map((fix) => (
          <li key={`${fix.from}\n${fix.to}`} className="flex flex-wrap gap-x-2">
            <span className="text-ink-400">{fix.from}</span>
            <span aria-hidden="true">→</span>
            <span className="font-medium">{fix.to}</span>
            <span className="text-ink-500">
              {fix.ids.length} {fix.ids.length === 1 ? 'card' : 'cards'}
            </span>
          </li>
        ))}
      </ul>
      {rename.error && <p className="text-sm text-red-400">{rename.error.message}</p>}
      <button type="button" onClick={fixAll} disabled={rename.isPending} className={buttonPrimary}>
        {rename.isPending ? 'Fixing…' : `Fix ${count} ${count === 1 ? 'card' : 'cards'}`}
      </button>
    </section>
  )
}
