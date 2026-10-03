import { useQuery } from '@tanstack/react-query'
import { IS_DEMO } from '../dev/demo'
import { PHOTO_BUCKET, thumbPath, type EncodedImage } from '../lib/photos'
import { supabase } from '../lib/supabase'

/** Signed URLs last an hour; refresh a little before they expire. */
const URL_TTL_SECONDS = 3600

/** A short-lived URL for a private photo (or its thumbnail). */
export function usePhotoUrl(path: string | null | undefined, { thumb = false } = {}) {
  const target = path ? (thumb ? thumbPath(path) : path) : null
  return useQuery({
    queryKey: ['photo-url', target],
    enabled: target != null && !IS_DEMO,
    staleTime: (URL_TTL_SECONDS - 300) * 1000,
    gcTime: (URL_TTL_SECONDS - 300) * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(target!, URL_TTL_SECONDS)
      if (error) throw error
      return data.signedUrl
    },
  })
}

export async function uploadPhoto(path: string, image: EncodedImage) {
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, image.blob, { contentType: image.blob.type, upsert: true })
  if (error) throw error
}

/** Deletes photos and their thumbnails. Missing files are ignored. */
export async function removePhotos(paths: (string | null | undefined)[]) {
  const all = paths.filter((p): p is string => Boolean(p)).flatMap((p) => [p, thumbPath(p)])
  if (all.length === 0) return
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(all)
  if (error) throw error
}

/** The signed-in user's id, needed for the storage folder. Reads the local session (no network). */
export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('You are signed out. Sign in again and retry.')
  return id
}
