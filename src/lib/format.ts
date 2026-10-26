/** 23/99, or /99 when the exact serial is unknown; empty when not numbered. */
export function formatSerial(serialNumber?: number | null, printRun?: number | null): string {
  if (printRun == null) return ''
  return serialNumber == null ? `/${printRun}` : `${serialNumber}/${printRun}`
}

/** "v12" for a deployed build; "dev" for a local one. */
export function formatBuild(build: { version: number | null }): string {
  return build.version == null ? 'dev' : `v${build.version}`
}
