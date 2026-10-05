import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { buttonDanger, buttonSecondary } from '../../components/ui'
import { NO_CARDS, useCards } from '../../hooks/useCards'
import {
  NO_SCANS,
  useConfirmScan,
  useDeleteScan,
  useLookupScans,
  useMergeScan,
  useRereadScans,
  useScanPolling,
  useScans,
} from '../../hooks/useScans'
import type { Card, CardScan } from '../../types/card'
import { CardForm } from '../cards/CardForm'
import { CardPhotos } from '../cards/CardPhotos'
import { toCardInput, type CardFormValues } from '../cards/cardSchema'
import { buildSuggestions, rememberSport } from '../cards/suggestions'
import { formatCost } from '../ai/costEstimate'
import { lookupRequest, readRequest } from '../ai/requests'
import { useAiApproval } from '../ai/useAiApproval'
import { AI_MODELS, getAiModel } from './aiModel'
import { asExtraction, extractionCost, fieldLabel, fieldNotes, sortForReview, type Extraction } from './extraction'
import { rememberScanValues, scanFormValues } from './scanDefaults'

/** Check one scanned card's details, then save it to the collection. */
export function ReviewScanPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: scansData, isPending } = useScans()
  const { data: cardsData } = useCards()
  // Same order as the inbox, so "Save & next" walks the ready cards first.
  const scans = useMemo(() => sortForReview(scansData ?? NO_SCANS), [scansData])
  const cards = cardsData ?? NO_CARDS
  const suggestions = useMemo(() => buildSuggestions(cards), [cards])
  const confirmScan = useConfirmScan()
  const mergeScan = useMergeScan()
  const deleteScan = useDeleteScan()
  const reread = useRereadScans()
  const lookup = useLookupScans()
  const ai = useAiApproval()
  useScanPolling(scans)

  const index = scans.findIndex((s) => s.id === id)
  const scan = scans[index]
  // After this one, go to the next card in the inbox (or the one before, at the end).
  const nextId = scans[index + 1]?.id ?? scans[index - 1]?.id
  const goNext = () => navigate(nextId ? `/scan/${nextId}` : '/scan', { replace: true })
  // The form only reads these when it mounts; its key changes when the AI result arrives.
  const initialValues = useMemo(() => (scan ? scanFormValues(scan) : null), [scan])
  const extraction = scan ? asExtraction(scan.extraction) : null
  const read = scan?.status === 'ready' || scan?.status === 'looking_up'
  const notes = read && extraction ? fieldNotes(extraction) : {}
  const cost = extraction ? extractionCost(extraction) : null

  if (isPending) return <p className="p-6 text-slate-400">Loading…</p>
  if (!scan || !initialValues) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-slate-300">That card isn’t in the inbox any more.</p>
        <Link to="/scan" className={`${buttonSecondary} mt-4`}>
          Back to inbox
        </Link>
      </main>
    )
  }

  async function rereadWith(model: string) {
    const ok = await ai.approve(readRequest(1, model, ai.estimate.read(1, model), ai.autoLookup))
    if (ok) reread.mutate({ model, ids: [scan!.id] })
  }

  // The checklist pass runs on the model that read the card.
  const lookupModel = extraction?.model ?? getAiModel()
  async function lookUp() {
    const ok = await ai.approve(lookupRequest(1, lookupModel, ai.estimate.lookup(1, lookupModel)))
    if (ok) lookup.mutate([scan!.id])
  }

  async function handleSubmit(values: CardFormValues, { mergeInto }: { mergeInto?: Card }) {
    const input = toCardInput(values)
    if (mergeInto) await mergeScan.mutateAsync({ scan: scan!, card: mergeInto, quantity: input.quantity ?? 1 })
    else await confirmScan.mutateAsync({ scan: scan!, input })
    rememberScanValues(values)
    rememberSport(input.sport)
    goNext()
  }

  function handleDiscard() {
    if (!window.confirm('Discard this card and its photos?')) return
    deleteScan.mutate(scan!)
    goNext()
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pt-[env(safe-area-inset-top)] md:pt-4">
      <PageHeader
        title="Review card"
        subtitle={`${index + 1} of ${scans.length} in the inbox`}
        backTo="/scan"
        backLabel="Inbox"
      />
      <CardPhotos front={scan.front_image_path} back={scan.back_image_path} />
      <AiStatus
        scan={scan}
        extraction={extraction}
        cost={cost}
        busy={reread.isPending || lookup.isPending}
        lookupCost={formatCost(ai.estimate.lookup(1, lookupModel).expected)}
        onReread={(model) => void rereadWith(model)}
        onLookup={() => void lookUp()}
      />
      {ai.dialog}
      {(reread.error ?? lookup.error) && (
        <p className="mb-4 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-300">
          {(reread.error ?? lookup.error)!.message}
        </p>
      )}
      <CardForm
        key={`${scan.id}:${scan.updated_at}`}
        fieldNotes={notes}
        mode="edit"
        submitLabel={nextId ? 'Save & next' : 'Save card'}
        initialValues={initialValues}
        suggestions={suggestions}
        duplicates={{ cards, askOnSave: true }}
        onSubmit={handleSubmit}
        footer={
          <button type="button" onClick={handleDiscard} className={`${buttonDanger} mt-2 min-h-12`}>
            <Icon name="trash" size={18} /> Discard
          </button>
        }
      />
    </main>
  )
}

type AiStatusProps = {
  scan: CardScan
  extraction: Extraction | null
  cost: { dollars: number; model: string } | null
  busy: boolean
  lookupCost: string
  onReread: (model: string) => void
  onLookup: () => void
}

const callout = 'rounded-xl px-3 py-2 text-sm'

/** What the AI made of this card, and ways to have it look again (another model, or the set's checklist). */
function AiStatus({ scan, extraction: e, cost, busy, lookupCost, onReread, onLookup }: AiStatusProps) {
  const [model, setModel] = useState(getAiModel)
  const { status } = scan
  const lookup = e?.lookup
  const working = status === 'processing' || status === 'looking_up'
  const canLookUp = status === 'ready' && e != null && !lookup
  return (
    <section className="mb-4 flex flex-col gap-2">
      {status === 'processing' && (
        <p className={`${callout} bg-sky-950/60 text-sky-200`}>
          The AI is reading this card. Results usually arrive within a few minutes; this page updates by itself.
        </p>
      )}
      {status === 'looking_up' && (
        <p className={`${callout} bg-sky-950/60 text-sky-200`}>
          The AI wasn’t sure about {listFields(e?.uncertain_fields) || 'part of this card'}, so it’s checking the set’s
          checklist. You can save now or wait; this page updates by itself.
        </p>
      )}
      {status === 'failed' && scan.error && <p className={`${callout} bg-amber-950/60 text-amber-200`}>{scan.error}</p>}
      {status === 'ready' && e?.retake && (
        <p className={`${callout} bg-amber-950/60 text-amber-200`}>
          <strong>Retake suggested:</strong> {e.retake}
        </p>
      )}
      {status === 'ready' && e?.triage === 'unidentified' && (
        <p className={`${callout} bg-amber-950/60 text-amber-200`}>
          The AI couldn’t read enough of this card to look it up ({listFields(e.uncertain_fields)}). Fill in what it
          missed, or retake the photo.
        </p>
      )}
      {status === 'ready' && e?.triage === 'lookup' && !lookup && (
        <p className={`${callout} bg-slate-900 text-slate-300`}>
          The AI suggests checking the set’s checklist for {listFields(e.uncertain_fields) || 'this card'}. Automatic
          checklist searches are off; use “Check checklist” below.
        </p>
      )}
      {lookup?.fields && <LookupResult extraction={e!} />}
      {lookup?.error && <p className={`${callout} bg-slate-900 text-slate-400`}>{lookup.error}</p>}
      {read(status) && e?.notes && <p className={`${callout} bg-slate-900 text-slate-300`}>{e.notes}</p>}
      {!working && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            {cost
              ? `${lookup?.fields ? 'Read and checked' : 'Read'} by ${cost.model} for about ${(cost.dollars * 100).toFixed(1)}¢`
              : status === 'pending'
                ? 'Not read by the AI yet'
                : ''}
          </span>
          <span className="flex items-center gap-1">
            {canLookUp && (
              <button
                type="button"
                disabled={busy}
                onClick={onLookup}
                className="min-h-11 px-2 font-medium text-sky-400 disabled:opacity-50"
              >
                Check checklist · ~{lookupCost}
              </button>
            )}
            <select
              aria-label="Model"
              value={model}
              onChange={(ev) => setModel(ev.target.value as typeof model)}
              className="min-h-11 rounded-lg bg-transparent px-1 text-slate-300"
            >
              {AI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy}
              onClick={() => onReread(model)}
              className="min-h-11 px-2 font-medium text-sky-400 disabled:opacity-50"
            >
              {busy ? 'Sending…' : status === 'pending' ? 'Read with AI' : 'Read again'}
            </button>
          </span>
        </div>
      )}
    </section>
  )
}

const read = (status: string) => status === 'ready' || status === 'looking_up'

function listFields(fields: string[] | undefined): string {
  return (fields ?? []).map((f) => fieldLabel(f).toLowerCase()).join(', ')
}

/** What the checklist search changed or confirmed, with the pages it relied on. */
function LookupResult({ extraction: e }: { extraction: Extraction }) {
  const lookup = e.lookup!
  const changed = lookup.changed ?? []
  const open = lookup.still_uncertain ?? []
  return (
    <div className={`${callout} flex flex-col gap-1 border border-emerald-900/60 bg-emerald-950/30 text-slate-300`}>
      <p className="font-medium text-emerald-200">
        Checked against the checklist
        {lookup.searches ? ` (${lookup.searches} ${lookup.searches === 1 ? 'search' : 'searches'})` : ''}
      </p>
      {changed.length > 0 && <p>Corrected: {changed.map(fieldLabel).join(', ')}. The fields below show the changes.</p>}
      {changed.length === 0 && <p>No changes to the AI’s reading.</p>}
      {open.length > 0 && <p className="text-amber-200">Still unsure: {open.map(fieldLabel).join(', ')}.</p>}
      {lookup.notes && <p>{lookup.notes}</p>}
      {(lookup.sources ?? []).length > 0 && (
        <ul className="mt-1 flex flex-col gap-1">
          {lookup.sources!.map((source) => (
            <li key={source.url} className="truncate">
              <a href={source.url} target="_blank" rel="noreferrer" className="text-sky-400 underline">
                {source.title || source.url}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
