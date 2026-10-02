import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { NO_CARDS, useCards, useDeleteCard, useUpdateCard } from '../../hooks/useCards'
import { CardForm } from './CardForm'
import { fromCard, toCardInput, type CardFormValues } from './cardSchema'
import { cardTitle } from './cardText'
import { buildSuggestions } from './suggestions'

export function EditCardPage() {
  const { id } = useParams()
  const { data, isPending } = useCards()
  const cards = data ?? NO_CARDS
  const updateCard = useUpdateCard()
  const deleteCard = useDeleteCard()
  const navigate = useNavigate()
  const suggestions = useMemo(() => buildSuggestions(cards), [cards])
  const card = cards.find((c) => c.id === id)

  if (isPending) return <p className="p-4 text-slate-400">Loading…</p>
  if (!card) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-slate-300">That card doesn’t exist (it may have been deleted).</p>
        <Link to="/" className="mt-4 inline-flex min-h-11 items-center text-sky-400">
          Back to collection
        </Link>
      </main>
    )
  }

  async function handleSubmit(values: CardFormValues) {
    // Optimistic: the list updates immediately; we navigate once the save is confirmed.
    await updateCard.mutateAsync({ id: card!.id, input: toCardInput(values) })
    navigate('/')
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${cardTitle(card!)}"? This can’t be undone.`)) return
    deleteCard.mutate(card!.id)
    navigate('/')
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-4">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Edit card</h1>
        <Link to="/" className="flex min-h-11 items-center text-sm text-slate-400 hover:text-slate-100">
          Cancel
        </Link>
      </div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <p className="text-sm text-slate-400">{cardTitle(card)}</p>
        <button
          type="button"
          onClick={handleDelete}
          className="min-h-11 shrink-0 text-sm text-red-400 hover:text-red-300"
        >
          Delete
        </button>
      </div>
      {/* key: remount with fresh values if the card changes underneath us */}
      <CardForm
        key={card.updated_at}
        mode="edit"
        initialValues={fromCard(card)}
        suggestions={suggestions}
        onSubmit={handleSubmit}
      />
    </main>
  )
}
