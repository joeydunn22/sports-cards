import { useState, type Ref } from 'react'
import { inputClass } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { buttonSecondary, panel } from '../../components/ui'
import { useSpeech } from '../../hooks/useSpeech'

/** What a sentence filled: form labels, and the words that fit nothing. */
export type QuickResult = { filled: string[]; leftover: string }

const EXAMPLE = '“2011 Bowman Chrome Tyler Colvin red refractor 4 of 5”'

/** One box at the top of Add card: say (or type) the card, and the form fills in. */
export function QuickEntry({
  onFill,
  inputRef,
}: {
  onFill: (text: string) => Promise<QuickResult>
  inputRef?: Ref<HTMLInputElement>
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ said: string; filled: string[]; leftover: string } | null>(null)
  const speech = useSpeech({ onText: (heard) => void fill(heard) })

  async function fill(said: string) {
    if (!said.trim() || busy) return
    setBusy(true)
    try {
      const done = await onFill(said.trim())
      setResult({ said: said.trim(), ...done })
      // Keep what was said when nothing fit, so it can be fixed.
      setText(done.filled.length ? '' : said.trim())
    } finally {
      setBusy(false)
    }
  }

  const hint = speech.supported
    ? `Tap the mic and say the card, e.g. ${EXAMPLE}.`
    : `Tap the box, then the mic on your keyboard, and say the card, e.g. ${EXAMPLE}.`

  return (
    <section className={`${panel} p-4`}>
      <label htmlFor="quick-entry" className="mb-2 block text-sm font-medium text-slate-300">
        Say or type the card
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id="quick-entry"
          value={speech.listening ? speech.heard : text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            e.stopPropagation()
            void fill(text)
          }}
          placeholder={speech.listening ? 'Listening…' : 'Year, set, player, parallel, 4 of 5…'}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="done"
          readOnly={speech.listening}
          className={inputClass}
        />
        {speech.supported && (
          <button
            type="button"
            aria-label={speech.listening ? 'Stop listening' : 'Say the card'}
            aria-pressed={speech.listening}
            onClick={speech.listening ? speech.stop : speech.start}
            className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
              speech.listening
                ? 'animate-pulse border-red-400 bg-red-500 text-slate-950'
                : 'border-slate-700 bg-slate-900 text-slate-200 active:bg-slate-800'
            }`}
          >
            <Icon name={speech.listening ? 'stop' : 'mic'} size={20} />
          </button>
        )}
        {!speech.listening && text.trim() && (
          <button type="button" disabled={busy} onClick={() => void fill(text)} className={`${buttonSecondary} shrink-0`}>
            {busy ? 'Filling…' : 'Fill'}
          </button>
        )}
      </div>
      {speech.error ? (
        <p className="mt-2 text-xs text-amber-300">
          {speech.error} The mic on your keyboard works too.
        </p>
      ) : result ? (
        <p className="mt-2 text-xs" role="status">
          {result.filled.length ? (
            <span className="text-emerald-300">Filled {result.filled.join(', ')}.</span>
          ) : (
            <span className="text-amber-300">Couldn’t place anything in “{result.said}”.</span>
          )}
          {result.leftover && result.filled.length > 0 && (
            <span className="text-amber-300"> Didn’t place: “{result.leftover}”.</span>
          )}
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-500">{hint}</p>
      )}
    </section>
  )
}
