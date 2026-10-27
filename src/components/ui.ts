/** Shared class strings so buttons and panels look the same everywhere. */

const buttonBase =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 font-medium transition-[background-color,color,transform] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none'

export const buttonPrimary = `${buttonBase} bg-accent-400 text-ink-950 font-semibold hover:bg-accent-300 active:bg-accent-500`
export const buttonSecondary = `${buttonBase} bg-ink-800 text-ink-100 hover:bg-ink-700 active:bg-ink-700`
export const buttonGhost = `${buttonBase} text-ink-300 hover:text-ink-100 active:bg-ink-900`
export const buttonDanger = `${buttonBase} bg-red-500/10 text-red-300 hover:bg-red-500/15 active:bg-red-500/20`

export const panel = 'rounded-2xl bg-ink-900 ring-1 ring-white/[0.04]'
export const sectionTitle = 'text-[11px] font-semibold tracking-[0.08em] text-ink-500 uppercase'

/** iOS-style grouped list: rows with hairline dividers inside one rounded surface. */
export const listGroup = `${panel} divide-y divide-white/[0.05] overflow-hidden`
export const listRow = 'flex min-h-14 items-center gap-3 px-4 py-3 active:bg-ink-800'
