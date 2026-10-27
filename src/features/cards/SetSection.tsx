import type { ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { panel, sectionTitle } from '../../components/ui'
import type { SetStatus } from '../sets/useSetHelp'

const STATUS_COLOR: Record<SetStatus['kind'], string> = {
  looking: 'text-ink-400',
  known: 'text-accent-300',
  empty: 'text-ink-500',
  not_found: 'text-amber-300',
  failed: 'text-amber-300',
}

export function SetStatusLine({ status }: { status: SetStatus | null }) {
  if (!status) return null
  return (
    <p role="status" className={`text-xs ${STATUS_COLOR[status.kind]}`}>
      {status.kind === 'known' && <Icon name="check" size={14} className="mr-1 inline -translate-y-px" />}
      {status.text}
    </p>
  )
}

type SetSectionProps = {
  /** Folded to one line once a batch's set is in (after Save & add another); the fields otherwise. */
  open: boolean
  summary: string
  onOpen: () => void
  status: SetStatus | null
  children: ReactNode
}

/** The batch's year, set and sport, first: cards usually go in a set at a time. */
export function SetSection({ open, summary, onOpen, status, children }: SetSectionProps) {
  if (!open) {
    return (
      <section className={`${panel} flex items-center gap-3 px-4 py-3`}>
        <div className="min-w-0 flex-1">
          <h2 className={sectionTitle}>Set</h2>
          <p className="truncate font-medium text-ink-100">{summary}</p>
          <SetStatusLine status={status} />
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-accent-400 active:bg-ink-800"
        >
          <Icon name="edit" size={16} /> Change
        </button>
      </section>
    )
  }
  return (
    <section className={`${panel} p-4`}>
      <h2 className={`${sectionTitle} mb-3`}>Set</h2>
      {children}
      <div className="mt-3">
        <SetStatusLine status={status} />
      </div>
    </section>
  )
}
