import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
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
    <main className="mx-auto max-w-3xl px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Add card</h1>
        <Link to="/" className="flex min-h-11 items-center text-sm text-slate-400 hover:text-slate-100">
          Done
        </Link>
      </div>
      <CardForm mode="new" initialValues={initialValues} suggestions={suggestions} onSubmit={handleSubmit} />
    </main>
  )
}
