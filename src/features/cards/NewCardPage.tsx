import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { PageHeader } from '../../components/PageHeader'
import { NO_CARDS, useAddQuantity, useCards, useCreateCard } from '../../hooks/useCards'
import { useIdentifyCard } from '../../hooks/useScans'
import type { Card } from '../../types/card'
import { formatCost } from '../ai/costEstimate'
import { identifyRequest } from '../ai/requests'
import { useAiApproval } from '../ai/useAiApproval'
import { getAiModel } from '../scan/aiModel'
import { extractionToForm, type Extraction } from '../scan/extraction'
import { CardForm } from './CardForm'
import { emptyCardForm, toCardInput, type CardFormValues } from './cardSchema'
import type { LookupOutcome } from './LookupPanel'
import { buildSuggestions, getLastSport, rememberSport } from './suggestions'

/** What a hand-typed card tells the lookup; blanks are left out. */
const IDENTITY = ['player', 'year', 'set_name', 'insert_name', 'parallel', 'card_number', 'sport', 'team'] as const

export function NewCardPage() {
  const { data } = useCards()
  const cards = data ?? NO_CARDS
  const createCard = useCreateCard()
  const addQuantity = useAddQuantity()
  const identify = useIdentifyCard()
  const ai = useAiApproval()
  const navigate = useNavigate()
  const suggestions = useMemo(() => buildSuggestions(cards), [cards])
  const initialValues = useMemo(() => ({ ...emptyCardForm, sport: getLastSport() }), [])
  const model = getAiModel()
  const estimate = ai.estimate.identify(model)

  async function handleSubmit(
    values: CardFormValues,
    { addAnother, mergeInto }: { addAnother: boolean; mergeInto?: Card },
  ) {
    const input = toCardInput(values)
    if (mergeInto) await addQuantity.mutateAsync({ card: mergeInto, quantity: input.quantity ?? 1 })
    else await createCard.mutateAsync(input)
    rememberSport(input.sport)
    if (!addAnother) navigate('/')
  }

  async function lookUp(values: CardFormValues): Promise<LookupOutcome> {
    if (!(await ai.approve(identifyRequest(model, estimate)))) return null
    const typed: Record<string, unknown> = Object.fromEntries(IDENTITY.filter((f) => values[f].trim()).map((f) => [f, values[f].trim()]))
    for (const flag of ['is_rookie', 'is_auto', 'is_patch', 'is_relic'] as const) if (values[flag]) typed[flag] = true
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

  return (
    <main className="mx-auto max-w-3xl px-4 pt-[env(safe-area-inset-top)] md:pt-4">
      <PageHeader title="Add card" backTo="/" backLabel="Collection" />
      {ai.dialog}
      <CardForm
        mode="new"
        initialValues={initialValues}
        suggestions={suggestions}
        duplicates={{ cards, askOnSave: true }}
        autofillFrom={cards}
        lookUp={{ costLabel: formatCost(estimate.expected), run: lookUp }}
        onSubmit={handleSubmit}
      />
    </main>
  )
}
