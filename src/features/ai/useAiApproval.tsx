import { useRef, useState, type ReactNode } from 'react'
import { DEFAULT_SETTINGS, NO_USAGE, useAiUsage, useAppSettings, useSaveSettings } from '../../hooks/useAiSpend'
import { ApprovalDialog } from './ApprovalDialog'
import { creditLeft, estimateEach, estimateRead, type Estimate } from './costEstimate'

export type AiRequest = {
  /** What's about to happen, e.g. "Read 6 cards with Sonnet 5.5". */
  action: string
  estimate: Estimate
  /** Extra line, e.g. that checklist searches may follow. */
  note?: string
}

/**
 * Every AI run goes through `approve()` first. With "Ask before AI runs" on (the default), it shows
 * the estimated cost and waits for a yes. With it off, runs start right away, except one that could
 * cost more than the credit left, which always asks. Render `dialog` somewhere in the page.
 */
export function useAiApproval() {
  const { data: settings = DEFAULT_SETTINGS } = useAppSettings()
  const { data: history = NO_USAGE } = useAiUsage()
  const saveSettings = useSaveSettings()
  const credit = creditLeft(settings, history)
  const [request, setRequest] = useState<AiRequest | null>(null)
  const resolver = useRef<(ok: boolean) => void>(undefined)

  function approve(next: AiRequest): Promise<boolean> {
    const tooMuch = credit != null && next.estimate.max > credit.left
    if (!settings.confirm_ai_runs && !tooMuch) return Promise.resolve(true)
    setRequest(next)
    return new Promise((resolve) => (resolver.current = resolve))
  }

  function finish(ok: boolean, stopAsking = false) {
    if (ok && stopAsking) saveSettings.mutate({ confirm_ai_runs: false })
    setRequest(null)
    resolver.current?.(ok)
  }

  const dialog: ReactNode = request && (
    <ApprovalDialog request={request} credit={credit} asking={settings.confirm_ai_runs} onFinish={finish} />
  )
  // Shared so every button and dialog quotes the same figures.
  const estimate = {
    read: (cards: number, model: string) => estimateRead(model, cards, history, settings.auto_lookup),
    lookup: (cards: number, model: string) => estimateEach('lookup', model, cards, history),
    identify: (model: string) => estimateEach('identify', model, 1, history),
  }
  return { approve, dialog, credit, estimate, autoLookup: settings.auto_lookup }
}
