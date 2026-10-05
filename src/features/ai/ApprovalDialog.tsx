import { useState } from 'react'
import { buttonGhost, buttonPrimary } from '../../components/ui'
import { formatCost } from './costEstimate'
import type { AiRequest } from './useAiApproval'

type DialogProps = {
  request: AiRequest
  credit: { left: number } | null
  asking: boolean
  onFinish: (ok: boolean, stopAsking?: boolean) => void
}

/** The cost prompt shown before an AI run (see useAiApproval). */
export function ApprovalDialog({ request, credit, asking, onFinish }: DialogProps) {
  const [stopAsking, setStopAsking] = useState(false)
  const { expected, max } = request.estimate
  const tooMuch = credit != null && max > credit.left
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-approval-title"
        className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl"
      >
        <h2 id="ai-approval-title" className="text-lg font-semibold">
          Use AI credit?
        </h2>
        <p className="text-slate-200">{request.action}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-400">Estimated cost</dt>
          <dd>
            about {formatCost(expected)}
            {max > expected * 1.05 && <span className="text-slate-400">, up to {formatCost(max)}</span>}
          </dd>
          {credit && (
            <>
              <dt className="text-slate-400">Credit left</dt>
              <dd>
                ≈ ${credit.left.toFixed(2)}
                <span className="text-slate-400"> → ≈ ${Math.max(credit.left - expected, 0).toFixed(2)} after</span>
              </dd>
            </>
          )}
        </dl>
        {request.note && <p className="text-sm text-slate-400">{request.note}</p>}
        {!credit && <p className="text-sm text-slate-500">Add your credit balance on More to see what’s left.</p>}
        {tooMuch && (
          <p className="rounded-xl bg-amber-950/60 px-3 py-2 text-sm text-amber-200">
            This could cost more than the credit you have left. Runs stop when the credit runs out.
          </p>
        )}
        {asking && (
          <label className="flex min-h-11 items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={stopAsking}
              onChange={(e) => setStopAsking(e.target.checked)}
              className="size-5 accent-sky-500"
            />
            Don’t ask again (estimates still show; turn back on in More)
          </label>
        )}
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => onFinish(true, stopAsking)} className={`${buttonPrimary} min-h-12`}>
            Run for about {formatCost(expected)}
          </button>
          <button type="button" onClick={() => onFinish(false)} className={`${buttonGhost} min-h-12`}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
