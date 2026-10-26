import type { Session } from '@supabase/supabase-js'
import { createContext } from 'react'

export type AuthState = {
  session: Session | null
  /** True until the stored session (if any) has been restored. */
  loading: boolean
  /** Supabase didn't answer (most likely the free project was paused for inactivity). */
  unreachable: boolean
  /** Tries again after an unreachable start. */
  retry: () => void
}

export const AuthContext = createContext<AuthState | null>(null)
