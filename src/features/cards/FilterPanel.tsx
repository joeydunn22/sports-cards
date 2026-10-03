import { inputClass } from '../../components/Field'
import { ToggleChip } from '../../components/ToggleChip'
import { panel, sectionTitle } from '../../components/ui'
import type { Card } from '../../types/card'
import {
  distinctValues,
  emptyFilters,
  FILTER_FIELDS,
  FLAG_FILTERS,
  type CardFilters,
  type FilterField,
  type FlagFilter,
  type Ownership,
} from './collection'

const FIELD_LABELS: Record<FilterField, string> = {
  sport: 'Sport',
  year: 'Year',
  set_name: 'Set',
  insert_name: 'Insert',
  parallel: 'Parallel',
  team: 'Team',
  player: 'Player',
}

const OWNERSHIP: [Ownership, string][] = [
  ['owned', 'Owned'],
  ['sold', 'Sold'],
  ['all', 'All'],
]

type FilterPanelProps = {
  cards: Card[]
  filters: CardFilters
  onChange: (filters: CardFilters) => void
}

export function FilterPanel({ cards, filters, onChange }: FilterPanelProps) {
  function setField(field: FilterField, value: string) {
    onChange({ ...filters, fields: { ...filters.fields, [field]: value } })
  }

  function toggleFlag(flag: FlagFilter) {
    const flags = filters.flags.includes(flag) ? filters.flags.filter((f) => f !== flag) : [...filters.flags, flag]
    onChange({ ...filters, flags })
  }

  return (
    <div className={`${panel} flex flex-col gap-4 p-4`}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FILTER_FIELDS.map((field) => (
          <label key={field} className="flex flex-col gap-1 text-sm font-medium text-slate-300">
            {FIELD_LABELS[field]}
            <select
              value={filters.fields[field] ?? ''}
              onChange={(e) => setField(field, e.target.value)}
              className={inputClass}
            >
              <option value="">Any</option>
              {distinctValues(cards, field).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <p className={sectionTitle}>Must have</p>
      <div className="-mt-2 flex flex-wrap gap-2" aria-label="Must have">
        {(Object.keys(FLAG_FILTERS) as FlagFilter[]).map((flag) => (
          <ToggleChip
            key={flag}
            label={FLAG_FILTERS[flag]}
            pressed={filters.flags.includes(flag)}
            onToggle={() => toggleFlag(flag)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl bg-slate-950 p-1" role="group" aria-label="Show">
          {OWNERSHIP.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.ownership === value}
              onClick={() => onChange({ ...filters, ownership: value })}
              className={`min-h-10 rounded-lg px-4 text-sm font-medium ${
                filters.ownership === value ? 'bg-slate-700 text-slate-100' : 'text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...emptyFilters, search: filters.search })}
          className="min-h-11 text-sm font-medium text-sky-400 hover:text-sky-300"
        >
          Clear filters
        </button>
      </div>
    </div>
  )
}
