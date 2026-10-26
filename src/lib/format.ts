/** 23/99, or /99 when the exact serial is unknown; empty when not numbered. */
export function formatSerial(serialNumber?: number | null, printRun?: number | null): string {
  if (printRun == null) return ''
  return serialNumber == null ? `/${printRun}` : `${serialNumber}/${printRun}`
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function formatMoney(amount: number | null, { whole = false } = {}): string {
  if (amount == null) return ''
  return (whole ? usdWhole : usd).format(amount)
}

/** "v12" for a deployed build; "dev" for a local one. */
export function formatBuild(build: { version: number | null }): string {
  return build.version == null ? 'dev' : `v${build.version}`
}
