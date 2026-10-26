import { useQuery } from '@tanstack/react-query'
import { demoChecklist, demoParallels, IS_DEMO } from '../dev/demo'
import { supabase } from '../lib/supabase'
import { setKey, type SetRef } from '../features/sets/setIndex'

export type KnownSet = SetRef & { set_key: string; parallels: number; cards: number; has_list: boolean }

export const KNOWN_SETS_KEY = ['known-sets'] as const
export const NO_KNOWN_SETS: KnownSet[] = []

function demoSets(): KnownSet[] {
  const sets = new Map<string, KnownSet>()
  for (const p of demoParallels) {
    const set = sets.get(setKey(p)) ?? { ...p, set_key: setKey(p), parallels: 0, cards: 0, has_list: false }
    set.parallels++
    set.has_list ||= p.source !== 'collection'
    sets.set(set.set_key, set)
  }
  for (const e of demoChecklist) {
    const set = sets.get(setKey(e)) ?? { ...e, set_key: setKey(e), parallels: 0, cards: 0, has_list: false }
    set.cards++
    sets.set(set.set_key, set)
  }
  return [...sets.values()]
}

/** Every set the card database knows, with how many parallels and checklist spots (public.known_sets). */
export function useKnownSets() {
  return useQuery({
    queryKey: KNOWN_SETS_KEY,
    queryFn: async (): Promise<KnownSet[]> => {
      if (IS_DEMO) return demoSets()
      const { data, error } = await supabase
        .from('known_sets')
        .select('set_key, year, set_name, parallels, cards, has_list')
      if (error) throw error
      return data as KnownSet[]
    },
    staleTime: 60_000,
  })
}
