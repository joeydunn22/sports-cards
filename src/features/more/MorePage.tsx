import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { useState } from 'react'
import { buttonPrimary, buttonSecondary, panel } from '../../components/ui'
import { signOut, useAuth } from '../../hooks/useAuth'
import {
  BIOMETRIC,
  PASSKEYS_SUPPORTED,
  useAddPasskey,
  usePasskeys,
  useRemovePasskey,
} from '../../hooks/usePasskeys'
import { ImportExportSections } from '../import-export/ImportExportPage'
import { AI_MODELS, getAiModel, setAiModel, type AiModel } from '../scan/aiModel'
import { AiCreditSetting } from './AiCreditSetting'

export function MorePage() {
  const { session } = useAuth()
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 md:pt-6">
      <PageHeader title="More" />

      <ImportExportSections />

      <AiModelSetting />

      <AiCreditSetting />

      <PasskeySetting />

      <section className={`${panel} flex items-center justify-between gap-3 p-4`}>
        <div className="min-w-0">
          <p className="text-sm text-slate-400">Signed in as</p>
          <p className="truncate font-medium">{session?.user.email}</p>
        </div>
        <button type="button" onClick={() => signOut()} className={`${buttonSecondary} shrink-0`}>
          <Icon name="logout" size={18} /> Sign out
        </button>
      </section>
    </main>
  )
}

function AiModelSetting() {
  const [model, setModel] = useState<AiModel>(getAiModel)
  return (
    <section className={`${panel} flex flex-col gap-3 p-4`}>
      <div>
        <h2 className="text-lg font-semibold">Card scanning</h2>
        <p className="text-sm text-slate-400">Which AI model reads your scanned cards.</p>
      </div>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="AI model">
        {AI_MODELS.map((m) => (
          <label
            key={m.id}
            className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 ${
              model === m.id ? 'border-sky-500 bg-sky-500/10' : 'border-slate-800'
            }`}
          >
            <input
              type="radio"
              name="ai-model"
              value={m.id}
              checked={model === m.id}
              onChange={() => {
                setModel(m.id)
                setAiModel(m.id)
              }}
              className="accent-sky-500"
            />
            <span className="font-medium">{m.label}</span>
            <span className="text-sm text-slate-400">{m.note}</span>
          </label>
        ))}
      </div>
    </section>
  )
}

function PasskeySetting() {
  const { data: passkeys, isPending, error } = usePasskeys()
  const add = useAddPasskey()
  const remove = useRemovePasskey()
  const problem = add.error ?? remove.error ?? error
  return (
    <section className={`${panel} flex flex-col gap-3 p-4`}>
      <div>
        <h2 className="text-lg font-semibold">{BIOMETRIC === 'a passkey' ? 'Passkey' : BIOMETRIC} sign-in</h2>
        <p className="text-sm text-slate-400">
          Sign in with {BIOMETRIC} instead of typing your password. The key stays on your device; only you can use it.
        </p>
      </div>
      {passkeys && passkeys.length > 0 && (
        <ul className="flex flex-col gap-2">
          {passkeys.map((key) => (
            <li key={key.id} className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-slate-800 px-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{key.friendly_name || 'Passkey'}</p>
                <p className="text-xs text-slate-500">
                  Added {new Date(key.created_at).toLocaleDateString()}
                  {key.last_used_at && ` · last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                </p>
              </div>
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm(`Remove “${key.friendly_name || 'Passkey'}”? You can still sign in with your password.`)) {
                    remove.mutate(key.id)
                  }
                }}
                className="min-h-11 px-2 text-sm font-medium text-red-300 disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {problem && <p className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">{problem.message}</p>}
      {PASSKEYS_SUPPORTED ? (
        <button
          type="button"
          disabled={add.isPending || isPending}
          onClick={() => add.mutate()}
          className={`${passkeys?.length ? buttonSecondary : buttonPrimary} min-h-12`}
        >
          {add.isPending ? 'Waiting for ' + BIOMETRIC + '…' : `Set up ${BIOMETRIC} on this device`}
        </button>
      ) : (
        <p className="text-sm text-slate-500">This browser doesn’t support passkeys.</p>
      )}
    </section>
  )
}

