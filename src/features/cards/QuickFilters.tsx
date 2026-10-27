import { emptyFilters, type CardFilters, type FlagFilter } from './collection'
import { sameFilters, type SavedFilter } from './savedFilters'

const BUILT_IN: [FlagFilter, string][] = [
  ['is_rookie', 'Rookies'],
  ['is_auto', 'Autos'],
  ['is_relic', 'Relics'],
  ['numbered', 'Numbered'],
  ['is_graded', 'Graded'],
]

const chip = 'min-h-11 shrink-0 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors active:scale-[0.97]'
const on = 'bg-accent-400 font-semibold text-ink-950'
const off = 'bg-ink-900 text-ink-300 ring-1 ring-ink-700 ring-inset active:bg-ink-800'

type QuickFiltersProps = { filters: CardFilters; saved: SavedFilter[]; onChange: (filters: CardFilters) => void }

/** One-tap filters above the list: the yes/no flags, then the collector's saved filters. */
export function QuickFilters({ filters, saved, onChange }: QuickFiltersProps) {
  function toggle(flag: FlagFilter) {
    const flags = filters.flags.includes(flag) ? filters.flags.filter((f) => f !== flag) : [...filters.flags, flag]
    onChange({ ...filters, flags })
  }

  return (
    <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {saved.map((s) => {
        const active = sameFilters(s.filters, filters)
        return (
          <button
            key={s.name}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? { ...emptyFilters } : s.filters)}
            className={`${chip} ${active ? on : off}`}
          >
            ★ {s.name}
          </button>
        )
      })}
      {BUILT_IN.map(([flag, label]) => {
        const active = filters.flags.includes(flag)
        return (
          <button key={flag} type="button" aria-pressed={active} onClick={() => toggle(flag)} className={`${chip} ${active ? on : off}`}>
            {label}
          </button>
        )
      })}
    </div>
  )
}
