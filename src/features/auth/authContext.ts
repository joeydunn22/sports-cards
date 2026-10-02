import type { Session } from '@supabase/supabase-js'
import { createContext } from 'react'

export type AuthState = {
  session: Session | null
  /** True until the stored session (if any) has been restored. */
  loading: boolean
}

export const AuthContext = createContext<AuthState | null>(null)
