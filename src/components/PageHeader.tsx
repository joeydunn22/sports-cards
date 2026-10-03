import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Icon } from './Icon'

type PageHeaderProps = {
  title: string
  subtitle?: ReactNode
  /** Shows a back chevron linking here. */
  backTo?: string
  backLabel?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, backTo, backLabel = 'Back', actions }: PageHeaderProps) {
  return (
    <header className="mb-5 flex flex-col gap-1">
      {backTo && (
        <Link
          to={backTo}
          className="-ml-2 flex min-h-11 items-center gap-0.5 self-start pr-2 text-sm text-sky-400 active:text-sky-300"
        >
          <Icon name="back" size={20} />
          {backLabel}
        </Link>
      )}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {actions}
      </div>
      {subtitle && <div className="text-sm text-slate-400">{subtitle}</div>}
    </header>
  )
}
