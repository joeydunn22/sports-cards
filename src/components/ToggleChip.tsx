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
      className={`min-h-11 rounded-full px-4 text-sm font-medium transition-colors active:scale-[0.97] ${
        pressed
          ? 'bg-accent-400 font-semibold text-ink-950'
          : 'bg-ink-900 text-ink-300 ring-1 ring-ink-700 ring-inset hover:text-ink-100 active:bg-ink-800'
      }`}
    >
      {label}
    </button>
  )
}
