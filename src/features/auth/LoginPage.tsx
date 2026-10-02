import { useState, type FormEvent } from 'react'
import { sendLoginCode, verifyLoginCode } from '../../hooks/useAuth'

type Step = 'email' | 'code'

export function LoginPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  function handleEmail(e: FormEvent) {
    e.preventDefault()
    run(async () => {
      await sendLoginCode(email.trim())
      setStep('code')
    })
  }

  function handleCode(e: FormEvent) {
    e.preventDefault()
    // On success, AuthProvider picks up the new session and the app re-renders.
    run(() => verifyLoginCode(email.trim(), code.trim()))
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Sports Cards</h1>

      {step === 'email' ? (
        <form onSubmit={handleEmail} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-sm text-slate-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-base"
          />
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 rounded-lg bg-sky-500 font-medium text-slate-950 disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send login code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleCode} className="flex flex-col gap-3">
          <label htmlFor="code" className="text-sm text-slate-300">
            Enter the code sent to {email}
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="min-h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-center text-xl tracking-widest"
          />
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 rounded-lg bg-sky-500 font-medium text-slate-950 disabled:opacity-50"
          >
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('email')
              setCode('')
              setError(null)
            }}
            className="min-h-11 text-sm text-slate-400"
          >
            Use a different email
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </main>
  )
}
