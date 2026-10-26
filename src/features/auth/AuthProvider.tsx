import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { demoSession, IS_DEMO } from '../../dev/demo'
import { supabase, supabaseReachable } from '../../lib/supabase'
import { AuthContext } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(IS_DEMO ? demoSession : null)
  const [loading, setLoading] = useState(!IS_DEMO)
  const [unreachable, setUnreachable] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (IS_DEMO) return
    let current = true
    // Checked alongside the session: restoring a stored session can wait on the network indefinitely.
    supabaseReachable().then((ok) => {
      if (!current || ok) return
      setUnreachable(true)
      setLoading(false)
    })
    supabase.auth.getSession().then(({ data }) => {
      if (!current) return
      setSession(data.session)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      // Don't leave the previous session's cards in memory.
      if (event === 'SIGNED_OUT') queryClient.clear()
    })
    return () => {
      current = false
      data.subscription.unsubscribe()
    }
  }, [queryClient, attempt])

  function retry() {
    setUnreachable(false)
    setLoading(true)
    setAttempt((n) => n + 1)
  }

  return <AuthContext.Provider value={{ session, loading, unreachable, retry }}>{children}</AuthContext.Provider>
}
