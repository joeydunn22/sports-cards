import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { demoParallels, IS_DEMO } from '../dev/demo'
import { supabase } from '../lib/supabase'
import type { SetParallel } from '../features/cards/parallels'
import { AI_USAGE_KEY } from './useAiSpend'
import { setKey, setReady, type SetRef } from '../features/sets/setIndex'
import { KNOWN_SETS_KEY } from './useKnownSets'
import { callScanFunction } from './useScans'

export type ParallelRow = SetParallel & { id: string; source_url: string | null }
export type ParallelFetch = {
  id: string
  year: string
  set_name: string
  status: 'pending' | 'done' | 'failed'
  found: number | null
  notes: string | null
  error: string | null
  updated_at: string
}
export type { SetRef }
export type ParallelInput = SetRef & { insert_name: string; parallel: string; print_run: number | null }

export const SET_PARALLELS_KEY = ['set-parallels'] as const
const FETCHES_KEY = ['parallel-fetches'] as const
export const NO_PARALLELS: ParallelRow[] = []
export const NO_FETCHES: ParallelFetch[] = []

const parallelsQuery = (set: SetRef) => ({
  queryKey: [...SET_PARALLELS_KEY, setKey(set)],
  queryFn: async (): Promise<ParallelRow[]> => {
    if (IS_DEMO) return demoParallels.filter((p) => setKey(p) === setKey(set))
    const { data, error } = await supabase
      .from('set_parallels')
      .select('id, year, set_name, insert_name, parallel, print_run, source, source_url')
      .eq('set_key', setKey(set))
    if (error) throw error
    return data
  },
  staleTime: 60_000,
})

/**
 * One set's parallels (public.set_parallels), every insert: from saved cards, Baseball Cardpedia, AI
 * searches, and the Sets page. A few hundred at most, so one request. Nothing until a set is given.
 */
export function useSetParallels(set: SetRef | null) {
  const ready = set && setReady(set)
  return useQuery({ ...parallelsQuery(ready ? set : { year: '', set_name: '' }), enabled: Boolean(ready) })
}

/** The same list, loaded now (or from the cache), for a form field that's being left. */
export function loadSetParallels(queryClient: QueryClient, set: SetRef): Promise<ParallelRow[]> {
  return setReady(set) ? queryClient.fetchQuery(parallelsQuery(set)) : Promise.resolve(NO_PARALLELS)
}

/** Everything that shows a set's parallels or the list of sets. */
export function invalidateParallels(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: SET_PARALLELS_KEY })
  void queryClient.invalidateQueries({ queryKey: KNOWN_SETS_KEY })
}

/** How often to ask whether batched parallel-list searches have finished. */
const POLL_MS = 20_000

/** AI fetches of sets' parallel lists. While any is pending, asks the function to collect results. */
export function useParallelFetches() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: FETCHES_KEY,
    queryFn: async (): Promise<ParallelFetch[]> => {
      if (IS_DEMO) return NO_FETCHES
      const { data, error } = await supabase
        .from('parallel_fetches')
        .select('id, year, set_name, status, found, notes, error, updated_at')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data as ParallelFetch[]
    },
  })
  const pending = query.data?.some((f) => f.status === 'pending') ?? false
  useEffect(() => {
    if (!pending) return
    const timer = window.setInterval(async () => {
      try {
        const { updated } = await callScanFunction<{ updated: number }>({ action: 'poll_parallels' })
        if (updated) {
          invalidateParallels(queryClient)
          void queryClient.invalidateQueries({ queryKey: AI_USAGE_KEY })
        }
      } catch {
        // The next tick tries again.
      } finally {
        void queryClient.invalidateQueries({ queryKey: FETCHES_KEY })
      }
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [pending, queryClient])
  return query
}

type FetchResult = { submitted: number; results: (SetRef & { found: number; notes?: string; error?: string })[] }

/**
 * Asks the AI for sets' parallel lists. `now` waits for the answer (the card form) and resolves with the
 * first set's fresh list; otherwise they go out as a half-price batch and arrive within minutes.
 */
export function useFetchParallels() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ sets, model, now }: { sets: SetRef[]; model: string; now: boolean }) => {
      const result = await callScanFunction<FetchResult>({ action: 'parallels', sets, model, now })
      if (!now) return { ...result, list: null }
      await queryClient.invalidateQueries({ queryKey: SET_PARALLELS_KEY })
      return { ...result, list: await loadSetParallels(queryClient, sets[0]) }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: FETCHES_KEY })
      void queryClient.invalidateQueries({ queryKey: KNOWN_SETS_KEY })
      void queryClient.invalidateQueries({ queryKey: AI_USAGE_KEY })
    },
  })
}

/** Adds or corrects parallels by hand (or from a CSV). Hand-entered rows are never overwritten automatically. */
export function useSaveParallels() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (rows: ParallelInput[]) => {
      const { error } = await supabase
        .from('set_parallels')
        .upsert(
          rows.map((r) => ({ ...r, source: 'manual', source_url: null })),
          { onConflict: 'user_id,parallel_key' },
        )
      if (error) throw error
    },
    onSettled: () => invalidateParallels(queryClient),
  })
}

/** Edits one parallel in place (a rename changes its key, so it's an update by id, not an upsert). */
export function useUpdateParallel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, parallel, print_run }: { id: string; parallel: string; print_run: number | null }) => {
      const { error } = await supabase
        .from('set_parallels')
        .update({ parallel, print_run, source: 'manual', source_url: null })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: ({ id, parallel, print_run }) => {
      queryClient.setQueriesData<ParallelRow[]>({ queryKey: SET_PARALLELS_KEY }, (old) =>
        old?.map((p) => (p.id === id ? { ...p, parallel, print_run, source: 'manual' } : p)),
      )
    },
    onSettled: () => invalidateParallels(queryClient),
  })
}

export function useDeleteParallel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('set_parallels').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: (id) => {
      queryClient.setQueriesData<ParallelRow[]>({ queryKey: SET_PARALLELS_KEY }, (old) => old?.filter((p) => p.id !== id))
    },
    onSettled: () => invalidateParallels(queryClient),
  })
}

/** Forgets a set's fetch, so its list can be looked up again (its parallels stay until deleted). */
export function useForgetFetch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('parallel_fetches').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: FETCHES_KEY }),
  })
}
