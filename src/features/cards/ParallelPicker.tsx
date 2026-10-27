import { useState } from 'react'
import { shortlist, type Numbering, type ParallelOption } from './parallels'

/** Chips shown before "All": enough for most rainbows; 2025 Topps has about 70. */
const SHOWN = 12

type ParallelPickerProps = {
  options: ParallelOption[]
  /** Parallel is blank: the base version, unless the print run points at a parallel. */
  base: boolean
  /** The card's print run, or that it isn't numbered: only the parallels that fit show before "All". */
  numbering: Numbering
  /** A chip was tapped: that parallel and its print run, or null for the base version. */
  onPick: (option: ParallelOption | null) => void
}

/** The set's rainbow under Parallel, one tap to fill the parallel and its print run. */
export function ParallelPicker({ options, base, numbering, onPick }: ParallelPickerProps) {
  const [all, setAll] = useState(false)
  if (!options.length) return null
  const short = shortlist(options, numbering, SHOWN)
  const shown = all ? options : short.options
  // Base isn't numbered, but stays as the way back once a parallel is picked.
  const showBase = all || short.base || !base
  const suggested = options.some((o) => o.state === 'suggested')
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="This set’s parallels">
      {showBase && <Chip label="Base" state={base && !suggested ? 'selected' : null} onClick={() => onPick(null)} />}
      {shown.map((option) => (
        <Chip key={option.parallel} label={option.label} state={option.state} onClick={() => onPick(option)} />
      ))}
      {!shown.length && typeof numbering === 'number' && (
        <span className="text-sm text-ink-400">None listed as /{numbering}</span>
      )}
      {(shown.length < options.length || !showBase) && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="min-h-11 rounded-full px-3 text-sm font-medium text-accent-300 active:bg-ink-800"
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
      ? 'bg-accent-400 font-semibold text-ink-950'
      : state === 'suggested'
        ? 'bg-accent-400/10 text-accent-200 ring-2 ring-accent-400/60 ring-inset'
        : 'bg-ink-900 text-ink-300 ring-1 ring-ink-700 ring-inset active:bg-ink-800'
  return (
    <button
      type="button"
      aria-pressed={state === 'selected'}
      onClick={onClick}
      className={`min-h-11 rounded-full px-3.5 text-sm font-medium transition-colors ${look}`}
    >
      {label}
    </button>
  )
}
