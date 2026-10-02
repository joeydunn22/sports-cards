import { signOut, useAuth } from '../../hooks/useAuth'

/** Placeholder until the card list arrives in Phase 1. */
export function CollectionPage() {
  const { session } = useAuth()

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">Your collection</h1>
      <p className="text-slate-300">
        Signed in as {session?.user.email}. Card entry is coming in Phase 1.
      </p>
      <button
        type="button"
        onClick={() => signOut()}
        className="min-h-11 rounded-lg border border-slate-700 font-medium"
      >
        Sign out
      </button>
    </main>
  )
}
