import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { makeCard } from '../../test/makeCard'
import { CardForm } from './CardForm'
import { emptyCardForm } from './cardSchema'

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
    expect(input(/^Year/).value).toBe('2023')
    expect(input(/^Set/).value).toBe('Topps Finest')
    expect(input(/^Sport/).value).toBe('Baseball')
    expect(screen.getByRole('button', { name: 'RC' })).toHaveAttribute('aria-pressed', 'false')
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
})
