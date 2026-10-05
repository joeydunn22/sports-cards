import { useState, type FormEvent } from 'react'
import { inputClass } from '../../components/Field'
import { buttonSecondary, panel } from '../../components/ui'
import { DEFAULT_SETTINGS, NO_USAGE, useAiUsage, useAppSettings, useSaveSettings } from '../../hooks/useAiSpend'
import { creditLeft } from '../ai/costEstimate'

const CONSOLE_BILLING = 'https://platform.claude.com/settings/billing'

/**
 * Anthropic has no API for the prepaid balance, so: enter it from the Console, and the app subtracts
 * what each AI run actually cost (logged by the scan-cards function).
 */
export function AiCreditSetting() {
  const { data: settings = DEFAULT_SETTINGS } = useAppSettings()
  const { data: usage = NO_USAGE } = useAiUsage()
  const save = useSaveSettings()
  const [balance, setBalance] = useState('')
  const credit = creditLeft(settings, usage)
  const total = usage.reduce((sum, u) => sum + Number(u.dollars), 0)

  function setCredit(e: FormEvent) {
    e.preventDefault()
    const dollars = Number(balance.replace(/[$,\s]/g, ''))
    if (!Number.isFinite(dollars) || dollars < 0) return
    save.mutate({ credit_dollars: dollars, credit_set_at: new Date().toISOString() })
    setBalance('')
  }

  return (
    <section className={`${panel} flex flex-col gap-4 p-4`}>
      <div>
        <h2 className="text-lg font-semibold">AI credit</h2>
        {credit ? (
          <>
            <p className="mt-1 text-3xl font-bold tracking-tight">≈ ${credit.left.toFixed(2)} left</p>
            <p className="text-sm text-slate-400">
              ${credit.spent.toFixed(2)} spent since you entered ${Number(settings.credit_dollars).toFixed(2)} on{' '}
              {new Date(settings.credit_set_at!).toLocaleDateString()}.
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-400">
            Enter your balance from the Anthropic Console, and the app will count down as AI runs use it.
          </p>
        )}
        <p className="mt-1 text-xs text-slate-500">
          An estimate from this app’s own log ({usage.length} {usage.length === 1 ? 'run' : 'runs'}, ${total.toFixed(2)}{' '}
          in all). The Console has the exact figure.
        </p>
      </div>

      <form onSubmit={setCredit} className="flex items-center gap-2">
        <input
          aria-label="Credit balance in dollars"
          inputMode="decimal"
          placeholder={credit ? 'New balance, e.g. 18.40' : 'Balance, e.g. 20.00'}
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          className={inputClass}
        />
        <button type="submit" disabled={!balance.trim()} className={`${buttonSecondary} shrink-0`}>
          {credit ? 'Update' : 'Save'}
        </button>
      </form>
      <a href={CONSOLE_BILLING} target="_blank" rel="noreferrer" className="-mt-2 text-sm text-sky-400 underline">
        Check the balance in the Console
      </a>

      <div className="flex flex-col gap-1 border-t border-slate-800 pt-3">
        <Toggle
          label="Ask before AI runs"
          hint="Shows the estimated cost and waits for OK. Off: runs start right away; estimates still show on the buttons."
          checked={settings.confirm_ai_runs}
          onChange={(confirm_ai_runs) => save.mutate({ confirm_ai_runs })}
        />
        <Toggle
          label="Automatic checklist searches"
          hint="After reading, cards the AI is unsure about get one web search (about 5¢ each). Off: a button on the card instead."
          checked={settings.auto_lookup}
          onChange={(auto_lookup) => save.mutate({ auto_lookup })}
        />
      </div>
      {save.isError && <p className="text-sm text-red-300">{save.error.message}</p>}
    </section>
  )
}

function Toggle(props: { label: string; hint: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-start gap-3 py-2">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-sky-500"
      />
      <span>
        <span className="block font-medium">{props.label}</span>
        <span className="block text-sm text-slate-400">{props.hint}</span>
      </span>
    </label>
  )
}
