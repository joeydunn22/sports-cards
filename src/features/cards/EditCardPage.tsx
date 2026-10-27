import { useMemo } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { buttonDanger, buttonSecondary } from '../../components/ui'
import { NO_CARDS, useCards, useDeleteCard, useUpdateCard } from '../../hooks/useCards'
import { flashSaved } from '../../lib/feedback'
import { useSetHelp } from '../sets/useSetHelp'
import { CardBadges } from './CardBadges'
import { CardForm } from './CardForm'
import { CardPhotos } from './CardPhotos'
import { fromCard, toCardInput, type CardFormValues } from './cardSchema'
import { cardTitle } from './cardText'
import { buildSuggestions } from './suggestions'
import { teamColors } from './teamColors'
import { TeamRule, TeamWash } from './TeamWash'

export function EditCardPage() {
  const { id } = useParams()
  const { data, isPending } = useCards()
  const cards = data ?? NO_CARDS
  const updateCard = useUpdateCard()
  const deleteCard = useDeleteCard()
  const setHelp = useSetHelp()
  const navigate = useNavigate()
  const suggestions = useMemo(() => buildSuggestions(cards), [cards])
  const card = cards.find((c) => c.id === id)
  // The collection's order rides along (router state), so the card screen keeps its next/previous.
  const location = useLocation()
  const detailPath = `/cards/${id}`

  if (isPending) return <p className="p-6 text-ink-400">Loading…</p>
  if (!card) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-ink-300">That card doesn’t exist (it may have been deleted).</p>
        <Link to="/" className={`${buttonSecondary} mt-4`}>
          Back to collection
        </Link>
      </main>
    )
  }

  async function handleSubmit(values: CardFormValues) {
    // Optimistic: the list updates immediately; we navigate once the save is confirmed.
    await updateCard.mutateAsync({ id: card!.id, input: toCardInput(values) })
    flashSaved()
    navigate(detailPath, { replace: true, state: location.state })
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${cardTitle(card!)}"? This can’t be undone.`)) return
    deleteCard.mutate(card!.id)
    navigate('/')
  }

  const colors = teamColors(card.team, card)
  const version = [card.insert_name, card.parallel].filter(Boolean).join(' · ')

  return (
    <main className="relative isolate mx-auto max-w-3xl px-4 pt-[env(safe-area-inset-top)] md:pt-4">
      <TeamWash colors={colors} />
      <PageHeader
        title={card.player}
        eyebrow={card.team ? <span style={{ color: colors?.onDark }} className={colors ? '' : 'text-ink-500'}>{card.team}</span> : null}
        subtitle={
          <div className="flex flex-col gap-2">
            <p>
              {card.year} {card.set_name} <span className="text-ink-500">#{card.card_number}</span>
              {version && <span className="block text-ink-300">{version}</span>}
            </p>
            <div className="empty:hidden">
              <CardBadges card={card} />
            </div>
          </div>
        }
        backTo={detailPath}
        backState={location.state}
        backLabel="Card"
      />
      <CardPhotos front={card.front_image_path} back={card.back_image_path} cardId={card.id} />
      <TeamRule colors={colors} />
      {/* key: remount with fresh values if the card changes underneath us */}
      <CardForm
        key={card.updated_at}
        mode="edit"
        initialValues={fromCard(card)}
        suggestions={suggestions}
        duplicates={{ cards, excludeId: card.id, askOnSave: false }}
        setHelp={setHelp}
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
