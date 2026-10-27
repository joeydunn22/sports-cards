import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { buttonPrimary, buttonSecondary, listGroup, listRow, panel, sectionTitle } from '../../components/ui'
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
import { NO_KNOWN_SETS, useKnownSets } from '../../hooks/useKnownSets'
import { NO_CARDS, useCards } from '../../hooks/useCards'
import { touchUpQueue } from '../photos/useTouchUpBatch'
import { AiCreditSetting } from './AiCreditSetting'
import { TeamNames } from './TeamNames'

export function MorePage() {
  const { session } = useAuth()
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 md:pt-8">
      <PageHeader title="More" />

      <Group title="Library">
        <div className={listGroup}>
          <CardDatabase />
          <PhotoTouchUp />
        </div>
        <TeamNames />
      </Group>

      <Group title="Data">
        <ImportExportSections />
      </Group>

      <Group title="Scanning">
        <AiModelSetting />
        <AiCreditSetting />
      </Group>

      <Group title="Account">
        <PasskeySetting />
        <section className={`${panel} flex items-center justify-between gap-3 p-4`}>
          <div className="min-w-0">
            <p className="text-sm text-ink-400">Signed in as</p>
            <p className="truncate font-medium">{session?.user.email}</p>
          </div>
          <button type="button" onClick={() => signOut()} className={`${buttonSecondary} shrink-0`}>
            <Icon name="logout" size={18} /> Sign out
          </button>
        </section>
      </Group>
    </main>
  )
}

/** A titled group of settings, like the sections of the iPhone's Settings app. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h2 className={`${sectionTitle} px-1`}>{title}</h2>
      {children}
    </section>
  )
}

/** One tappable row in a list group: a title, a line of detail and a chevron. */
function LinkRow({ to, title, detail }: { to: string; title: string; detail: string }) {
  return (
    <Link to={to} className={listRow}>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-ink-400">{detail}</p>
      </div>
      <Icon name="back" size={18} className="shrink-0 rotate-180 text-ink-600" />
    </Link>
  )
}

function AiModelSetting() {
  const [model, setModel] = useState<AiModel>(getAiModel)
  return (
    <section className={`${panel} flex flex-col gap-3 p-4`}>
      <div>
        <h2 className="text-lg font-semibold">Card scanning</h2>
        <p className="text-sm text-ink-400">Which AI model reads your scanned cards.</p>
      </div>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="AI model">
        {AI_MODELS.map((m) => (
          <label
            key={m.id}
            className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 ${
              model === m.id ? 'border-accent-400/70 bg-accent-400/10' : 'border-ink-800'
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
              className="accent-accent-400"
            />
            <span className="font-medium">{m.label}</span>
            <span className="text-sm text-ink-400">{m.note}</span>
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
        <p className="text-sm text-ink-400">
          Sign in with {BIOMETRIC} instead of typing your password. The key stays on your device; only you can use it.
        </p>
      </div>
      {passkeys && passkeys.length > 0 && (
        <ul className="flex flex-col gap-2">
          {passkeys.map((key) => (
            <li key={key.id} className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-ink-800 px-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{key.friendly_name || 'Passkey'}</p>
                <p className="text-xs text-ink-500">
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
        <p className="text-sm text-ink-500">This browser doesn’t support passkeys.</p>
      )}
    </section>
  )
}

/** The automatic photo touch-up, with how many cards' photos haven't been through it yet. */
function PhotoTouchUp() {
  const { data: cards = NO_CARDS } = useCards()
  const left = touchUpQueue(cards).length
  return (
    <LinkRow
      to="/photos/touch-up"
      title="Touch up photos"
      detail={
        left
          ? `${left} ${left === 1 ? 'card' : 'cards'} to go. Crops to the card, fills glare and fixes the lighting; you see before and after.`
          : 'All photos checked. Crops to the card, fills glare and fixes the lighting.'
      }
    />
  )
}

/** The card database (set parallel lists and checklist spots), opened on the Sets page. */
function CardDatabase() {
  const { data: known = NO_KNOWN_SETS } = useKnownSets()
  const sets = known.length
  const parallels = known.reduce((n, s) => n + s.parallels, 0)
  const cards = known.reduce((n, s) => n + s.cards, 0)
  return (
    <LinkRow
      to="/sets"
      title="Sets"
      detail={`${sets} ${sets === 1 ? 'set' : 'sets'} known: ${parallels.toLocaleString()} parallels, ${cards.toLocaleString()} cards. Get sets ready before scanning, and fix anything wrong.`}
    />
  )
}

