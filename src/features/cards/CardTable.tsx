import { Link, useNavigate } from 'react-router'
import { formatMoney } from '../../lib/format'
import { CardBadges } from './CardBadges'
import type { CardTableInstance } from './useCardTable'

/** Desktop: sortable table; click a column header to sort, a row to edit. */
export function CardTable({ table }: { table: CardTableInstance }) {
  const navigate = useNavigate()
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-900 text-slate-400">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted()
                return (
                  <th key={header.id} className="px-3 py-2 font-medium whitespace-nowrap">
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={`inline-flex items-center gap-1 hover:text-slate-100 ${sorted ? 'text-sky-400' : ''}`}
                      >
                        <table.FlexRender header={header} />
                        <span aria-hidden>{sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : ''}</span>
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
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => navigate(`/cards/${row.id}`)}
              className="cursor-pointer border-t border-slate-800 hover:bg-slate-900"
            >
              {row.getAllCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2 whitespace-nowrap">
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Phone: one tappable card per row. */
export function CardList({ table }: { table: CardTableInstance }) {
  return (
    <ul className="flex flex-col gap-2">
      {table.getRowModel().rows.map(({ original: card }) => (
        <li key={card.id}>
          <Link
            to={`/cards/${card.id}`}
            className="flex min-h-16 gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3 active:bg-slate-900"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {card.player}
                {card.quantity > 1 && <span className="text-slate-400"> ×{card.quantity}</span>}
              </p>
              <p className="truncate text-sm text-slate-400">
                {[`${card.year} ${card.set_name}`, card.insert_name, card.parallel, `#${card.card_number}`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <div className="mt-1.5">
                <CardBadges card={card} />
              </div>
            </div>
            {card.estimated_value != null && (
              <p className="shrink-0 text-sm text-slate-300">{formatMoney(card.estimated_value)}</p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}
