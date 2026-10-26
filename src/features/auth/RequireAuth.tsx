import type { ReactNode } from 'react'
import { buttonPrimary, panel } from '../../components/ui'
import { useAuth } from '../../hooks/useAuth'
import { SUPABASE_DASHBOARD } from '../../lib/supabase'
import { LoginPage } from './LoginPage'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading, unreachable, retry } = useAuth()
  if (unreachable) return <Unreachable onRetry={retry} />
  if (loading) return null
  return session ? children : <LoginPage />
}

function Unreachable({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
      <section className={`${panel} flex flex-col gap-3 p-5`}>
        <h1 className="text-xl font-bold">Can’t reach the database</h1>
        <p className="text-sm text-slate-300">
          If you’re online, the free Supabase project was probably paused after a quiet week. Open the Supabase
          dashboard and choose <span className="font-medium">Restore project</span>; it takes a few minutes, and
          your cards are kept.
        </p>
        <a href={SUPABASE_DASHBOARD} target="_blank" rel="noreferrer" className="text-sm text-sky-400 underline">
          Open the Supabase dashboard
        </a>
        <button type="button" onClick={onRetry} className={`${buttonPrimary} min-h-12`}>
          Try again
        </button>
      </section>
    </main>
  )
}
