import { useState } from 'react'
import { inputClass } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { ToggleChip } from '../../components/ToggleChip'
import { buttonSecondary, panel, sectionTitle } from '../../components/ui'
import type { useSavedFilters } from '../../hooks/useSavedFilters'
import type { Card } from '../../types/card'
import {
  countActiveFilters,
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
  saved: ReturnType<typeof useSavedFilters>
}

export function FilterPanel({ cards, filters, onChange, saved }: FilterPanelProps) {
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
          <label key={field} className="flex flex-col gap-1 text-[13px] font-medium text-ink-400">
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
        <div className="flex rounded-full bg-ink-950 p-1" role="group" aria-label="Show">
          {OWNERSHIP.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.ownership === value}
              onClick={() => onChange({ ...filters, ownership: value })}
              className={`min-h-10 rounded-full px-4 text-sm font-medium transition-colors ${
                filters.ownership === value ? 'bg-ink-700 text-ink-50' : 'text-ink-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...emptyFilters, search: filters.search })}
          className="min-h-11 text-sm font-medium text-accent-400 hover:text-accent-300"
        >
          Clear filters
        </button>
      </div>

      <SaveFilters filters={filters} saved={saved} />
    </div>
  )
}

/** Name the current filters to keep them as a chip above the list; remove old ones. */
function SaveFilters({ filters, saved }: { filters: CardFilters; saved: FilterPanelProps['saved'] }) {
  const [name, setName] = useState('')
  const anything = countActiveFilters(filters) > 0 || filters.search.trim() !== ''
  if (!anything && saved.list.length === 0) return null
  return (
    <div className="flex flex-col gap-2 border-t border-white/[0.05] pt-4">
      <p className={sectionTitle}>Saved filters</p>
      {anything && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            saved.save(name, filters)
            setName('')
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name these filters, e.g. Reds rookies"
            aria-label="Name for these filters"
            enterKeyHint="done"
            className={inputClass}
          />
          <button type="submit" disabled={!name.trim()} className={`${buttonSecondary} shrink-0`}>
            Save
          </button>
        </form>
      )}
      {saved.list.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {saved.list.map((s) => (
            <li key={s.name} className="flex items-center rounded-full bg-ink-800 pl-3.5 text-sm text-ink-200">
              {s.name}
              <button
                type="button"
                onClick={() => saved.remove(s.name)}
                aria-label={`Remove saved filter ${s.name}`}
                className="grid size-11 place-items-center text-ink-400 active:text-ink-100"
              >
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
