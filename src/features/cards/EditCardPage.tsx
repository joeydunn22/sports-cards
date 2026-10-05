import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { buttonDanger, buttonSecondary } from '../../components/ui'
import { NO_CARDS, useCards, useDeleteCard, useUpdateCard } from '../../hooks/useCards'
import { CardForm } from './CardForm'
import { CardPhotos } from './CardPhotos'
import { fromCard, toCardInput, type CardFormValues } from './cardSchema'
import { cardTitle } from './cardText'
import { buildSuggestions } from './suggestions'
import { useCardLookUp } from './useCardLookUp'

export function EditCardPage() {
  const { id } = useParams()
  const { data, isPending } = useCards()
  const cards = data ?? NO_CARDS
  const updateCard = useUpdateCard()
  const deleteCard = useDeleteCard()
  const { lookUp, dialog } = useCardLookUp()
  const navigate = useNavigate()
  const suggestions = useMemo(() => buildSuggestions(cards), [cards])
  const card = cards.find((c) => c.id === id)

  if (isPending) return <p className="p-6 text-slate-400">Loading…</p>
  if (!card) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-slate-300">That card doesn’t exist (it may have been deleted).</p>
        <Link to="/" className={`${buttonSecondary} mt-4`}>
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
    <main className="mx-auto max-w-3xl px-4 pt-[env(safe-area-inset-top)] md:pt-4">
      <PageHeader title="Edit card" subtitle={cardTitle(card)} backTo="/" backLabel="Collection" />
      <CardPhotos front={card.front_image_path} back={card.back_image_path} />
      {dialog}
      {/* key: remount with fresh values if the card changes underneath us */}
      <CardForm
        key={card.updated_at}
        mode="edit"
        initialValues={fromCard(card)}
        suggestions={suggestions}
        duplicates={{ cards, excludeId: card.id, askOnSave: false }}
        lookUp={lookUp}
        onSubmit={handleSubmit}
        footer={
          <button type="button" onClick={handleDelete} className={`${buttonDanger} mt-2 min-h-12`}>
            <Icon name="trash" size={18} /> Delete card
          </button>
        }
      />
    </main>
  )
}
