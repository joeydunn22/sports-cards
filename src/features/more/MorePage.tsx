import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { useState } from 'react'
import { buttonSecondary, panel } from '../../components/ui'
import { signOut, useAuth } from '../../hooks/useAuth'
import { ImportExportSections } from '../import-export/ImportExportPage'
import { AI_MODELS, getAiModel, setAiModel, type AiModel } from '../scan/aiModel'

export function MorePage() {
  const { session } = useAuth()
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-6 md:pt-6">
      <PageHeader title="More" />

      <ImportExportSections />

      <AiModelSetting />

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

function AiModelSetting() {
  const [model, setModel] = useState<AiModel>(getAiModel)
  return (
    <section className={`${panel} flex flex-col gap-3 p-4`}>
      <div>
        <h2 className="text-lg font-semibold">Card scanning</h2>
        <p className="text-sm text-slate-400">Which AI model reads your scanned cards.</p>
      </div>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="AI model">
        {AI_MODELS.map((m) => (
          <label
            key={m.id}
            className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 ${
              model === m.id ? 'border-sky-500 bg-sky-500/10' : 'border-slate-800'
            }`}
          >
            <input
              type="radio"
              name="ai-model"
              value={m.id}
              checked={model === m.id}
              onChange={() => {
                setModel(m.id)
                setAiModel(m.id)
              }}
              className="accent-sky-500"
            />
            <span className="font-medium">{m.label}</span>
            <span className="text-sm text-slate-400">{m.note}</span>
          </label>
        ))}
      </div>
    </section>
  )
}
