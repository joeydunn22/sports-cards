import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { PageHeader } from '../../components/PageHeader'
import { NO_CARDS, useCards, useCreateCard } from '../../hooks/useCards'
import { CardForm } from './CardForm'
import { emptyCardForm, toCardInput, type CardFormValues } from './cardSchema'
import { buildSuggestions, getLastSport, rememberSport } from './suggestions'

export function NewCardPage() {
  const { data } = useCards()
  const cards = data ?? NO_CARDS
  const createCard = useCreateCard()
  const navigate = useNavigate()
  const suggestions = useMemo(() => buildSuggestions(cards), [cards])
  const initialValues = useMemo(() => ({ ...emptyCardForm, sport: getLastSport() }), [])

  async function handleSubmit(values: CardFormValues, { addAnother }: { addAnother: boolean }) {
    const input = toCardInput(values)
    await createCard.mutateAsync(input)
    rememberSport(input.sport)
    if (!addAnother) navigate('/')
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pt-[env(safe-area-inset-top)] md:pt-4">
      <PageHeader title="Add card" backTo="/" backLabel="Collection" />
      <CardForm mode="new" initialValues={initialValues} suggestions={suggestions} onSubmit={handleSubmit} />
    </main>
  )
}
