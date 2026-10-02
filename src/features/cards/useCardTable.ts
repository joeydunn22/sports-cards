import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
  type SortingState,
} from '@tanstack/react-table'
import { formatMoney, formatSerial } from '../../lib/format'
import { createElement } from 'react'
import type { Card } from '../../types/card'
import { CardBadges } from './CardBadges'

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text, basic: sortFn_basic, alphanumeric: sortFn_alphanumeric },
})

const helper = createColumnHelper<typeof features, Card>()

/** Optional columns map null to undefined so `sortUndefined: 'last'` keeps blanks at the bottom. */
const columns = helper.columns([
  helper.accessor('player', { header: 'Player', sortFn: 'text' }),
  helper.accessor('year', { header: 'Year', sortFn: 'text', sortDescFirst: true }),
  helper.accessor('set_name', { header: 'Set', sortFn: 'text' }),
  helper.accessor((c) => c.insert_name ?? undefined, {
    id: 'insert_name',
    header: 'Insert',
    sortFn: 'text',
    sortUndefined: 'last',
  }),
  helper.accessor((c) => c.parallel ?? undefined, {
    id: 'parallel',
    header: 'Parallel',
    sortFn: 'text',
    sortUndefined: 'last',
  }),
  helper.accessor('card_number', { header: '#', sortFn: 'alphanumeric' }),
  helper.accessor('sport', { header: 'Sport', sortFn: 'text' }),
  helper.accessor((c) => c.team ?? undefined, { id: 'team', header: 'Team', sortFn: 'text', sortUndefined: 'last' }),
  helper.display({ id: 'flags', header: '', cell: (info) => createElement(CardBadges, { card: info.row.original }) }),
  helper.accessor((c) => c.print_run ?? undefined, {
    id: 'print_run',
    header: 'Numbered',
    sortFn: 'basic',
    sortUndefined: 'last',
    cell: (info) => formatSerial(info.row.original.serial_number, info.row.original.print_run),
  }),
  helper.accessor('quantity', { header: 'Qty', sortFn: 'basic', sortDescFirst: true }),
  helper.accessor((c) => c.estimated_value ?? undefined, {
    id: 'estimated_value',
    header: 'Value',
    sortFn: 'basic',
    sortUndefined: 'last',
    sortDescFirst: true,
    cell: (info) => formatMoney(info.row.original.estimated_value),
  }),
  helper.accessor('created_at', {
    header: 'Added',
    sortFn: 'text',
    sortDescFirst: true,
    cell: (info) => new Date(info.row.original.created_at).toLocaleDateString(),
  }),
])

/** One sorted table instance drives both the phone list and the desktop table. */
export function useCardTable(data: Card[], sorting: SortingState, setSorting: (s: SortingState) => void) {
  return useTable({
    features,
    columns,
    data,
    getRowId: (card) => card.id,
    state: { sorting },
    onSortingChange: (updater) => setSorting(typeof updater === 'function' ? updater(sorting) : updater),
    enableSortingRemoval: false,
  })
}

export type CardTableInstance = ReturnType<typeof useCardTable>

export const SORT_OPTIONS: { label: string; sorting: SortingState }[] = [
  { label: 'Recently added', sorting: [{ id: 'created_at', desc: true }] },
  { label: 'Player A–Z', sorting: [{ id: 'player', desc: false }] },
  { label: 'Year, newest', sorting: [{ id: 'year', desc: true }] },
  { label: 'Year, oldest', sorting: [{ id: 'year', desc: false }] },
  { label: 'Set A–Z', sorting: [{ id: 'set_name', desc: false }] },
  { label: 'Value, highest', sorting: [{ id: 'estimated_value', desc: true }] },
  { label: 'Print run, lowest', sorting: [{ id: 'print_run', desc: false }] },
]

export const DEFAULT_SORTING = SORT_OPTIONS[0].sorting
