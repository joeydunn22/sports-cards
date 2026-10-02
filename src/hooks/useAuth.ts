import { useContext } from 'react'
import { AuthContext } from '../features/auth/authContext'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>')
  return auth
}

/** Sign-ups are disabled in Supabase; the single account is created from the dashboard. */
export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
