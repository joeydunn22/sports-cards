/** 23/99, or /99 when the exact serial is unknown; empty when not numbered. */
export function formatSerial(serialNumber: number | null, printRun: number | null): string {
  if (printRun == null) return ''
  return serialNumber == null ? `/${printRun}` : `${serialNumber}/${printRun}`
}
