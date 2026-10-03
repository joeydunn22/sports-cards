import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { IS_DEMO } from '../dev/demo'
import { photoPath, thumbPath, type CardCrop } from '../lib/photos'
import { supabase } from '../lib/supabase'
import type { Card, CardInput, CardScan } from '../types/card'
import { CARDS_KEY } from './useCards'
import { currentUserId, removePhotos, uploadPhoto } from './usePhotos'

export const SCANS_KEY = ['scans'] as const
export const NO_SCANS: CardScan[] = []

/** Cards waiting in the scan inbox, oldest first (the order they were photographed). */
export function useScans() {
  return useQuery({
    queryKey: SCANS_KEY,
    queryFn: async () => {
      if (IS_DEMO) return NO_SCANS
      const { data, error } = await supabase
        .from('card_scans')
        .select('*')
        .order('created_at')
        .order('id')
      if (error) throw error
      return data
    },
  })
}

/** How often to ask whether the AI has finished a batch. */
const POLL_MS = 20_000

async function callScanFunction<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('scan-cards', { body })
  if (error) {
    // The function returns { error } with a readable message; surface it instead of the generic one.
    const detail = await (error.context as Response | undefined)?.json?.().catch(() => null)
    throw new Error(detail?.error ?? error.message)
  }
  return data as T
}

/** Sends cards waiting in the inbox to the AI (all pending ones, or just `ids`). */
export function useReadScans() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ model, ids }: { model: string; ids?: string[] }) =>
      callScanFunction<{ submitted: number }>({ action: 'submit', model, ids }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: SCANS_KEY }),
  })
}

/** Puts cards back in the queue (e.g. to read again with another model), then sends them. */
export function useRereadScans() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ model, ids }: { model: string; ids: string[] }) => {
      const { error } = await supabase
        .from('card_scans')
        .update({ status: 'pending', error: null, batch_id: null })
        .in('id', ids)
      if (error) throw error
      return callScanFunction<{ submitted: number }>({ action: 'submit', model, ids })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: SCANS_KEY }),
  })
}

/** While any card is being read, check for results every so often and refresh the inbox. */
export function useScanPolling(scans: CardScan[]) {
  const queryClient = useQueryClient()
  const processing = scans.some((s) => s.status === 'processing')
  const poll = useQuery({
    queryKey: ['scan-poll'],
    enabled: processing && !IS_DEMO,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
    queryFn: () => callScanFunction<{ updated: number; processing: number }>({ action: 'poll' }),
  })
  const updated = poll.data?.updated ?? 0
  useEffect(() => {
    if (updated > 0) void queryClient.invalidateQueries({ queryKey: SCANS_KEY })
  }, [poll.dataUpdatedAt, updated, queryClient])
  return poll
}

export type ScanUpload = { front: CardCrop; back: CardCrop | null }

/** Uploads each card's photos and adds it to the inbox. Cards are saved one by one, so a failure keeps earlier ones. */
export function useCreateScans() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ items, onProgress }: { items: ScanUpload[]; onProgress?: (done: number) => void }) => {
      const userId = await currentUserId()
      for (const [index, item] of items.entries()) {
        const id = crypto.randomUUID()
        const front = photoPath(userId, id, 'front', item.front.photo.ext)
        const back = item.back ? photoPath(userId, id, 'back', item.back.photo.ext) : null
        await uploadPhoto(front, item.front.photo)
        await uploadPhoto(thumbPath(front), item.front.thumb)
        if (item.back && back) {
          await uploadPhoto(back, item.back.photo)
          await uploadPhoto(thumbPath(back), item.back.thumb)
        }
        const { error } = await supabase
          .from('card_scans')
          .insert({ id, front_image_path: front, back_image_path: back })
        if (error) throw error
        onProgress?.(index + 1)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: SCANS_KEY }),
  })
}

export function useDeleteScan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (scan: CardScan) => {
      const { error } = await supabase.from('card_scans').delete().eq('id', scan.id)
      if (error) throw error
      await removePhotos([scan.front_image_path, scan.back_image_path])
    },
    onMutate: (scan) => {
      queryClient.setQueryData<CardScan[]>(SCANS_KEY, (old) => old?.filter((s) => s.id !== scan.id))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: SCANS_KEY }),
  })
}

/** Turns a reviewed scan into a card. The photos stay where they are and now belong to the card. */
export function useConfirmScan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ scan, input }: { scan: CardScan; input: CardInput }) => {
      const { data: card, error } = await supabase
        .from('cards')
        .insert({ ...input, front_image_path: scan.front_image_path, back_image_path: scan.back_image_path })
        .select()
        .single()
      if (error) throw error
      const { error: deleteError } = await supabase.from('card_scans').delete().eq('id', scan.id)
      if (deleteError) throw deleteError
      return card
    },
    onSuccess: (card, { scan }) => {
      queryClient.setQueryData<Card[]>(CARDS_KEY, (old) => (old ? [card, ...old] : old))
      queryClient.setQueryData<CardScan[]>(SCANS_KEY, (old) => old?.filter((s) => s.id !== scan.id))
    },
  })
}
