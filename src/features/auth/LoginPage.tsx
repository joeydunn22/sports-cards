import { useState, type FormEvent } from 'react'
import { signIn } from '../../hooks/useAuth'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      // On success, AuthProvider picks up the new session and the app re-renders.
      await signIn(email.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Sports Cards</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="email" className="text-sm text-slate-300">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-base"
        />
        <label htmlFor="password" className="text-sm text-slate-300">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-base"
        />
        <button
          type="submit"
          disabled={busy}
          className="mt-2 min-h-11 rounded-lg bg-sky-500 font-medium text-slate-950 disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </main>
  )
}
