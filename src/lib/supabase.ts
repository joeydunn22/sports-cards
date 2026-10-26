import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill them in.',
  )
}

export const supabase = createClient<Database>(url, key)

/** The project's dashboard, where a paused project is restored. */
export const SUPABASE_DASHBOARD = `https://supabase.com/dashboard/project/${new URL(url).hostname.split('.')[0]}`

/**
 * Whether Supabase answers at all. A paused project's hostname stops resolving, and the client then
 * retries its token refresh quietly instead of failing, which used to leave a blank screen.
 */
export async function supabaseReachable(timeoutMs = 8000): Promise<boolean> {
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(timeoutMs),
    })
    return res.ok
  } catch {
    return false
  }
}
