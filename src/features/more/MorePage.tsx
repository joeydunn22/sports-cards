import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { buttonSecondary, panel } from '../../components/ui'
import { signOut, useAuth } from '../../hooks/useAuth'
import { ImportExportSections } from '../import-export/ImportExportPage'

export function MorePage() {
  const { session } = useAuth()
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 md:pt-6">
      <PageHeader title="More" />

      <ImportExportSections />

      <section className={`${panel} flex items-center justify-between gap-3 p-4`}>
        <div className="min-w-0">
          <p className="text-sm text-slate-400">Signed in as</p>
          <p className="truncate font-medium">{session?.user.email}</p>
        </div>
        <button type="button" onClick={() => signOut()} className={`${buttonSecondary} shrink-0`}>
          <Icon name="logout" size={18} /> Sign out
        </button>
      </section>
    </main>
  )
}
