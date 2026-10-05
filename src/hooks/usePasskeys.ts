import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IS_DEMO } from '../dev/demo'
import { biometricName, deviceName } from '../lib/device'
import { supabase } from '../lib/supabase'

/**
 * Face ID sign-in through Supabase Auth passkeys. The passkey lives in the phone's keychain; Supabase
 * keeps only its public key, so the data stays as private as with a password (RLS is unchanged).
 */
export const PASSKEYS_SUPPORTED = typeof window !== 'undefined' && 'PublicKeyCredential' in window
export const BIOMETRIC = typeof navigator === 'undefined' ? 'a passkey' : biometricName(navigator.userAgent)

const PASSKEYS_KEY = ['passkeys'] as const
/** Set once this device has a passkey, so the login screen leads with Face ID here. */
const DEVICE_FLAG = 'sports-cards:passkey-on-device'

export function hasPasskeyOnDevice(): boolean {
  try {
    return localStorage.getItem(DEVICE_FLAG) === '1'
  } catch {
    return false
  }
}

function setPasskeyOnDevice(on: boolean) {
  try {
    if (on) localStorage.setItem(DEVICE_FLAG, '1')
    else localStorage.removeItem(DEVICE_FLAG)
  } catch {
    // Not critical: the login screen just leads with the password form.
  }
}

/** Plain-language errors for the cases people actually hit. */
function friendly(error: { name?: string; message: string }): Error {
  if (error.name === 'NotAllowedError' || /not allowed|cancel|abort/i.test(error.message)) {
    return new Error(`${BIOMETRIC} was cancelled or timed out.`)
  }
  if (/passkey|webauthn/i.test(error.message) && /disabled|not enabled|not configured/i.test(error.message)) {
    return new Error('Passkeys aren’t turned on in Supabase yet (Authentication → Passkeys).')
  }
  return new Error(error.message)
}

export async function signInWithPasskey() {
  const { error } = await supabase.auth.signInWithPasskey()
  if (error) throw friendly(error)
  setPasskeyOnDevice(true)
}

export function usePasskeys() {
  return useQuery({
    queryKey: PASSKEYS_KEY,
    queryFn: async () => {
      if (IS_DEMO) return []
      const { data, error } = await supabase.auth.passkey.list()
      if (error) throw friendly(error)
      return data
    },
  })
}

/** Adds a passkey for this device (the phone asks for Face ID), named after the device. */
export function useAddPasskey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.auth.registerPasskey()
      if (error) throw friendly(error)
      setPasskeyOnDevice(true)
      // The name is only a label in the list; failing to set it isn't worth an error.
      await supabase.auth.passkey.update({ passkeyId: data.id, friendlyName: deviceName(navigator.userAgent) })
      return data
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: PASSKEYS_KEY }),
  })
}

export function useRemovePasskey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (passkeyId: string) => {
      const { error } = await supabase.auth.passkey.delete({ passkeyId })
      if (error) throw friendly(error)
      // We can't tell which device a passkey belongs to, so this device falls back to the password screen.
      setPasskeyOnDevice(false)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: PASSKEYS_KEY }),
  })
}
