import type { ReactNode } from 'react'

type FieldProps = {
  label: string
  htmlFor: string
  required?: boolean
  hint?: string
  warning?: string | null
  error?: string
  children: ReactNode
  className?: string
}

/** Label + input + one line of hint, warning or error underneath. */
export function Field({ label, htmlFor, required, hint, warning, error, children, className = '' }: FieldProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-400">
        {label}
        {required && <span className="text-accent-400"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : warning ? (
        <p className="text-xs text-amber-300">{warning}</p>
      ) : hint ? (
        <p className="text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  )
}

export const inputClass =
  'min-h-11 w-full rounded-xl border border-transparent bg-white/[0.045] px-3.5 text-base text-ink-50 ring-1 ring-white/[0.05] transition-[box-shadow,border-color] placeholder:text-ink-600 focus:border-accent-400/70 focus:ring-4 focus:ring-accent-400/15 focus:outline-none aria-[invalid=true]:border-red-500'
