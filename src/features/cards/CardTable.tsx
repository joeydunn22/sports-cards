import { Link, useNavigate } from 'react-router'
import { listGroup } from '../../components/ui'
import { CardBadges } from './CardBadges'
import { CardThumb } from './CardThumb'
import { teamColors } from './teamColors'
import type { CardTableInstance } from './useCardTable'

/** The list's current order, passed to the card screen for next/previous. */
const orderOf = (table: CardTableInstance) => ({ order: table.getRowModel().rows.map((row) => row.original.id) })

/** Desktop: sortable table; click a column header to sort, a row to open the card. */
export function CardTable({ table }: { table: CardTableInstance }) {
  const navigate = useNavigate()
  return (
    <div className={`${listGroup} overflow-x-auto`}>
      <table className="w-full text-left text-sm">
        <thead className="text-[12px] text-ink-500">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted()
                return (
                  <th key={header.id} className="px-3 py-3 font-medium whitespace-nowrap first:pl-5">
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={`inline-flex items-center gap-1 hover:text-ink-100 ${sorted ? 'text-accent-400' : ''}`}
                      >
                        <table.FlexRender header={header} />
                        <span aria-hidden className="text-[9px]">
                          {sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : ''}
                        </span>
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const colors = teamColors(row.original.team, row.original)
            return (
              <tr
                key={row.id}
                onClick={() => navigate(`/cards/${row.original.id}`, { state: orderOf(table) })}
                className="cursor-pointer border-t border-white/[0.05] text-ink-200 transition-colors hover:bg-ink-800/60"
              >
                {row.getAllCells().map((cell, i) => (
                  <td
                    key={cell.id}
                    className="relative px-3 py-2.5 whitespace-nowrap first:pl-5"
                  >
                    {i === 0 && colors && <TeamEdge color={colors.onDark} />}
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Phone: one tappable row per card, with the team's colour down the left edge. */
export function CardList({ table }: { table: CardTableInstance }) {
  const order = orderOf(table)
  return (
    <ul className={listGroup}>
      {table.getRowModel().rows.map(({ original: card }) => {
        const colors = teamColors(card.team, card)
        return (
          <li key={card.id} className="relative">
            {colors && <TeamEdge color={colors.onDark} />}
            <Link to={`/cards/${card.id}`} state={order} className="flex min-h-18 items-center gap-3.5 py-3 pr-4 pl-4 active:bg-ink-800">
              {card.front_image_path && <CardThumb path={card.front_image_path} className="w-12" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-semibold tracking-tight text-ink-50">
                  {card.player}
                  {card.quantity > 1 && <span className="font-normal text-ink-500"> ×{card.quantity}</span>}
                </p>
                <p className="truncate text-[13px] text-ink-400">
                  {card.year} {card.set_name} <span className="text-ink-600">#{card.card_number}</span>
                </p>
                {(card.insert_name || card.parallel) && (
                  <p className="truncate text-[13px] text-ink-300">
                    {[card.insert_name, card.parallel].filter(Boolean).join(' · ')}
                  </p>
                )}
                <div className="mt-1.5 empty:hidden">
                  <CardBadges card={card} />
                </div>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function TeamEdge({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute top-3 bottom-3 left-0 w-[3px] rounded-r-full"
      style={{ backgroundColor: color }}
    />
  )
}
