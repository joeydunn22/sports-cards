import type { TeamColors } from './teamColors'

/** The team's colour washing in behind the top of a card screen, fading to the page. */
export function TeamWash({ colors }: { colors: TeamColors | null }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] md:rounded-b-[3rem]"
      style={{
        background: `radial-gradient(120% 70% at 50% 0%, ${colors ? `${colors.primary}66` : 'rgba(255,255,255,0.05)'}, transparent 75%)`,
      }}
    />
  )
}

/** A hairline in the team's colour, between the card's photos and what follows. */
export function TeamRule({ colors }: { colors: TeamColors | null }) {
  return (
    <div
      aria-hidden
      className="mb-6 h-px"
      style={{
        background: `linear-gradient(90deg, transparent, ${colors?.onDark ?? 'rgba(255,255,255,0.12)'}, transparent)`,
      }}
    />
  )
}
