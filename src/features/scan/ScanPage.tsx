import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { buttonPrimary, buttonSecondary, panel } from '../../components/ui'
import { NO_SCANS, useReadScans, useScanPolling, useScans } from '../../hooks/useScans'
import type { CardScan } from '../../types/card'
import { CardThumb } from '../cards/CardThumb'
import { formatCost } from '../ai/costEstimate'
import { readRequest } from '../ai/requests'
import { useAiApproval } from '../ai/useAiApproval'
import { getAiModel } from './aiModel'
import { asExtraction, inboxSection, needsYouReason, sortForReview, type InboxSection } from './extraction'

const SECTIONS: { id: InboxSection; title: string; hint?: string }[] = [
  { id: 'ready', title: 'Ready to save' },
  {
    id: 'needs-you',
    title: 'Needs you',
    hint: 'The AI couldn’t settle these. Retake the photo, or fill in what it missed.',
  },
  { id: 'reading', title: 'With the AI' },
  { id: 'unread', title: 'Not read yet' },
]

/** When this many of the cards read so far need the collector, the photos are the likely problem. */
const PHOTO_TROUBLE = { minCards: 3, share: 0.4 }

/** Scan inbox: cards photographed but not yet confirmed. */
export function ScanPage() {
  const { data, isPending, error } = useScans()
  const scans = data ?? NO_SCANS
  const readScans = useReadScans()
  const ai = useAiApproval()
  useScanPolling(scans)
  const pending = scans.filter((s) => s.status === 'pending').length
  const processing = scans.filter((s) => s.status === 'processing' || s.status === 'looking_up').length
  const sorted = sortForReview(scans)
  const bySection = (id: InboxSection) => sorted.filter((s) => inboxSection(s) === id)
  const needsYou = bySection('needs-you').length
  const done = needsYou + bySection('ready').length
  const photoTrouble = needsYou >= PHOTO_TROUBLE.minCards && needsYou / done >= PHOTO_TROUBLE.share

  async function readPending() {
    const model = getAiModel()
    const ok = await ai.approve(readRequest(pending, model, ai.estimate.read(pending, model), ai.autoLookup))
    if (ok) readScans.mutate({ model })
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 md:pt-6">
      <PageHeader title="Scan cards" />
      {ai.dialog}

      <Link to="/scan/new" className={`${buttonPrimary} min-h-14 text-base`}>
        <Icon name="camera" size={20} /> Photograph cards
      </Link>

      {processing > 0 && (
        <p className="flex items-center gap-2 rounded-xl bg-sky-950/60 px-3 py-2 text-sm text-sky-200">
          <span className="size-2 shrink-0 animate-pulse rounded-full bg-sky-400" />
          The AI is working on {processing} {processing === 1 ? 'card' : 'cards'}. Usually a few minutes; this page
          updates by itself.
        </p>
      )}
      {pending > 0 && (
        <button
          type="button"
          disabled={readScans.isPending}
          onClick={() => void readPending()}
          className={`${buttonSecondary} min-h-12`}
        >
          {readScans.isPending
            ? 'Sending…'
            : `Read ${pending} ${pending === 1 ? 'card' : 'cards'} with AI · ~${formatCost(ai.estimate.read(pending, getAiModel()).expected)}`}
        </button>
      )}
      {readScans.isError && (
        <p className="rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-300">{readScans.error.message}</p>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Inbox</h2>
          {scans.length > 0 && <span className="text-sm text-slate-400">{scans.length} to review</span>}
        </div>

        {isPending ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : error ? (
          <p className="rounded-xl bg-red-950/50 p-3 text-sm text-red-300">Couldn’t load the inbox: {error.message}</p>
        ) : scans.length === 0 ? (
          <div className={`${panel} flex flex-col items-center gap-2 px-6 py-8 text-center`}>
            <Icon name="inbox" size={28} className="text-slate-500" />
            <p className="text-slate-300">Nothing waiting</p>
            <p className="text-sm text-slate-500">
              Photograph a few cards at a time, fronts then backs. Each card lands here for you to check and save.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {photoTrouble && (
              <p className="rounded-xl bg-amber-950/60 px-3 py-2 text-sm text-amber-200">
                The AI couldn’t settle {needsYou} of {done} cards. That usually points to the photos rather than the
                cards: glare through the toploaders, or too many cards per shot. Try fewer cards per photo, tilted away
                from the light.
              </p>
            )}
            {SECTIONS.map(({ id, title, hint }) => {
              const items = bySection(id)
              if (items.length === 0) return null
              return (
                <div key={id} className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
                    <span className="text-sm text-slate-500">{items.length}</span>
                  </div>
                  {hint && <p className="-mt-1 text-xs text-slate-500">{hint}</p>}
                  <ul className="flex flex-col gap-2">
                    {items.map((scan) => (
                      <li key={scan.id}>
                        <ScanRow scan={scan} section={id} />
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

function ScanRow({ scan, section }: { scan: CardScan; section: InboxSection }) {
  const read = asExtraction(scan.extraction)
  const title = read?.lookup?.fields?.player || read?.player
  const detail = read && section !== 'unread' ? [read.year, read.set_name, read.parallel].filter(Boolean).join(' ') : ''
  const status =
    section === 'needs-you'
      ? { text: needsYouReason(scan), className: 'text-amber-300' }
      : section === 'reading'
        ? {
            text: scan.status === 'looking_up' ? 'Checking the set’s checklist…' : 'Reading…',
            className: 'text-sky-300',
          }
        : section === 'unread'
          ? { text: 'Not read by the AI yet', className: 'text-slate-400' }
          : read?.lookup?.fields
            ? {
                text: read.lookup.cached ? 'Matched your card database' : 'Checked against the checklist',
                className: 'text-emerald-300',
              }
            : null
  return (
    <Link
      to={`/scan/${scan.id}`}
      className="flex min-h-20 items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-2.5 pr-3 active:bg-slate-800"
    >
      <CardThumb path={scan.front_image_path} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{title || 'Unknown card'}</p>
        {detail && <p className="truncate text-sm text-slate-400">{detail}</p>}
        {status && <p className={`truncate text-sm ${status.className}`}>{status.text}</p>}
        {!scan.back_image_path && <p className="text-xs text-slate-500">No back photo</p>}
      </div>
      <Icon name="back" size={18} className="rotate-180 text-slate-500" />
    </Link>
  )
}
