/** A short name for this device, used to label its passkey (e.g. "iPhone"). */
export function deviceName(userAgent: string): string {
  if (/iPhone/.test(userAgent)) return 'iPhone'
  if (/iPad/.test(userAgent)) return 'iPad'
  if (/Android/.test(userAgent)) return 'Android'
  if (/Macintosh/.test(userAgent)) return 'Mac'
  if (/Windows/.test(userAgent)) return 'Windows PC'
  return 'This device'
}

/** What the device calls its built-in sign-in, so buttons read naturally ("Sign in with Face ID"). */
export function biometricName(userAgent: string): string {
  switch (deviceName(userAgent)) {
    case 'iPhone':
    case 'iPad':
      return 'Face ID'
    case 'Mac':
      return 'Touch ID'
    case 'Windows PC':
      return 'Windows Hello'
    default:
      return 'a passkey'
  }
}
