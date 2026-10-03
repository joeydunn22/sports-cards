import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Icon } from '../../components/Icon'
import { buttonPrimary, buttonSecondary, panel } from '../../components/ui'
import { useCreateScans, useReadScans, type ScanUpload } from '../../hooks/useScans'
import { cropCard, loadImage, type CardCrop } from '../../lib/photos'
import { getAiModel } from './aiModel'
import { cardSpots, initialOrder, swap, type CapturedPhoto, type CardSpot } from './captureState'
import { CropPreview } from './CropPreview'
import { PhotoStep } from './PhotoStep'

type Step = 'fronts' | 'backs' | 'pairs'

const TIPS = [
  'Lay cards on a dark, non-shiny surface with a finger’s width between them.',
  'Use soft, even light from the side. No flash, and no lamp straight overhead.',
  'Hold the phone flat above the cards so the whole layout fills the frame.',
]

export function CapturePage() {
  const navigate = useNavigate()
  const createScans = useCreateScans()
  const readScans = useReadScans()
  const [step, setStep] = useState<Step>('fronts')
  const [fronts, setFronts] = useState<CapturedPhoto[]>([])
  const [backs, setBacks] = useState<CapturedPhoto[]>([])
  const [order, setOrder] = useState<number[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  // Kept across retries: the cut-out cards, and how many of them are already in the inbox.
  const crops = useRef<ScanUpload[] | null>(null)
  const [uploaded, setUploaded] = useState(0)

  const frontSpots = useMemo(() => cardSpots(fronts), [fronts])
  const backSpots = useMemo(() => cardSpots(backs), [backs])
  const countsMatch = backSpots.length === frontSpots.length
  const hasWork = fronts.length > 0 || backs.length > 0

  // Warn before a reload or tab close throws away photos that haven't been uploaded.
  useEffect(() => {
    if (!hasWork || createScans.isSuccess) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasWork, createScans.isSuccess])

  function cancel() {
    if (hasWork && !window.confirm('Discard these photos?')) return
    navigate('/scan')
  }

  function goToPairs(withBacks: boolean) {
    if (!withBacks) setBacks([])
    setOrder(initialOrder(frontSpots.length))
    setSelected(null)
    crops.current = null
    setStep('pairs')
  }

  function tapBack(index: number) {
    if (uploaded > 0) return // pairs are locked once some cards are in the inbox
    if (selected === null) return setSelected(index)
    if (selected !== index) setOrder(swap(order, selected, index))
    setSelected(null)
    crops.current = null
  }

  async function upload() {
    // Progress: the first half is cutting cards out, the second half is uploading them.
    const items =
      crops.current ??
      (await cropAll(frontSpots, backs.length ? backSpots : [], order, (done, total) =>
        setProgress({ done, total: total * 2 }),
      ))
    crops.current = items
    const total = items.length * 2
    const start = uploaded
    setProgress({ done: items.length + start, total })
    await createScans.mutateAsync({
      items: items.slice(start),
      onProgress: (done) => {
        setUploaded(start + done)
        setProgress({ done: items.length + start + done, total })
      },
    })
    // Hand the new cards to the AI right away; if this fails, the inbox has a button to retry.
    readScans.mutate({ model: getAiModel() })
  }

  function reset() {
    for (const photo of [...fronts, ...backs]) URL.revokeObjectURL(photo.url)
    setFronts([])
    setBacks([])
    setOrder([])
    setProgress(null)
    setStep('fronts')
    crops.current = null
    setUploaded(0)
    createScans.reset()
    readScans.reset()
  }

  if (createScans.isSuccess) {
    return (
      <Shell title="Scan cards" onCancel={() => navigate('/scan')}>
        <section className={`${panel} flex flex-col items-center gap-4 px-6 py-10 text-center`}>
          <span className="grid size-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
            <Icon name="check" size={30} />
          </span>
          <div>
            <p className="text-lg font-semibold">
              {frontSpots.length} {frontSpots.length === 1 ? 'card' : 'cards'} added to your inbox
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {readScans.isError
                ? 'They couldn’t be sent to the AI yet; you can send them from the inbox.'
                : 'The AI is reading them now. Review them whenever you’re ready.'}
            </p>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <Link to="/scan" className={buttonPrimary}>
              <Icon name="inbox" size={18} /> Go to inbox
            </Link>
            <button type="button" onClick={reset} className={buttonSecondary}>
              <Icon name="camera" size={18} /> Scan more
            </button>
          </div>
        </section>
      </Shell>
    )
  }

  return (
    <Shell title="Scan cards" onCancel={cancel}>
      <ol className="mb-4 grid grid-cols-3 gap-2 text-center text-xs font-medium" aria-label="Steps">
        {(['fronts', 'backs', 'pairs'] as const).map((s, i) => (
          <li
            key={s}
            aria-current={step === s ? 'step' : undefined}
            className={`rounded-full py-2 ${step === s ? 'bg-sky-500 text-slate-950' : 'bg-slate-900 text-slate-400'}`}
          >
            {i + 1}. {s === 'fronts' ? 'Fronts' : s === 'backs' ? 'Backs' : 'Check'}
          </li>
        ))}
      </ol>

      {step === 'fronts' && (
        <>
          {fronts.length === 0 && (
            <section className={`${panel} mb-3 p-4`}>
              <p className="font-semibold">Photograph the fronts</p>
              <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm text-slate-300">
                {TIPS.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </section>
          )}
          <PhotoStep photos={fronts} onChange={setFronts} />
          <ActionBar>
            <button
              type="button"
              disabled={frontSpots.length === 0}
              onClick={() => setStep('backs')}
              className={`${buttonPrimary} min-h-12 flex-1`}
            >
              Next: backs ({frontSpots.length} {frontSpots.length === 1 ? 'card' : 'cards'})
            </button>
          </ActionBar>
        </>
      )}

      {step === 'backs' && (
        <>
          {backs.length === 0 && (
            <section className={`${panel} mb-3 p-4`}>
              <p className="font-semibold">Now flip each card over where it lies</p>
              <p className="mt-1 text-sm text-slate-300">
                Keep the same layout and take the photos in the same order, so each back lines up with its front.
                The back is where the year and card number usually are.
              </p>
            </section>
          )}
          <PhotoStep photos={backs} onChange={setBacks} />
          {backs.length > 0 && !countsMatch && (
            <p className="mt-3 rounded-xl bg-amber-950/60 px-3 py-2 text-sm text-amber-200">
              {backSpots.length} backs for {frontSpots.length} fronts. Adjust the counts above so they match.
            </p>
          )}
          <ActionBar>
            <button type="button" onClick={() => goToPairs(false)} className={`${buttonSecondary} min-h-12 flex-1`}>
              Skip backs
            </button>
            <button
              type="button"
              disabled={backs.length === 0 || !countsMatch}
              onClick={() => goToPairs(true)}
              className={`${buttonPrimary} min-h-12 flex-[2]`}
            >
              Next: check pairs
            </button>
          </ActionBar>
        </>
      )}

      {step === 'pairs' && (
        <>
          <p className="mb-3 text-sm text-slate-400">
            {backs.length
              ? 'Each row is one card. If a back is with the wrong front, tap it, then tap the one to swap with.'
              : 'Fronts only. You can add back photos later from each card.'}
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {frontSpots.map((front, i) => {
              const back = backs.length ? backSpots[order[i]] : null
              return (
                <li key={i} className={`${panel} flex flex-col gap-2 p-2`}>
                  <span className="text-xs font-semibold text-slate-400">Card {i + 1}</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <SpotPreview spot={front} />
                    {back ? (
                      <button
                        type="button"
                        aria-label={`Back of card ${i + 1}${selected === i ? ' (selected)' : ''}`}
                        aria-pressed={selected === i}
                        onClick={() => tapBack(i)}
                        className={`rounded-md ${selected === i ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-900' : ''}`}
                      >
                        <SpotPreview spot={back} />
                      </button>
                    ) : (
                      <div className="grid place-items-center rounded-md border border-dashed border-slate-700 text-xs text-slate-500">
                        No back
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          {createScans.isError && (
            <p className="mt-3 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-300">
              Upload stopped: {createScans.error.message}. Cards already uploaded are in your inbox; tap Upload to
              retry the rest.
            </p>
          )}
          <ActionBar>
            <button
              type="button"
              disabled={(progress !== null && !createScans.isError) || uploaded > 0}
              onClick={() => setStep(backs.length ? 'backs' : 'fronts')}
              className={`${buttonSecondary} min-h-12 flex-1`}
            >
              Back
            </button>
            <button
              type="button"
              disabled={progress !== null && !createScans.isError}
              onClick={() => {
                createScans.reset()
                upload().catch(() => setProgress(null))
              }}
              className={`${buttonPrimary} min-h-12 flex-[2]`}
            >
              {progress && !createScans.isError
                ? `Uploading… ${Math.round((progress.done / progress.total) * 100)}%`
                : `Upload ${frontSpots.length} ${frontSpots.length === 1 ? 'card' : 'cards'}`}
            </button>
          </ActionBar>
        </>
      )}
    </Shell>
  )
}

function SpotPreview({ spot }: { spot: CardSpot }) {
  return <CropPreview url={spot.photo.url} box={spot.box} width={spot.photo.width} height={spot.photo.height} />
}

/** Cuts every card out of the full-size photos, decoding each photo only once. */
async function cropAll(
  fronts: CardSpot[],
  backs: CardSpot[],
  order: number[],
  onProgress: (done: number, total: number) => void,
): Promise<ScanUpload[]> {
  const crops = new Map<CardSpot, CardCrop>()
  const all = [...fronts, ...backs]
  const byPhoto = new Map<CapturedPhoto, CardSpot[]>()
  for (const spot of all) byPhoto.set(spot.photo, [...(byPhoto.get(spot.photo) ?? []), spot])
  let done = 0
  for (const [photo, spots] of byPhoto) {
    const img = await loadImage(photo.file)
    for (const spot of spots) {
      crops.set(spot, await cropCard(img, spot.box))
      onProgress(++done, all.length)
    }
  }
  return fronts.map((front, i) => ({
    front: crops.get(front)!,
    back: backs.length ? crops.get(backs[order[i]])! : null,
  }))
}

function Shell({ title, onCancel, children }: { title: string; onCancel: () => void; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-4 pt-[env(safe-area-inset-top)] pb-28 md:pt-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <button type="button" onClick={onCancel} className="min-h-11 px-2 text-sm font-medium text-sky-400">
          Cancel
        </button>
      </header>
      {children}
    </main>
  )
}

function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-800 bg-slate-950/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mx-auto flex max-w-3xl gap-3">{children}</div>
    </div>
  )
}
