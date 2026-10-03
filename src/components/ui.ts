/** Shared class strings so buttons and panels look the same everywhere. */

const buttonBase =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none'

export const buttonPrimary = `${buttonBase} bg-sky-500 text-slate-950 font-semibold hover:bg-sky-400 active:bg-sky-600`
export const buttonSecondary = `${buttonBase} border border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-500 active:bg-slate-800`
export const buttonGhost = `${buttonBase} text-slate-300 hover:text-slate-100 active:bg-slate-900`
export const buttonDanger = `${buttonBase} border border-red-900/70 bg-red-950/40 text-red-300 hover:border-red-700 active:bg-red-950`

export const panel = 'rounded-2xl border border-slate-800 bg-slate-900/60'
export const sectionTitle = 'text-xs font-semibold tracking-wider text-slate-400 uppercase'
