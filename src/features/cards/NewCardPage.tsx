import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { PageHeader } from '../../components/PageHeader'
import { NO_CARDS, useAddQuantity, useCards, useCreateCard } from '../../hooks/useCards'
import type { Card } from '../../types/card'
import { CardForm } from './CardForm'
import { emptyCardForm, toCardInput, type CardFormValues } from './cardSchema'
import { buildSuggestions, getLastSport, rememberSport } from './suggestions'
import { useCardLookUp } from './useCardLookUp'

export function NewCardPage() {
  const { data } = useCards()
  const cards = data ?? NO_CARDS
  const createCard = useCreateCard()
  const addQuantity = useAddQuantity()
  const { lookUp, dialog } = useCardLookUp()
  const navigate = useNavigate()
  const suggestions = useMemo(() => buildSuggestions(cards), [cards])
  const initialValues = useMemo(() => ({ ...emptyCardForm, sport: getLastSport() }), [])

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

  return (
    <main className="mx-auto max-w-3xl px-4 pt-[env(safe-area-inset-top)] md:pt-4">
      <PageHeader title="Add card" backTo="/" backLabel="Collection" />
      {dialog}
      <CardForm
        mode="new"
        initialValues={initialValues}
        suggestions={suggestions}
        duplicates={{ cards, askOnSave: true }}
        autofillFrom={cards}
        lookUp={lookUp}
        onSubmit={handleSubmit}
      />
    </main>
  )
}
