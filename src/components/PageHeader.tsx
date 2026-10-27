import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Icon } from './Icon'

type PageHeaderProps = {
  title: string
  subtitle?: ReactNode
  /** Shows a back chevron linking here. */
  backTo?: string
  backLabel?: string
  /** Router state for the back link (the card screen's collection order). */
  backState?: unknown
  actions?: ReactNode
  /** A small line above the title (the card screen puts the team there). */
  eyebrow?: ReactNode
}

export function PageHeader({ title, subtitle, backTo, backLabel = 'Back', backState, actions, eyebrow }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-1">
      {backTo && (
        <Link
          to={backTo}
          state={backState}
          className="-ml-2 flex min-h-11 items-center gap-0.5 self-start pr-2 text-[15px] font-medium text-accent-400 active:text-accent-300"
        >
          <Icon name="back" size={20} />
          {backLabel}
        </Link>
      )}
      {eyebrow && <div className="mt-1 text-[12px] font-semibold tracking-[0.08em] uppercase">{eyebrow}</div>}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[32px] leading-tight font-bold tracking-tight text-ink-50">{title}</h1>
        {actions}
      </div>
      {subtitle && <div className="text-[15px] text-ink-400">{subtitle}</div>}
    </header>
  )
}
