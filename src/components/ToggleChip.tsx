type ToggleChipProps = {
  label: string
  pressed: boolean
  onToggle: () => void
}

/** One-tap on/off chip for yes/no card attributes and filters. */
export function ToggleChip({ label, pressed, onToggle }: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors ${
        pressed
          ? 'border-sky-400 bg-sky-500 text-slate-950'
          : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 active:bg-slate-800'
      }`}
    >
      {pressed && <span aria-hidden>✓ </span>}
      {label}
    </button>
  )
}
