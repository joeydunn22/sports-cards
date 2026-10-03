import { useState, type FormEvent } from 'react'
import { Field, inputClass } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { buttonPrimary, panel } from '../../components/ui'
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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="grid size-16 place-items-center rounded-2xl bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/20">
          <Icon name="cards" size={32} />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sports Cards</h1>
          <p className="text-sm text-slate-400">Sign in to your collection</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={`${panel} flex flex-col gap-4 p-5`}>
        <Field label="Email" htmlFor="email">
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </Field>
        {error && (
          <p role="alert" className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={`${buttonPrimary} mt-1 min-h-12`}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
