import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { buttonDanger, buttonSecondary } from '../../components/ui'
import { NO_CARDS, useCards } from '../../hooks/useCards'
import { NO_SCANS, useConfirmScan, useDeleteScan, useScans } from '../../hooks/useScans'
import { CardForm } from '../cards/CardForm'
import { CardPhotos } from '../cards/CardPhotos'
import { toCardInput, type CardFormValues } from '../cards/cardSchema'
import { buildSuggestions, rememberSport } from '../cards/suggestions'
import { rememberScanValues, scanFormValues } from './scanDefaults'

/** Check one scanned card's details, then save it to the collection. */
export function ReviewScanPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: scansData, isPending } = useScans()
  const { data: cardsData } = useCards()
  const scans = scansData ?? NO_SCANS
  const suggestions = useMemo(() => buildSuggestions(cardsData ?? NO_CARDS), [cardsData])
  const confirmScan = useConfirmScan()
  const deleteScan = useDeleteScan()

  const index = scans.findIndex((s) => s.id === id)
  const scan = scans[index]
  // After this one, go to the next card in the inbox (or the one before, at the end).
  const nextId = scans[index + 1]?.id ?? scans[index - 1]?.id
  const goNext = () => navigate(nextId ? `/scan/${nextId}` : '/scan', { replace: true })
  const initialValues = useMemo(() => (scan ? scanFormValues(scan) : null), [scan])

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

  async function handleSubmit(values: CardFormValues) {
    const input = toCardInput(values)
    await confirmScan.mutateAsync({ scan: scan!, input })
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
      {scan.status === 'failed' && scan.error && (
        <p className="mb-4 rounded-xl bg-amber-950/60 px-3 py-2 text-sm text-amber-200">{scan.error}</p>
      )}
      <CardForm
        key={scan.id}
        mode="edit"
        submitLabel={nextId ? 'Save & next' : 'Save card'}
        initialValues={initialValues}
        suggestions={suggestions}
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
