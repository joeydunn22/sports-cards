import { useFetchParallels } from '../../hooks/useSetParallels'
import { formatCost } from '../ai/costEstimate'
import { parallelsRequest } from '../ai/requests'
import type { useAiApproval } from '../ai/useAiApproval'
import type { SetParallel } from '../cards/parallels'
import { getAiModel } from '../scan/aiModel'

/**
 * The card form's "Look up parallels" button: one set's parallel list, fetched right away (after the
 * cost prompt) so the form can fill the parallel. Pass the page's useAiApproval, which renders the dialog.
 */
export function useParallelLookup(ai: ReturnType<typeof useAiApproval>) {
  const fetchParallels = useFetchParallels()
  const model = getAiModel()
  const estimate = ai.estimate.parallels(1, model, true)
  const result = fetchParallels.data?.results[0]

  async function run(year: string, setName: string): Promise<SetParallel[] | null> {
    const ok = await ai.approve(parallelsRequest([`${year} ${setName}`], model, estimate, true))
    if (!ok) return null
    try {
      const done = await fetchParallels.mutateAsync({ sets: [{ year, set_name: setName }], model, now: true })
      return done.list
    } catch {
      return null
    }
  }

  const error =
    fetchParallels.error?.message ??
    result?.error ??
    (result && result.found === 0 ? `No parallel list found for ${result.year} ${result.set_name}.` : null)
  return { run, busy: fetchParallels.isPending, cost: formatCost(estimate.expected), error }
}
