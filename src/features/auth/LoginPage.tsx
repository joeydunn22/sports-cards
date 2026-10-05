import { useState, type FormEvent } from 'react'
import { Field, inputClass } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { buttonGhost, buttonPrimary, buttonSecondary, panel } from '../../components/ui'
import { signIn } from '../../hooks/useAuth'
import { BIOMETRIC, hasPasskeyOnDevice, PASSKEYS_SUPPORTED, signInWithPasskey } from '../../hooks/usePasskeys'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Lead with Face ID on a device that has a passkey; the password form stays one tap away.
  const passkeyFirst = PASSKEYS_SUPPORTED && hasPasskeyOnDevice()
  const [showPassword, setShowPassword] = useState(!passkeyFirst)

  // On success, AuthProvider picks up the new session and the app re-renders.
  async function attempt(signInWith: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await signInWith()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    void attempt(() => signIn(email.trim(), password))
  }

  const passkeyButton = PASSKEYS_SUPPORTED && (
    <button
      type="button"
      disabled={busy}
      onClick={() => void attempt(signInWithPasskey)}
      className={`${passkeyFirst ? buttonPrimary : buttonSecondary} min-h-12`}
    >
      Sign in with {BIOMETRIC}
    </button>
  )
  const errorText = error && (
    <p role="alert" className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">
      {error}
    </p>
  )

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

      {!showPassword ? (
        <div className={`${panel} flex flex-col gap-3 p-5`}>
          {passkeyButton}
          {errorText}
          <button type="button" onClick={() => setShowPassword(true)} className={`${buttonGhost} min-h-11 text-sm`}>
            Use email and password instead
          </button>
        </div>
      ) : (
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
          {errorText}
          <button type="submit" disabled={busy} className={`${buttonPrimary} mt-1 min-h-12`}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          {passkeyButton}
        </form>
      )}
    </main>
  )
}
