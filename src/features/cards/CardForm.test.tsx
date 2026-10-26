import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { makeCard } from '../../test/makeCard'
import type { SetHelp } from '../sets/useSetHelp'
import type { Spot } from './autofill'
import { CardForm } from './CardForm'
import { emptyCardForm } from './cardSchema'
import type { SetParallel } from './parallels'

function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(<CardForm mode="new" initialValues={emptyCardForm} suggestions={{}} onSubmit={onSubmit} />)
  return { onSubmit, user: userEvent.setup() }
}

const input = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement

describe('CardForm', () => {
  it('blocks saving until required fields are filled', async () => {
    const { onSubmit, user } = renderForm()
    await user.click(screen.getByRole('button', { name: 'Save & add another' }))
    expect(await screen.findByText('Player is required')).toBeInTheDocument()
    expect(screen.getByText('Card # is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('Save & add another keeps year, set, insert and sport, and clears the rest', async () => {
    const { onSubmit, user } = renderForm()
    await user.type(input(/^Player/), 'Shohei Ohtani')
    await user.type(input(/^Year/), '2023')
    await user.type(input(/^Card #/), '12')
    await user.type(input(/^Set/), 'Topps Finest')
    await user.type(input(/^Sport/), 'Baseball')
    await user.type(input(/^Parallel/), 'Red Refractor')
    await user.click(screen.getByRole('button', { name: 'RC' }))
    await user.click(screen.getByRole('button', { name: 'Save & add another' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ player: 'Shohei Ohtani', is_rookie: true })
    expect(onSubmit.mock.calls[0][1]).toEqual({ addAnother: true })

    expect(await screen.findByRole('status')).toHaveTextContent('Saved: 2023 Topps Finest Red Refractor Shohei Ohtani #12 RC')
    expect(input(/^Player/).value).toBe('')
    expect(input(/^Card #/).value).toBe('')
    expect(input(/^Parallel/).value).toBe('')
    expect(screen.getByRole('button', { name: 'RC' })).toHaveAttribute('aria-pressed', 'false')
    // The batch's set folds to one line, ready for the next card.
    expect(screen.queryByLabelText(/^Year/)).not.toBeInTheDocument()
    expect(screen.getByText('2023 · Topps Finest · Baseball')).toBeInTheDocument()
    await waitFor(() => expect(input(/^Player/)).toHaveFocus())
    await user.click(screen.getByRole('button', { name: /Change/ }))
    expect(input(/^Year/).value).toBe('2023')
    expect(input(/^Set/).value).toBe('Topps Finest')
    expect(input(/^Sport/).value).toBe('Baseball')
  })

  it('warns (without blocking) when a parallel ends up in Set', async () => {
    const { user } = renderForm()
    await user.type(input(/^Set/), 'Topps Finest Refractor')
    expect(screen.getByText(/"Refractor" looks like a parallel/)).toBeInTheDocument()
  })

  it('shows grading fields only when Graded is on', async () => {
    const { user } = renderForm()
    expect(screen.queryByLabelText('Grade')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Condition')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Graded' }))
    expect(screen.getByLabelText('Grade')).toBeInTheDocument()
    expect(screen.queryByLabelText('Condition')).not.toBeInTheDocument()
  })

  it('offers to add an extra copy to the existing card instead of a new entry', async () => {
    const existing = makeCard({ player: 'Shohei Ohtani', year: '2023', set_name: 'Topps Finest', card_number: '12' })
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CardForm
          mode="new"
          initialValues={{ ...emptyCardForm, year: '2023', set_name: 'Topps Finest', sport: 'Baseball' }}
          suggestions={{}}
          duplicates={{ cards: [existing], askOnSave: true }}
          onSubmit={onSubmit}
        />
      </QueryClientProvider>,
    )
    const user = userEvent.setup()
    await user.type(input(/^Player/), 'shohei ohtani')
    await user.type(input(/^Card #/), '#12')
    expect(screen.getByText('Already in your collection')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save & add another' }))
    expect(onSubmit).not.toHaveBeenCalled()
    await user.click(await screen.findByRole('button', { name: 'Add to it (quantity 2)' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0][1]).toEqual({ addAnother: true, mergeInto: existing })
    expect(await screen.findByText(/Added to quantity/)).toBeInTheDocument()
  })

  it('fills team and sport from the player’s other cards when Player is left', async () => {
    const existing = makeCard({ player: 'Connor Bedard', team: 'Chicago Blackhawks', sport: 'Hockey' })
    render(
      <CardForm
        mode="new"
        initialValues={emptyCardForm}
        suggestions={{}}
        autofillFrom={[existing]}
        onSubmit={vi.fn()}
      />,
    )
    const user = userEvent.setup()
    await user.type(input(/^Player/), 'connor bedard')
    await user.tab()
    expect(input(/^Team/).value).toBe('Chicago Blackhawks')
    expect(input(/^Sport/).value).toBe('Hockey')
    expect(screen.getByText('Filled Team, Sport from your other Connor Bedard cards.')).toBeInTheDocument()
  })

  describe('with the set’s checklist and rainbow', () => {
    const set = { year: '2011', set_name: 'Bowman Chrome' }
    const rainbow: SetParallel[] = [
      { ...set, insert_name: '', parallel: 'Refractor', print_run: null, source: 'cardpedia' },
      { ...set, insert_name: '', parallel: 'Gold Refractor', print_run: 50, source: 'cardpedia' },
      { ...set, insert_name: '', parallel: 'Red Refractor', print_run: 5, source: 'cardpedia' },
    ]
    const spot = (card_number: string, player: string, insert_name = ''): Spot => ({
      ...set,
      insert_name,
      card_number,
      player,
      team: null,
      sport: null,
      is_rookie: false,
    })
    const checklist = [spot('38', 'Tyler Colvin'), spot('BCP111', 'Bryce Harper', 'Prospects'), spot('BCP111', 'Bryce Harper', 'Autographed Prospects')]
    const setHelp: SetHelp = {
      parallels: rainbow,
      spots: checklist,
      busy: false,
      onSetChange: () => {},
      load: async () => ({ parallels: rainbow, spots: checklist }),
      status: { kind: 'known', text: '2011 Bowman Chrome: 3 parallels · 3 cards · Baseball Cardpedia' },
    }
    const renderWithSet = () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined)
      render(
        <CardForm
          mode="new"
          initialValues={{ ...emptyCardForm, ...set, sport: 'Baseball' }}
          suggestions={{ set_name: ['Bowman Chrome'] }}
          setHelp={setHelp}
          onSubmit={onSubmit}
        />,
      )
      return { onSubmit, user: userEvent.setup() }
    }

    it('says what it knows about the set', () => {
      renderWithSet()
      expect(screen.getByText(/3 parallels · 3 cards · Baseball Cardpedia/)).toBeInTheDocument()
    })

    it('fills Card # from the checklist when Player is left', async () => {
      const { user } = renderWithSet()
      await user.type(input(/^Player/), 'tyler colvin')
      await user.tab()
      await waitFor(() => expect(input(/^Card #/).value).toBe('38'))
      expect(input(/^Player/).value).toBe('Tyler Colvin')
      expect(screen.getByText(/from the 2011 Bowman Chrome checklist/)).toBeInTheDocument()
    })

    it('offers the player’s cards when there are several, and a tap fills Card # and Insert', async () => {
      const { user } = renderWithSet()
      await user.type(input(/^Player/), 'Bryce Harper')
      await user.click(screen.getByRole('button', { name: '#BCP111, Autographed Prospects' }))
      expect(input(/^Card #/).value).toBe('BCP111')
      expect(input(/^Insert/).value).toBe('Autographed Prospects')
    })

    it('fills the parallel and print run from a tap on the rainbow, and the parallel from the print run', async () => {
      const { user } = renderWithSet()
      await user.click(screen.getByRole('button', { name: 'Gold Refractor /50' }))
      expect(input(/^Parallel/).value).toBe('Gold Refractor')
      expect(input(/Print run/).value).toBe('50')

      await user.click(screen.getByRole('button', { name: 'Base' }))
      await user.clear(input(/Print run/))
      await user.type(input(/Print run/), '5')
      await user.tab()
      await waitFor(() => expect(input(/^Parallel/).value).toBe('Red Refractor'))
    })

    it('fills the form from one sentence in the voice box', async () => {
      const { user } = renderWithSet()
      await user.type(screen.getByLabelText('Say or type the card'), 'tyler colvin red refractor 4 of 5{Enter}')
      await waitFor(() => expect(input(/^Card #/).value).toBe('38'))
      expect(input(/^Player/).value).toBe('Tyler Colvin')
      expect(input(/^Parallel/).value).toBe('Red Refractor')
      expect(input(/Serial number/).value).toBe('4')
      expect(input(/Print run/).value).toBe('5')
      expect(screen.getByText(/Filled Player, Parallel, Card #|Filled Player/)).toBeInTheDocument()
    })
  })
})
