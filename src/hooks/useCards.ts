import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Card, CardInput } from '../types/card'

const CARDS_KEY = ['cards'] as const
/** Stable fallback while loading, so memoized derivations don't recompute every render. */
export const NO_CARDS: Card[] = []
/** Supabase caps a single response at 1,000 rows, so fetch in pages. */
const PAGE_SIZE = 1000

async function fetchAllCards(): Promise<Card[]> {
  const all: Card[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    all.push(...data)
    if (data.length < PAGE_SIZE) return all
  }
}

/** The whole collection, loaded once and filtered/sorted on the client (fine for a few thousand cards). */
export function useCards() {
  return useQuery({ queryKey: CARDS_KEY, queryFn: fetchAllCards, staleTime: 60_000 })
}

export function useCreateCard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CardInput) => {
      const { data, error } = await supabase.from('cards').insert(input).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (card) => {
      queryClient.setQueryData<Card[]>(CARDS_KEY, (old) => (old ? [card, ...old] : old))
    },
  })
}

type Snapshot = { previous: Card[] | undefined }

export function useUpdateCard() {
  const queryClient = useQueryClient()
  return useMutation<Card, Error, { id: string; input: CardInput }, Snapshot>({
    mutationFn: async ({ id, input }) => {
      const { data, error } = await supabase.from('cards').update(input).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: CARDS_KEY })
      const previous = queryClient.getQueryData<Card[]>(CARDS_KEY)
      queryClient.setQueryData<Card[]>(CARDS_KEY, (old) =>
        old?.map((card) => (card.id === id ? { ...card, ...input } : card)),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(CARDS_KEY, context?.previous)
    },
    onSuccess: (card) => {
      queryClient.setQueryData<Card[]>(CARDS_KEY, (old) => old?.map((c) => (c.id === card.id ? card : c)))
    },
  })
}

export function useDeleteCard() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, string, Snapshot>({
    mutationFn: async (id) => {
      const { error } = await supabase.from('cards').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: CARDS_KEY })
      const previous = queryClient.getQueryData<Card[]>(CARDS_KEY)
      queryClient.setQueryData<Card[]>(CARDS_KEY, (old) => old?.filter((card) => card.id !== id))
      return { previous }
    },
    onError: (_err, _id, context) => {
      queryClient.setQueryData(CARDS_KEY, context?.previous)
    },
  })
}

const IMPORT_CHUNK = 500

/** Rows with an id update that card (or create it with that id); rows without one are inserted. */
export function useImportCards() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (rows: { id: string | null; input: CardInput }[]) => {
      const updates = rows.filter((r) => r.id).map((r) => ({ ...r.input, id: r.id! }))
      const inserts = rows.filter((r) => !r.id).map((r) => r.input)
      for (let i = 0; i < updates.length; i += IMPORT_CHUNK) {
        const { error } = await supabase.from('cards').upsert(updates.slice(i, i + IMPORT_CHUNK))
        if (error) throw error
      }
      for (let i = 0; i < inserts.length; i += IMPORT_CHUNK) {
        const { error } = await supabase.from('cards').insert(inserts.slice(i, i + IMPORT_CHUNK))
        if (error) throw error
      }
      return { updated: updates.length, inserted: inserts.length }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CARDS_KEY }),
  })
}
