import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToast, toast } from '@/hooks/use-toast'

const REMOVE_DELAY = 4000

/** Dismiss + fully flush every toast in memory state so tests don't bleed into each other. */
function resetToasts() {
  const { result, unmount } = renderHook(() => useToast())
  act(() => {
    result.current.dismiss()
    vi.advanceTimersByTime(REMOVE_DELAY)
  })
  unmount()
}

beforeEach(() => {
  vi.useFakeTimers()
  resetToasts()
})

afterEach(() => {
  resetToasts()
  vi.useRealTimers()
})

describe('useToast', () => {
  it('adds a toast via toast()', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      toast({ title: 'Hello' })
    })

    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].title).toBe('Hello')
    expect(result.current.toasts[0].open).toBe(true)
  })

  it('enforces the toast limit, dropping the oldest', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      toast({ title: 'first' })
      toast({ title: 'second' })
      toast({ title: 'third' })
      toast({ title: 'fourth' })
    })

    expect(result.current.toasts).toHaveLength(3)
    const titles = result.current.toasts.map((t) => t.title)
    expect(titles).toEqual(['fourth', 'third', 'second'])
  })

  it('update() modifies only the matching toast', () => {
    const { result } = renderHook(() => useToast())
    let a!: ReturnType<typeof toast>
    let b!: ReturnType<typeof toast>

    act(() => {
      a = toast({ title: 'A' })
      b = toast({ title: 'B' })
    })

    act(() => {
      a.update({ id: a.id, title: 'A updated' })
    })

    const found = (id: string) => result.current.toasts.find((t) => t.id === id)
    expect(found(a.id)?.title).toBe('A updated')
    expect(found(b.id)?.title).toBe('B')
  })

  it('dismiss(id) closes and removes only that toast', () => {
    const { result } = renderHook(() => useToast())
    let a!: ReturnType<typeof toast>
    let b!: ReturnType<typeof toast>

    act(() => {
      a = toast({ title: 'A' })
      b = toast({ title: 'B' })
    })

    act(() => {
      result.current.dismiss(a.id)
    })

    const found = (id: string) => result.current.toasts.find((t) => t.id === id)
    expect(found(a.id)?.open).toBe(false)
    expect(found(b.id)?.open).toBe(true)

    act(() => {
      vi.advanceTimersByTime(REMOVE_DELAY)
    })

    expect(result.current.toasts.find((t) => t.id === a.id)).toBeUndefined()
    expect(result.current.toasts.find((t) => t.id === b.id)).toBeDefined()
  })

  it('dismiss() with no id closes and removes every toast', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      toast({ title: 'A' })
      toast({ title: 'B' })
    })

    act(() => {
      result.current.dismiss()
    })

    expect(result.current.toasts.every((t) => t.open === false)).toBe(true)

    act(() => {
      vi.advanceTimersByTime(REMOVE_DELAY)
    })

    expect(result.current.toasts).toHaveLength(0)
  })

  it('dismissing the same toast twice only schedules one removal timeout', () => {
    const { result } = renderHook(() => useToast())
    let a!: ReturnType<typeof toast>

    act(() => {
      a = toast({ title: 'A' })
    })

    act(() => {
      result.current.dismiss(a.id)
      result.current.dismiss(a.id) // second call hits the "timeout already queued" branch
    })

    act(() => {
      vi.advanceTimersByTime(REMOVE_DELAY)
    })

    expect(result.current.toasts.find((t) => t.id === a.id)).toBeUndefined()
  })

  it('onOpenChange(false) dismisses the toast; onOpenChange(true) is a no-op', () => {
    const { result } = renderHook(() => useToast())
    let a!: ReturnType<typeof toast>

    act(() => {
      a = toast({ title: 'A' })
    })

    act(() => {
      result.current.toasts.find((t) => t.id === a.id)?.onOpenChange?.(true)
    })
    expect(result.current.toasts.find((t) => t.id === a.id)?.open).toBe(true)

    act(() => {
      result.current.toasts.find((t) => t.id === a.id)?.onOpenChange?.(false)
    })
    expect(result.current.toasts.find((t) => t.id === a.id)?.open).toBe(false)
  })

  it('unsubscribes its listener on unmount without throwing on later dispatches', () => {
    const { unmount } = renderHook(() => useToast())

    unmount()

    expect(() => {
      act(() => {
        toast({ title: 'after unmount' })
      })
    }).not.toThrow()
  })
})
