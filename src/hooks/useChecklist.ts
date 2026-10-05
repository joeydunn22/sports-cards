import { useQuery } from '@tanstack/react-query'
import { IS_DEMO } from '../dev/demo'
import { supabase } from '../lib/supabase'

export type ChecklistEntry = {
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
 * The self-building checklist cache: one row per checklist spot, from saved cards (database trigger)
 * and from AI checklist searches that settled a card (scan-cards function).
 */
export function useChecklist() {
  return useQuery({
    queryKey: ['checklist'],
    queryFn: async (): Promise<ChecklistEntry[]> => {
      if (IS_DEMO) return NO_ENTRIES
      const { data, error } = await supabase
        .from('checklist_entries')
        .select('year, set_name, insert_name, card_number, player, team, sport, is_rookie, source')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data
    },
    staleTime: 60_000,
  })
}
