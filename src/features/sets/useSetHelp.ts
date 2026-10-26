import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { NO_IMPORTS, useCardpediaImports, useEnsureCardpedia } from '../../hooks/useCardpedia'
import { loadChecklist } from '../../hooks/useChecklist'
import { loadSetParallels, NO_PARALLELS, useSetParallels } from '../../hooks/useSetParallels'
import type { Spot } from '../cards/autofill'
import type { SetParallel } from '../cards/parallels'
import { isBaseball, sameSet, setReady, type SetRef } from './setIndex'

export type SetOnForm = SetRef & { sport: string }

/** What the card form knows about the set being entered: its parallel list and checklist. */
export type SetHelp = {
  /** The current set's parallels, for hints while typing. */
  parallels: SetParallel[]
  /** Loading the set's parallels, or looking it up on Cardpedia: don't offer a paid lookup yet. */
  busy: boolean
  /** The form's set changed: show its parallels, and look a new baseball set up on Cardpedia. */
  onSetChange: (set: SetOnForm) => void
  /** The set's parallels and checklist, loaded now (after the Cardpedia lookup for a new baseball set). */
  load: (set: SetOnForm) => Promise<{ parallels: SetParallel[]; spots: Spot[] }>
  /** What the Cardpedia lookup is doing or found. */
  note: string | null
}

const label = (s: SetRef) => `${s.year.trim()} ${s.set_name.trim()}`

/** For the card form's `setHelp` (Add card, Edit card, scan review). */
export function useSetHelp(): SetHelp {
  const queryClient = useQueryClient()
  const ensure = useEnsureCardpedia()
  const { data: imports = NO_IMPORTS } = useCardpediaImports()
  const [set, setSet] = useState<SetRef | null>(null)
  const [looking, setLooking] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const { data: parallels = NO_PARALLELS, isPending } = useSetParallels(set)

  // Free: a baseball set never looked for gets its Cardpedia page before anything is filled from it.
  const lookUp = useCallback(
    async (s: SetOnForm) => {
      if (!isBaseball(s.sport) || !setReady(s)) return
      const fresh = !imports.some((i) => sameSet(i, s))
      if (fresh) {
        setLooking(true)
        setNote(`Looking up ${label(s)} on Baseball Cardpedia (free)…`)
      }
      try {
        const result = await ensure(s)
        if (!result) {
          if (fresh) setNote(null)
        } else if (result.status === 'done') {
          setNote(`Got ${label(s)} from Baseball Cardpedia: ${result.parallels} parallels, ${result.cards} cards.`)
        } else if (result.status === 'not_found') {
          setNote(`${label(s)} isn’t on Baseball Cardpedia under that name. The Sets page can point it at the right page.`)
        } else {
          setNote(`Couldn’t read Baseball Cardpedia (${result.error}).`)
        }
      } finally {
        if (fresh) setLooking(false)
      }
    },
    [ensure, imports],
  )

  const onSetChange = useCallback(
    (s: SetOnForm) => {
      setSet(setReady(s) ? { year: s.year.trim(), set_name: s.set_name.trim() } : null)
      setNote(null)
      void lookUp(s)
    },
    [lookUp],
  )

  const load = useCallback(
    async (s: SetOnForm) => {
      await lookUp(s)
      const [list, spots] = await Promise.all([loadSetParallels(queryClient, s), loadChecklist(queryClient, s)])
      return { parallels: list, spots }
    },
    [lookUp, queryClient],
  )

  return { parallels, busy: looking || (set != null && isPending), onSetChange, load, note }
}
