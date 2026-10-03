import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { demoSession, IS_DEMO } from '../../dev/demo'
import { supabase } from '../../lib/supabase'
import { AuthContext } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(IS_DEMO ? demoSession : null)
  const [loading, setLoading] = useState(!IS_DEMO)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (IS_DEMO) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      // Don't leave the previous session's cards in memory.
      if (event === 'SIGNED_OUT') queryClient.clear()
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>
}
