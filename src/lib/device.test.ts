import { describe, expect, it } from 'vitest'
import { biometricName, deviceName } from './device'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15'

describe('device names', () => {
  it('names the device and its built-in sign-in', () => {
    expect(deviceName(IPHONE)).toBe('iPhone')
    expect(biometricName(IPHONE)).toBe('Face ID')
    expect(biometricName(MAC)).toBe('Touch ID')
    expect(biometricName(WINDOWS)).toBe('Windows Hello')
    expect(biometricName('curl/8')).toBe('a passkey')
  })
})
