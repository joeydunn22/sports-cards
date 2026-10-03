import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
