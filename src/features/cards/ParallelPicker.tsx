import { useState } from 'react'
import { firstOptions, type ParallelOption } from './parallels'

/** Chips shown before "All": enough for most rainbows; 2025 Topps has about 70. */
const SHOWN = 12

type ParallelPickerProps = {
  options: ParallelOption[]
  /** Parallel is blank: the base version, unless the print run points at a parallel. */
  base: boolean
  /** A chip was tapped: that parallel and its print run, or null for the base version. */
  onPick: (option: ParallelOption | null) => void
}

/** The set's rainbow under Parallel, one tap to fill the parallel and its print run. */
export function ParallelPicker({ options, base, onPick }: ParallelPickerProps) {
  const [all, setAll] = useState(false)
  if (!options.length) return null
  const shown = all ? options : firstOptions(options, SHOWN)
  const suggested = options.some((o) => o.state === 'suggested')
  return (
    <div className="flex flex-wrap gap-2" aria-label="This set’s parallels">
      <Chip label="Base" state={base && !suggested ? 'selected' : null} onClick={() => onPick(null)} />
      {shown.map((option) => (
        <Chip key={option.parallel} label={option.label} state={option.state} onClick={() => onPick(option)} />
      ))}
      {shown.length < options.length && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="min-h-11 rounded-full px-3 text-sm font-medium text-sky-300 active:bg-slate-800"
        >
          All {options.length}
        </button>
      )}
    </div>
  )
}

function Chip({ label, state, onClick }: { label: string; state: ParallelOption['state']; onClick: () => void }) {
  const look =
    state === 'selected'
      ? 'border-sky-400 bg-sky-500 text-slate-950'
      : state === 'suggested'
        ? 'border-emerald-400 bg-emerald-950/60 text-emerald-200 ring-2 ring-emerald-400/30'
        : 'border-slate-700 bg-slate-900 text-slate-300 active:bg-slate-800'
  return (
    <button
      type="button"
      aria-pressed={state === 'selected'}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-3.5 text-sm font-medium transition-colors ${look}`}
    >
      {label}
    </button>
  )
}
