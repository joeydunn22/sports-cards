import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { buttonPrimary, buttonSecondary, panel } from '../../components/ui'
import { NO_SCANS, useReadScans, useScanPolling, useScans } from '../../hooks/useScans'
import type { CardScan } from '../../types/card'
import { CardThumb } from '../cards/CardThumb'
import { getAiModel } from './aiModel'
import { asExtraction } from './extraction'

const STATUS: Record<CardScan['status'], { label: string; className: string }> = {
  pending: { label: 'Not read by the AI yet', className: 'text-slate-400' },
  processing: { label: 'Reading…', className: 'text-sky-300' },
  ready: { label: 'Ready to review', className: 'text-emerald-300' },
  failed: { label: 'Couldn’t read: fill in by hand', className: 'text-amber-300' },
}

/** Scan inbox: cards photographed but not yet confirmed. */
export function ScanPage() {
  const { data, isPending, error } = useScans()
  const scans = data ?? NO_SCANS
  const readScans = useReadScans()
  useScanPolling(scans)
  const pending = scans.filter((s) => s.status === 'pending').length
  const processing = scans.filter((s) => s.status === 'processing').length

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 md:pt-6">
      <PageHeader title="Scan cards" />

      <Link to="/scan/new" className={`${buttonPrimary} min-h-14 text-base`}>
        <Icon name="camera" size={20} /> Photograph cards
      </Link>

      {processing > 0 && (
        <p className="flex items-center gap-2 rounded-xl bg-sky-950/60 px-3 py-2 text-sm text-sky-200">
          <span className="size-2 shrink-0 animate-pulse rounded-full bg-sky-400" />
          The AI is reading {processing} {processing === 1 ? 'card' : 'cards'}. Usually a few minutes; this page
          updates by itself.
        </p>
      )}
      {pending > 0 && (
        <button
          type="button"
          disabled={readScans.isPending}
          onClick={() => readScans.mutate({ model: getAiModel() })}
          className={`${buttonSecondary} min-h-12`}
        >
          {readScans.isPending ? 'Sending…' : `Read ${pending} ${pending === 1 ? 'card' : 'cards'} with AI`}
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
          <ul className="flex flex-col gap-2">
            {scans.map((scan, i) => {
              const read = scan.status === 'ready' ? asExtraction(scan.extraction) : null
              return (
                <li key={scan.id}>
                  <Link
                    to={`/scan/${scan.id}`}
                    className="flex min-h-20 items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-2.5 pr-3 active:bg-slate-800"
                  >
                    <CardThumb path={scan.front_image_path} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{read?.player || `Card ${i + 1}`}</p>
                      {read && (
                        <p className="truncate text-sm text-slate-400">
                          {[read.year, read.set_name, read.parallel].filter(Boolean).join(' ')}
                        </p>
                      )}
                      <p className={`truncate text-sm ${STATUS[scan.status].className}`}>
                        {STATUS[scan.status].label}
                      </p>
                      {!scan.back_image_path && <p className="text-xs text-slate-500">No back photo</p>}
                    </div>
                    <Icon name="back" size={18} className="rotate-180 text-slate-500" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
