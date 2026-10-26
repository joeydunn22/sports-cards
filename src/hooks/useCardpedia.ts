import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'
import { IS_DEMO } from '../dev/demo'
import { supabase } from '../lib/supabase'
import { setKey, type SetRef } from '../features/sets/setIndex'
import { invalidateChecklist } from './useChecklist'
import { callScanFunction } from './useScans'
import { invalidateParallels } from './useSetParallels'

/** A set looked for on Baseball Cardpedia (public.cardpedia_imports): the page used and what it gave. */
export type CardpediaImport = SetRef & {
  id: string
  status: 'done' | 'not_found' | 'failed'
  page: string | null
  parallels: number
  cards: number
  error: string | null
  updated_at: string
}
export type ImportResult = Omit<CardpediaImport, 'id' | 'updated_at'>
/** A set to look for, optionally on a page named by hand when its name doesn't match. */
export type ImportRequest = SetRef & { page?: string }

const IMPORTS_KEY = ['cardpedia-imports'] as const
export const NO_IMPORTS: CardpediaImport[] = []
/** Sets per call to the function, so each answers well within its time limit. */
const PER_CALL = 8

const importsQuery = {
  queryKey: IMPORTS_KEY,
  queryFn: async (): Promise<CardpediaImport[]> => {
    if (IS_DEMO) return NO_IMPORTS
    const { data, error } = await supabase
      .from('cardpedia_imports')
      .select('id, year, set_name, status, page, parallels, cards, error, updated_at')
      .order('updated_at', { ascending: false })
    if (error) throw error
    return data as CardpediaImport[]
  },
  staleTime: 60_000,
}

/** Every set looked for on Baseball Cardpedia. */
export function useCardpediaImports() {
  return useQuery(importsQuery)
}

async function runImports(queryClient: QueryClient, sets: ImportRequest[], again: boolean): Promise<ImportResult[]> {
  const results: ImportResult[] = []
  try {
    for (let i = 0; i < sets.length; i += PER_CALL) {
      const { results: some } = await callScanFunction<{ results: ImportResult[] }>({
        action: 'cardpedia',
        sets: sets.slice(i, i + PER_CALL),
        again,
      })
      results.push(...some)
    }
  } finally {
    invalidateParallels(queryClient)
    invalidateChecklist(queryClient)
    void queryClient.invalidateQueries({ queryKey: IMPORTS_KEY })
  }
  return results
}

/**
 * Reads sets' pages from Baseball Cardpedia into the card database: free, no AI. Sets looked for before
 * are skipped unless `again`, or a page is named for them.
 */
export function useImportFromCardpedia() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sets, again = false }: { sets: ImportRequest[]; again?: boolean }) =>
      runImports(queryClient, sets, again),
  })
}

/**
 * For the card form: looks a baseball set up on Cardpedia the first time it's entered, so its parallels
 * and checklist can fill the form. Resolves with the result, or null when it was looked for before; a
 * call that fails (offline, say) resolves as `failed` without being recorded, so it is tried again.
 */
export function useEnsureCardpedia() {
  const queryClient = useQueryClient()
  const running = useRef(new Map<string, Promise<ImportResult | null>>())
  return useCallback(
    (set: SetRef): Promise<ImportResult | null> => {
      if (IS_DEMO) return Promise.resolve(null)
      const key = setKey(set)
      let found = running.current.get(key)
      if (!found) {
        found = queryClient
          .fetchQuery(importsQuery)
          .then((imports) =>
            imports.some((i) => setKey(i) === key)
              ? null
              : runImports(queryClient, [set], false).then((results) => results[0] ?? null),
          )
          // A failure (offline, say) shouldn't block the form, but it says so; it's tried again next time.
          .catch((err: unknown): ImportResult => {
            running.current.delete(key)
            return {
              year: set.year,
              set_name: set.set_name,
              status: 'failed',
              page: null,
              parallels: 0,
              cards: 0,
              error: err instanceof Error ? err.message : 'no connection',
            }
          })
        running.current.set(key, found)
      }
      return found
    },
    [queryClient],
  )
}
