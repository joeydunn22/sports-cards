import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IS_DEMO } from '../dev/demo'
import { supabase } from '../lib/supabase'
import type { UsageEntry } from '../features/ai/costEstimate'

export type AppSettings = {
  confirm_ai_runs: boolean
  auto_lookup: boolean
  credit_dollars: number | null
  credit_set_at: string | null
}

/** Same as the app_settings column defaults, for before the row exists. */
export const DEFAULT_SETTINGS: AppSettings = {
  confirm_ai_runs: true,
  auto_lookup: true,
  credit_dollars: null,
  credit_set_at: null,
}

const SETTINGS_KEY = ['app-settings'] as const
export const AI_USAGE_KEY = ['ai-usage'] as const
export const NO_USAGE: UsageEntry[] = []

export function useAppSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async (): Promise<AppSettings> => {
      if (IS_DEMO) return DEFAULT_SETTINGS
      const { data, error } = await supabase
        .from('app_settings')
        .select('confirm_ai_runs, auto_lookup, credit_dollars, credit_set_at')
        .maybeSingle()
      if (error) throw error
      return data ?? DEFAULT_SETTINGS
    },
  })
}

export function useSaveSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (changes: Partial<AppSettings>) => {
      const current = queryClient.getQueryData<AppSettings>(SETTINGS_KEY) ?? DEFAULT_SETTINGS
      const { error } = await supabase.from('app_settings').upsert({ ...current, ...changes })
      if (error) throw error
    },
    onMutate: (changes) => {
      queryClient.setQueryData<AppSettings>(SETTINGS_KEY, (old) => ({ ...(old ?? DEFAULT_SETTINGS), ...changes }))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
  })
}

/** The spending log, written by the scan-cards function with each call's actual cost. */
export function useAiUsage() {
  return useQuery({
    queryKey: AI_USAGE_KEY,
    queryFn: async (): Promise<UsageEntry[]> => {
      if (IS_DEMO) return NO_USAGE
      const { data, error } = await supabase
        .from('ai_usage')
        .select('kind, model, cards, dollars, created_at')
        .order('created_at')
      if (error) throw error
      return data
    },
    staleTime: 30_000,
  })
}
