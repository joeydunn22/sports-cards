import { formatSerial } from '../../lib/format'
import type { Card } from '../../types/card'

const badge = 'rounded-full px-2 py-1 text-[10.5px] font-semibold leading-none tracking-[0.06em] tabular-nums'
const plain = `${badge} bg-ink-800 text-ink-300`

export function CardBadges({ card }: { card: Card }) {
  const serial = formatSerial(card.serial_number, card.print_run)
  const grade = card.is_graded ? [card.grade_company, card.grade].filter(Boolean).join(' ') || 'Graded' : ''
  const any = card.is_rookie || card.is_auto || card.is_relic || serial || grade
  if (!any) return null
  return (
    <span className="flex flex-wrap gap-1">
      {serial && <span className={`${badge} bg-accent-400/15 text-accent-300`}>{serial}</span>}
      {card.is_rookie && <span className={plain}>RC</span>}
      {card.is_auto && <span className={`${badge} bg-amber-400/12 text-amber-200`}>AUTO</span>}
      {card.is_relic && <span className={plain}>RELIC</span>}
      {grade && <span className={`${badge} bg-ink-100 text-ink-950`}>{grade}</span>}
    </span>
  )
}
