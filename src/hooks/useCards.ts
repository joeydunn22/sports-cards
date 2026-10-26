import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { demoCards, IS_DEMO } from '../dev/demo'
import { photoPath, thumbPath, type CardCrop, type Side } from '../lib/photos'
import { supabase } from '../lib/supabase'
import { currentUserId, removePhotos, uploadPhoto } from './usePhotos'
import type { Card, CardInput } from '../types/card'

export const CARDS_KEY = ['cards'] as const
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
  return useQuery({
    queryKey: CARDS_KEY,
    queryFn: IS_DEMO ? async () => demoCards : fetchAllCards,
    staleTime: 60_000,
  })
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

/** Another copy of a card already in the collection: bump its quantity instead of adding a row. */
export function useAddQuantity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ card, quantity }: { card: Card; quantity: number }) => {
      const { data, error } = await supabase
        .from('cards')
        .update({ quantity: card.quantity + quantity })
        .eq('id', card.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (card) => {
      queryClient.setQueryData<Card[]>(CARDS_KEY, (old) => old?.map((c) => (c.id === card.id ? card : c)))
    },
  })
}

export type PhotoReplacement = { card: Card; side: Side; crop: CardCrop }

/**
 * Replaces one side's photo with an edited copy and marks the card's photos checked; the old photo and
 * thumbnail are deleted (only the latest version is kept). The new file gets a fresh path so cached
 * signed URLs can't show the old image.
 */
async function replaceCardPhoto({ card, side, crop }: PhotoReplacement): Promise<Card> {
  const userId = await currentUserId()
  const path = photoPath(userId, crypto.randomUUID(), side, crop.photo.ext, crop.flat)
  await uploadPhoto(path, crop.photo)
  await uploadPhoto(thumbPath(path), crop.thumb)
  const photos_checked_at = new Date().toISOString()
  const { data, error } = await supabase
    .from('cards')
    .update(side === 'front' ? { front_image_path: path, photos_checked_at } : { back_image_path: path, photos_checked_at })
    .eq('id', card.id)
    .select()
    .single()
  if (error) {
    await removePhotos([path]).catch(() => {})
    throw error
  }
  // The card already points at the new photo; a leftover old file is harmless.
  await removePhotos([side === 'front' ? card.front_image_path : card.back_image_path]).catch(() => {})
  return data
}

const replaceInCache = (old: Card[] | undefined, updated: Card[]) => {
  const byId = new Map(updated.map((c) => [c.id, c]))
  return old?.map((c) => byId.get(c.id) ?? c)
}

/** The photo editor's save. */
export function useReplaceCardPhoto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (replacement: PhotoReplacement) =>
      IS_DEMO ? replacement.card : replaceCardPhoto(replacement), // no storage in demo mode
    onSuccess: (card) => queryClient.setQueryData<Card[]>(CARDS_KEY, (old) => replaceInCache(old, [card])),
  })
}

/**
 * Saves one batch of the automatic touch-up: the "after" photos that were kept, then marks every card in
 * the batch checked (also those kept as they were), so the next batch moves on.
 */
export function useSaveTouchUps() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ replacements, checkedIds }: { replacements: PhotoReplacement[]; checkedIds: string[] }) => {
      const photos_checked_at = new Date().toISOString()
      if (IS_DEMO) {
        const cards = queryClient.getQueryData<Card[]>(CARDS_KEY) ?? []
        return cards.filter((c) => checkedIds.includes(c.id)).map((c) => ({ ...c, photos_checked_at }))
      }
      for (const replacement of replacements) await replaceCardPhoto(replacement)
      if (checkedIds.length === 0) return []
      const { data, error } = await supabase.from('cards').update({ photos_checked_at }).in('id', checkedIds).select()
      if (error) throw error
      return data
    },
    onSuccess: (cards) => queryClient.setQueryData<Card[]>(CARDS_KEY, (old) => replaceInCache(old, cards)),
    // A save that stopped partway has still replaced some photos.
    onError: () => queryClient.invalidateQueries({ queryKey: CARDS_KEY }),
  })
}

export function useDeleteCard() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, string, Snapshot>({
    mutationFn: async (id) => {
      const { data, error } = await supabase
        .from('cards')
        .delete()
        .eq('id', id)
        .select('front_image_path, back_image_path')
      if (error) throw error
      // The card is gone either way; a leftover photo file is harmless, so don't fail on it.
      await removePhotos(data.flatMap((c) => [c.front_image_path, c.back_image_path])).catch(() => {})
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

/** Respells a team on many cards at once ("Reds" to "Cincinnati Reds"). */
export function useRenameTeams() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (fixes: { to: string; ids: string[] }[]) => {
      for (const { to, ids } of fixes) {
        for (let i = 0; i < ids.length; i += IMPORT_CHUNK) {
          const { error } = await supabase.from('cards').update({ team: to }).in('id', ids.slice(i, i + IMPORT_CHUNK))
          if (error) throw error
        }
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CARDS_KEY }),
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
