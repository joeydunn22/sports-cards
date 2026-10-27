import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeCard } from '../../test/makeCard'
import { useTouchUpBatch } from './useTouchUpBatch'

const touchUp = vi.hoisted(() => vi.fn())

vi.mock('../../hooks/usePhotos', () => ({ downloadPhoto: async () => new Blob(['x']) }))
vi.mock('../../lib/backgroundTouchUp', () => ({ touchUpInBackground: touchUp }))
vi.mock('../../lib/photos', () => ({
  drawPixels: () => ({}),
  finishPhoto: async () => ({ photo: { blob: new Blob(['y']), ext: 'webp' }, thumb: { blob: new Blob(['z']), ext: 'webp' }, flat: true }),
  imagePixels: () => ({ width: 1, height: 1, data: new Uint8ClampedArray(4) }),
  isFlatPhoto: (path: string) => path.includes('-flat'),
  loadImage: async () => ({}),
  PHOTO_MAX_EDGE: 1600,
}))

const withPhoto = (id: string) => makeCard({ id, front_image_path: `u/${id}-front.webp`, back_image_path: null })

beforeEach(() => {
  touchUp.mockReset()
  touchUp.mockImplementation(async (pixels) => ({ pixels, changes: ['lighting'] }))
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
})

describe('useTouchUpBatch', () => {
  it('shows a batch, gets the next one ready behind it, and shows that one without redoing it', async () => {
    const [a, b, c] = ['a', 'b', 'c'].map(withPhoto)
    const { result } = renderHook(() => useTouchUpBatch())

    await act(() => result.current.load([a, b], [c]))
    expect(result.current.batch?.changed.map((r) => r.card.id)).toEqual(['a', 'b'])
    await waitFor(() => expect(touchUp).toHaveBeenCalledTimes(3)) // c, in the background

    await act(() => result.current.load([c], []))
    expect(result.current.progress).toBeNull()
    expect(result.current.batch?.changed.map((r) => r.card.id)).toEqual(['c'])
    expect(touchUp).toHaveBeenCalledTimes(3)
    expect(URL.revokeObjectURL).toHaveBeenCalled() // the first batch's photos were let go
  })

  it('passes over a card whose photo fails, and lists cards with nothing to change as unchanged', async () => {
    const [a, b] = ['a', 'b'].map(withPhoto)
    touchUp.mockImplementationOnce(async () => {
      throw new Error('decode failed')
    })
    touchUp.mockImplementationOnce(async (pixels) => ({ pixels, changes: [] }))
    const { result } = renderHook(() => useTouchUpBatch())
    await act(() => result.current.load([a, b], []))
    expect(result.current.batch).toMatchObject({ changed: [], failed: [{ id: 'a' }] })
  })

  it('does not straighten a photo that was straightened at capture', async () => {
    const card = makeCard({ id: 'f', front_image_path: 'u/f-front-flat.webp', back_image_path: null })
    const { result } = renderHook(() => useTouchUpBatch())
    await act(() => result.current.load([card], []))
    expect(touchUp).toHaveBeenCalledWith(expect.anything(), { straighten: false, maxEdge: 1600 })
  })
})
