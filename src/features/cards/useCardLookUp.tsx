import { useIdentifyCard } from '../../hooks/useScans'
import { formatCost } from '../ai/costEstimate'
import { identifyRequest } from '../ai/requests'
import { useAiApproval } from '../ai/useAiApproval'
import { getAiModel } from '../scan/aiModel'
import { extractionToForm, type Extraction } from '../scan/extraction'
import { emptyCardForm, type CardFormValues } from './cardSchema'
import type { LookupOutcome } from './LookupPanel'

/** What a hand-typed card tells the lookup; blanks are left out. */
const IDENTITY = ['player', 'year', 'set_name', 'insert_name', 'parallel', 'card_number', 'sport', 'team'] as const
const FLAGS = ['is_rookie', 'is_auto', 'is_patch', 'is_relic'] as const

/** "Look up details with AI" for the card form: asks about the cost first. Render `dialog` in the page. */
export function useCardLookUp() {
  const identify = useIdentifyCard()
  const ai = useAiApproval()
  const model = getAiModel()
  const estimate = ai.estimate.identify(model)

  async function run(values: CardFormValues): Promise<LookupOutcome> {
    if (!(await ai.approve(identifyRequest(model, estimate)))) return null
    const typed: Record<string, unknown> = Object.fromEntries(
      IDENTITY.filter((f) => values[f].trim()).map((f) => [f, values[f].trim()]),
    )
    for (const flag of FLAGS) if (values[flag]) typed[flag] = true
    const result = await identify.mutateAsync({ model, card: typed })
    return {
      found: result.fields ? extractionToForm(result.fields as Extraction, emptyCardForm) : undefined,
      uncertain: result.still_uncertain,
      notes: result.notes,
      sources: result.sources,
      dollars: result.dollars,
      error: result.error,
    }
  }

  return { lookUp: { costLabel: formatCost(estimate.expected), run }, dialog: ai.dialog }
}
