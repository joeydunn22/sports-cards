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
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-300">
        {label}
        {required && <span className="text-sky-400"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : warning ? (
        <p className="text-xs text-amber-300">{warning}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}

export const inputClass =
  'min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-base text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 focus:outline-none aria-[invalid=true]:border-red-500'
