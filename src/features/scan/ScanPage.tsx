import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { buttonSecondary, panel } from '../../components/ui'

/** Placeholder until photo capture and AI scanning land (Phase 2). */
export function ScanPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 md:pt-6">
      <PageHeader title="Scan cards" />
      <section className={`${panel} flex flex-col items-center gap-4 px-6 py-10 text-center`}>
        <span className="grid size-14 place-items-center rounded-2xl bg-sky-500/10 text-sky-400">
          <Icon name="camera" size={28} />
        </span>
        <div>
          <p className="text-lg font-semibold">Coming soon</p>
          <p className="mt-1 text-sm text-slate-400">
            Photograph a few cards at a time, fronts then backs, and the app will fill in the details for you to
            confirm.
          </p>
        </div>
        <Link to="/cards/new" className={buttonSecondary}>
          <Icon name="plus" size={18} /> Add a card by hand
        </Link>
      </section>
    </main>
  )
}
