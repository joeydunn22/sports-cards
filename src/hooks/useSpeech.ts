import { useCallback, useEffect, useRef, useState } from 'react'

// The browser's speech recognition (Web Speech API). TypeScript's DOM types don't include it yet.
type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type RecognitionClass = new () => Recognition

function recognitionClass(): RecognitionClass | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'The microphone isn’t allowed for this app.',
  'service-not-allowed': 'Speech recognition isn’t available here.',
  'no-speech': 'Didn’t hear anything. Try again.',
  'audio-capture': 'No microphone found.',
  network: 'Speech recognition needs a connection.',
}

/**
 * One spoken sentence, through the browser's own speech recognition. `supported` is false where the
 * browser has none; the keyboard's dictation key works in any text box regardless.
 */
export function useSpeech({ onText }: { onText: (text: string) => void }) {
  const [supported] = useState(() => recognitionClass() != null)
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognition = useRef<Recognition | null>(null)
  const latest = useRef(onText)
  useEffect(() => {
    latest.current = onText
  })
  useEffect(() => () => recognition.current?.abort(), [])

  const start = useCallback(() => {
    const Speech = recognitionClass()
    if (!Speech || recognition.current) return
    const r = new Speech()
    r.lang = 'en-US'
    r.interimResults = true
    r.continuous = false
    let final = ''
    r.onresult = (event) => {
      let text = ''
      for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript
      setHeard(text)
      if (event.results[event.results.length - 1].isFinal) final = text
    }
    r.onerror = (event) => {
      if (event.error !== 'aborted') setError(ERRORS[event.error] ?? `Speech recognition stopped (${event.error}).`)
    }
    r.onend = () => {
      recognition.current = null
      setListening(false)
      setHeard('')
      if (final.trim()) latest.current(final.trim())
    }
    setError(null)
    setHeard('')
    try {
      r.start()
      recognition.current = r
      setListening(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speech recognition didn’t start.')
    }
  }, [])

  const stop = useCallback(() => recognition.current?.stop(), [])

  return { supported, listening, heard, error, start, stop }
}
