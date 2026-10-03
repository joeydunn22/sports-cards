import { formatSerial } from '../../lib/format'
import type { Card } from '../../types/card'

const badge = 'rounded-md px-1.5 py-1 text-[11px] font-bold leading-none tracking-wide'

export function CardBadges({ card }: { card: Card }) {
  const serial = formatSerial(card.serial_number, card.print_run)
  const grade = card.is_graded ? [card.grade_company, card.grade].filter(Boolean).join(' ') || 'Graded' : ''
  const any = card.is_rookie || card.is_auto || card.is_patch || card.is_relic || serial || grade
  if (!any) return null
  return (
    <span className="flex flex-wrap gap-1">
      {card.is_rookie && <span className={`${badge} bg-emerald-900 text-emerald-200`}>RC</span>}
      {card.is_auto && <span className={`${badge} bg-amber-900 text-amber-200`}>AUTO</span>}
      {card.is_patch && <span className={`${badge} bg-fuchsia-900 text-fuchsia-200`}>PATCH</span>}
      {card.is_relic && <span className={`${badge} bg-violet-900 text-violet-200`}>RELIC</span>}
      {serial && <span className={`${badge} bg-sky-900 text-sky-200`}>{serial}</span>}
      {grade && <span className={`${badge} bg-slate-700 text-slate-100`}>{grade}</span>}
    </span>
  )
}
