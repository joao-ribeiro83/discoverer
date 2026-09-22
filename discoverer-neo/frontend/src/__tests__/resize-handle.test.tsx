import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ResizeHandle, readStoredSize, storeSize, clamp } from '@/components/ui/resize-handle'

// jsdom doesn't implement setPointerCapture at all (unlike hasPointerCapture /
// releasePointerCapture, which src/test/setup.ts already stubs), so a bare
// pointerDown on the handle throws. Stub it here, test-local only.
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {}
}

// jsdom also has no PointerEvent constructor at all, so @testing-library's
// fireEvent.pointerDown/Move silently fall back to a bare Event whose
// clientX/clientY/pointerId are never set. Build the event by hand instead —
// a plain Event happily accepts extra own properties, and that's all the
// component's onPointerDown/onPointerMove handlers read off it.
function firePointer(el: Element, type: string, props: Record<string, unknown>) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { pointerId: 1, ...props })
  fireEvent(el, event)
}

describe('ResizeHandle', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('announces orientation and value/min/max for a column (vertical) splitter', () => {
    render(<ResizeHandle direction="col" onDelta={vi.fn()} value={240.4} min={100} max={400} aria-label="Sidebar" />)
    const handle = screen.getByRole('separator', { name: 'Sidebar' })
    expect(handle).toHaveAttribute('aria-orientation', 'vertical')
    expect(handle).toHaveAttribute('aria-valuenow', '240')
    expect(handle).toHaveAttribute('aria-valuemin', '100')
    expect(handle).toHaveAttribute('aria-valuemax', '400')
  })

  it('announces orientation for a row (horizontal) splitter', () => {
    render(<ResizeHandle direction="row" onDelta={vi.fn()} value={50} min={0} max={100} aria-label="Bottom pane" />)
    expect(screen.getByRole('separator', { name: 'Bottom pane' })).toHaveAttribute('aria-orientation', 'horizontal')
  })

  it('reports the pointer delta while dragging a col handle horizontally', () => {
    vi.spyOn(Element.prototype, 'hasPointerCapture').mockReturnValue(true)
    const onDelta = vi.fn()
    render(<ResizeHandle direction="col" onDelta={onDelta} value={200} min={0} max={400} aria-label="Splitter" />)
    const handle = screen.getByRole('separator', { name: 'Splitter' })

    firePointer(handle, 'pointerdown', { clientX: 100 })
    firePointer(handle, 'pointermove', { clientX: 130 })
    expect(onDelta).toHaveBeenCalledWith(30)

    // A second move reports the delta since the LAST move, not since the start.
    firePointer(handle, 'pointermove', { clientX: 120 })
    expect(onDelta).toHaveBeenCalledWith(-10)

    firePointer(handle, 'pointerup', {})
    expect(onDelta).toHaveBeenCalledTimes(2)
  })

  it('uses clientY instead of clientX for a row handle', () => {
    vi.spyOn(Element.prototype, 'hasPointerCapture').mockReturnValue(true)
    const onDelta = vi.fn()
    render(<ResizeHandle direction="row" onDelta={onDelta} value={200} min={0} max={400} aria-label="Splitter" />)
    const handle = screen.getByRole('separator', { name: 'Splitter' })

    firePointer(handle, 'pointerdown', { clientY: 50 })
    firePointer(handle, 'pointermove', { clientY: 80 })
    expect(onDelta).toHaveBeenCalledWith(30)
  })

  it('ignores pointermove when the pointer was never captured', () => {
    vi.spyOn(Element.prototype, 'hasPointerCapture').mockReturnValue(false)
    const onDelta = vi.fn()
    render(<ResizeHandle direction="col" onDelta={onDelta} value={200} min={0} max={400} aria-label="Splitter" />)
    const handle = screen.getByRole('separator', { name: 'Splitter' })

    firePointer(handle, 'pointermove', { clientX: 999 })
    expect(onDelta).not.toHaveBeenCalled()
  })

  it('moves by KEY_STEP on ArrowRight/ArrowLeft for a col handle, and ignores other keys', () => {
    const onDelta = vi.fn()
    render(<ResizeHandle direction="col" onDelta={onDelta} value={200} min={0} max={400} aria-label="Splitter" />)
    const handle = screen.getByRole('separator', { name: 'Splitter' })

    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(onDelta).toHaveBeenLastCalledWith(16)
    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    expect(onDelta).toHaveBeenLastCalledWith(-16)
    fireEvent.keyDown(handle, { key: 'ArrowUp' })
    expect(onDelta).toHaveBeenCalledTimes(2)
  })

  it('moves by KEY_STEP on ArrowDown/ArrowUp for a row handle', () => {
    const onDelta = vi.fn()
    render(<ResizeHandle direction="row" onDelta={onDelta} value={200} min={0} max={400} aria-label="Splitter" />)
    const handle = screen.getByRole('separator', { name: 'Splitter' })

    fireEvent.keyDown(handle, { key: 'ArrowDown' })
    expect(onDelta).toHaveBeenLastCalledWith(16)
    fireEvent.keyDown(handle, { key: 'ArrowUp' })
    expect(onDelta).toHaveBeenLastCalledWith(-16)
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(onDelta).toHaveBeenCalledTimes(2)
  })
})

describe('readStoredSize', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the fallback when nothing is stored', () => {
    expect(readStoredSize('missing-key', 250)).toBe(250)
  })

  it('returns the stored number when it is a valid positive size', () => {
    window.localStorage.setItem('pane', '312')
    expect(readStoredSize('pane', 250)).toBe(312)
  })

  it('falls back for a non-numeric or non-positive stored value', () => {
    window.localStorage.setItem('pane', 'not-a-number')
    expect(readStoredSize('pane', 250)).toBe(250)

    window.localStorage.setItem('pane', '-10')
    expect(readStoredSize('pane', 250)).toBe(250)

    window.localStorage.setItem('pane', '0')
    expect(readStoredSize('pane', 250)).toBe(250)
  })

  it('falls back when localStorage.getItem throws', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readStoredSize('pane', 250)).toBe(250)
  })
})

describe('storeSize', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rounds and stores the size', () => {
    storeSize('pane', 312.7)
    expect(window.localStorage.getItem('pane')).toBe('313')
  })

  it('is a best-effort no-op when localStorage.setItem throws', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => storeSize('pane', 100)).not.toThrow()
  })
})

describe('clamp', () => {
  it('passes values already within range through unchanged', () => {
    expect(clamp(50, 0, 100)).toBe(50)
  })

  it('clamps to the minimum', () => {
    expect(clamp(-10, 0, 100)).toBe(0)
  })

  it('clamps to the maximum', () => {
    expect(clamp(150, 0, 100)).toBe(100)
  })
})
