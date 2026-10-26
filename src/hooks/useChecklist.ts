import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { IS_DEMO } from '../dev/demo'
import { supabase } from '../lib/supabase'
import { setKey, setReady, type SetRef } from '../features/sets/setIndex'
import { KNOWN_SETS_KEY } from './useKnownSets'

export type ChecklistEntry = {
  id: string
  year: string
  set_name: string
  insert_name: string
  card_number: string
  player: string
  team: string | null
  sport: string | null
  is_rookie: boolean
  source: string
}

export const NO_ENTRIES: ChecklistEntry[] = []

/**
 * The card database's checklist: one row per checklist spot, from saved cards (database trigger), AI
 * checklist searches that settled a card, and Baseball Cardpedia (scan-cards function). A set can have
 * thousands, so it's loaded a set at a time.
 */
const CHECKLIST_KEY = ['checklist'] as const
/** Supabase caps a single response at 1,000 rows, so fetch in pages. */
const PAGE_SIZE = 1000

const checklistQuery = (set: SetRef) => ({
  queryKey: [...CHECKLIST_KEY, setKey(set)],
  queryFn: async (): Promise<ChecklistEntry[]> => {
    if (IS_DEMO) return NO_ENTRIES
    const all: ChecklistEntry[] = []
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('checklist_entries')
        .select('id, year, set_name, insert_name, card_number, player, team, sport, is_rookie, source')
        .eq('set_key', setKey(set))
        .order('id')
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      all.push(...data)
      if (data.length < PAGE_SIZE) return all
    }
  },
  staleTime: 60_000,
})

/** One set's checklist spots; nothing until a set is given. */
export function useChecklist(set: SetRef | null) {
  const ready = set && setReady(set)
  return useQuery({ ...checklistQuery(ready ? set : { year: '', set_name: '' }), enabled: Boolean(ready) })
}

/** The same, loaded now (or from the cache), for the card form's free fill-in. */
export function loadChecklist(queryClient: QueryClient, set: SetRef): Promise<ChecklistEntry[]> {
  return setReady(set) ? queryClient.fetchQuery(checklistQuery(set)) : Promise.resolve(NO_ENTRIES)
}

export function invalidateChecklist(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: CHECKLIST_KEY })
  void queryClient.invalidateQueries({ queryKey: KNOWN_SETS_KEY })
}

/** Removes a wrong spot (say, from a mistaken search). One from a saved card comes back while that card exists. */
export function useDeleteChecklistEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('checklist_entries').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: (id) => {
      queryClient.setQueriesData<ChecklistEntry[]>({ queryKey: CHECKLIST_KEY }, (old) => old?.filter((e) => e.id !== id))
    },
    onSettled: () => invalidateChecklist(queryClient),
  })
}
