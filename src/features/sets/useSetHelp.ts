import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { NO_IMPORTS, useCardpediaImports, useEnsureCardpedia, type ImportResult } from '../../hooks/useCardpedia'
import { loadChecklist, NO_ENTRIES, useChecklist } from '../../hooks/useChecklist'
import { loadSetParallels, NO_PARALLELS, useSetParallels } from '../../hooks/useSetParallels'
import type { Spot } from '../cards/autofill'
import { hasParallelList, type SetParallel } from '../cards/parallels'
import { isBaseball, sameSet, setReady, type SetRef } from './setIndex'

export type SetOnForm = SetRef & { sport: string }

/** One line under the Set fields: what the form knows about the set, or what it's doing to find out. */
export type SetStatus = {
  kind: 'looking' | 'known' | 'empty' | 'not_found' | 'failed'
  text: string
}

/** What the card form knows about the set being entered: its parallel list and checklist. */
export type SetHelp = {
  /** The current set's parallels, for hints while typing. */
  parallels: SetParallel[]
  /** The current set's checklist spots, for player suggestions and Card #. */
  spots: Spot[]
  /** Loading the set's parallels, or looking it up on Cardpedia: don't offer a paid lookup yet. */
  busy: boolean
  /** The form's set changed: show its parallels, and look a new baseball set up on Cardpedia. */
  onSetChange: (set: SetOnForm) => void
  /** The set's parallels and checklist, loaded now (after the Cardpedia lookup for a new baseball set). */
  load: (set: SetOnForm) => Promise<{ parallels: SetParallel[]; spots: Spot[] }>
  /** Null until a year and set are entered. */
  status: SetStatus | null
}

const label = (s: SetRef) => `${s.year.trim()} ${s.set_name.trim()}`
const count = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`

/** For the card form's `setHelp` (Add card, Edit card, scan Review). */
export function useSetHelp(): SetHelp {
  const queryClient = useQueryClient()
  const ensure = useEnsureCardpedia()
  const { data: imports = NO_IMPORTS } = useCardpediaImports()
  const [set, setSet] = useState<SetOnForm | null>(null)
  const [looking, setLooking] = useState(false)
  // The last lookup's answer, kept to explain a set Cardpedia couldn't give (failures aren't recorded).
  const [result, setResult] = useState<ImportResult | null>(null)
  const { data: parallels = NO_PARALLELS, isPending } = useSetParallels(set)
  const { data: spots = NO_ENTRIES, isPending: spotsPending } = useChecklist(set)

  // Free: a baseball set never looked for gets its Cardpedia page before anything is filled from it.
  const lookUp = useCallback(
    async (s: SetOnForm) => {
      if (!isBaseball(s.sport) || !setReady(s)) return
      const fresh = !imports.some((i) => sameSet(i, s))
      if (fresh) setLooking(true)
      try {
        const found = await ensure(s)
        if (found) setResult(found)
      } finally {
        if (fresh) setLooking(false)
      }
    },
    [ensure, imports],
  )

  const onSetChange = useCallback(
    (s: SetOnForm) => {
      setSet(setReady(s) ? { year: s.year.trim(), set_name: s.set_name.trim(), sport: s.sport } : null)
      void lookUp(s)
    },
    [lookUp],
  )

  const load = useCallback(
    async (s: SetOnForm) => {
      await lookUp(s)
      const [list, entries] = await Promise.all([loadSetParallels(queryClient, s), loadChecklist(queryClient, s)])
      return { parallels: list, spots: entries }
    },
    [lookUp, queryClient],
  )

  const loading = set != null && (isPending || spotsPending)
  return {
    parallels,
    spots,
    busy: looking || loading,
    onSetChange,
    load,
    status: set && statusFor(set, { looking, loading, parallels, spots, imports, result }),
  }
}

function statusFor(
  set: SetOnForm,
  known: {
    looking: boolean
    loading: boolean
    parallels: SetParallel[]
    spots: Spot[]
    imports: { year: string; set_name: string; status: string; page: string | null }[]
    result: ImportResult | null
  },
): SetStatus {
  const name = label(set)
  if (known.looking) return { kind: 'looking', text: `Looking up ${name} on Baseball Cardpedia (free)…` }
  if (known.loading) return { kind: 'looking', text: `Loading ${name}…` }
  const failed = known.result && sameSet(known.result, set) && known.result.status === 'failed' ? known.result : null
  const imported = known.imports.find((i) => sameSet(i, set))
  const lists = hasParallelList(known.parallels, set.year, set.set_name)
  if (known.parallels.length || known.spots.length) {
    const source = imported?.status === 'done' ? ' · Baseball Cardpedia' : lists ? '' : ' · from your cards'
    return {
      kind: 'known',
      text: `${name}: ${count(known.parallels.length, 'parallel')} · ${count(known.spots.length, 'card')}${source}`,
    }
  }
  if (failed) return { kind: 'failed', text: `Couldn’t reach Baseball Cardpedia (${failed.error}). It tries again next time.` }
  if (imported?.status === 'not_found') {
    return {
      kind: 'not_found',
      text: `${name} isn’t on Baseball Cardpedia under that name. The Sets page can point it at the right page.`,
    }
  }
  return {
    kind: 'empty',
    text: isBaseball(set.sport)
      ? `Nothing known about ${name} yet.`
      : `Nothing known about ${name} yet. Its parallels and checklist build up as you save cards.`,
  }
}
