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
  useMergeScan,
  useRereadScans,
  useScanPolling,
  useScans,
} from '../../hooks/useScans'
import type { Card } from '../../types/card'
import { CardForm } from '../cards/CardForm'
import { CardPhotos } from '../cards/CardPhotos'
import { toCardInput, type CardFormValues } from '../cards/cardSchema'
import { buildSuggestions, rememberSport } from '../cards/suggestions'
import { AI_MODELS, getAiModel } from './aiModel'
import { asExtraction, extractionCost, fieldNotes } from './extraction'
import { rememberScanValues, scanFormValues } from './scanDefaults'

/** Check one scanned card's details, then save it to the collection. */
export function ReviewScanPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: scansData, isPending } = useScans()
  const { data: cardsData } = useCards()
  const scans = scansData ?? NO_SCANS
  const cards = cardsData ?? NO_CARDS
  const suggestions = useMemo(() => buildSuggestions(cards), [cards])
  const confirmScan = useConfirmScan()
  const mergeScan = useMergeScan()
  const deleteScan = useDeleteScan()
  const reread = useRereadScans()
  useScanPolling(scans)

  const index = scans.findIndex((s) => s.id === id)
  const scan = scans[index]
  // After this one, go to the next card in the inbox (or the one before, at the end).
  const nextId = scans[index + 1]?.id ?? scans[index - 1]?.id
  const goNext = () => navigate(nextId ? `/scan/${nextId}` : '/scan', { replace: true })
  // The form only reads these when it mounts; its key changes when the AI result arrives.
  const initialValues = useMemo(() => (scan ? scanFormValues(scan) : null), [scan])
  const extraction = scan ? asExtraction(scan.extraction) : null
  const notes = scan?.status === 'ready' && extraction ? fieldNotes(extraction) : {}
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
        status={scan.status}
        error={scan.error}
        retake={extraction?.retake}
        notes={extraction?.notes}
        needsLookup={extraction?.needs_lookup}
        cost={cost}
        busy={reread.isPending}
        onReread={(model) => reread.mutate({ model, ids: [scan.id] })}
      />
      {reread.isError && (
        <p className="mb-4 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-300">{reread.error.message}</p>
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
  status: string
  error: string | null
  retake?: string
  notes?: string
  needsLookup?: boolean
  cost: { dollars: number; model: string } | null
  busy: boolean
  onReread: (model: string) => void
}

/** What the AI made of this card, and a way to have it read again (e.g. with another model). */
function AiStatus({ status, error, retake, notes, needsLookup, cost, busy, onReread }: AiStatusProps) {
  const [model, setModel] = useState(getAiModel)
  return (
    <section className="mb-4 flex flex-col gap-2">
      {status === 'processing' && (
        <p className="rounded-xl bg-sky-950/60 px-3 py-2 text-sm text-sky-200">
          The AI is reading this card. Results usually arrive within a few minutes; this page updates by itself.
        </p>
      )}
      {status === 'failed' && error && (
        <p className="rounded-xl bg-amber-950/60 px-3 py-2 text-sm text-amber-200">{error}</p>
      )}
      {status === 'ready' && retake && (
        <p className="rounded-xl bg-amber-950/60 px-3 py-2 text-sm text-amber-200">
          <strong>Retake suggested:</strong> {retake}
        </p>
      )}
      {status === 'ready' && (notes || needsLookup) && (
        <p className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-slate-300">
          {notes}
          {needsLookup && ' A checklist lookup would help confirm the details.'}
        </p>
      )}
      {status !== 'processing' && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            {cost
              ? `Read by ${cost.model} for about ${(cost.dollars * 100).toFixed(2)}¢`
              : status === 'pending'
                ? 'Not read by the AI yet'
                : ''}
          </span>
          <span className="flex items-center gap-1">
            <select
              aria-label="Model"
              value={model}
              onChange={(e) => setModel(e.target.value as typeof model)}
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
