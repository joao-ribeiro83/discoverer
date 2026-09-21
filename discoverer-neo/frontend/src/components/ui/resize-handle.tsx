import { useRef } from 'react'
import { cn } from '@/lib/utils'

interface ResizeHandleProps {
  /** `col` separates panes side by side (drag left/right); `row` stacks them (drag up/down). */
  direction: 'col' | 'row'
  /** Pixels moved since the last call; positive = right/down. */
  onDelta: (delta: number) => void
  /** The pane's current size and its bounds — a focusable separator must announce them. */
  value: number
  min: number
  max: number
  'aria-label': string
  className?: string
}

/** Keyboard step so the handle is usable without a mouse (WCAG 2.5.7). */
const KEY_STEP = 16

/**
 * A splitter bar between two panes. Pointer-driven, and the arrow keys move
 * it too. It knows nothing about sizes — the parent applies the deltas to
 * whichever pane it wants, and persists them if it cares.
 */
export function ResizeHandle({ direction, onDelta, value, min, max, className, ...aria }: ResizeHandleProps) {
  const last = useRef(0)
  const horizontal = direction === 'col'

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={horizontal ? 'vertical' : 'horizontal'}
      aria-label={aria['aria-label']}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      className={cn(
        'shrink-0 select-none bg-border transition-colors hover:bg-primary/50 focus-visible:bg-primary focus-visible:outline-none',
        horizontal ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize',
        className,
      )}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        last.current = horizontal ? e.clientX : e.clientY
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
        const now = horizontal ? e.clientX : e.clientY
        onDelta(now - last.current)
        last.current = now
      }}
      onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
      onKeyDown={(e) => {
        const dec = horizontal ? 'ArrowLeft' : 'ArrowUp'
        const inc = horizontal ? 'ArrowRight' : 'ArrowDown'
        if (e.key === dec) onDelta(-KEY_STEP)
        else if (e.key === inc) onDelta(KEY_STEP)
        else return
        e.preventDefault()
      }}
    />
  )
}

/** A pane size the user can drag, remembered per key in localStorage. */
export function readStoredSize(key: string, fallback: number): number {
  try {
    const raw = window.localStorage.getItem(key)
    const n = raw === null ? Number.NaN : Number(raw)
    return Number.isFinite(n) && n > 0 ? n : fallback
  } catch {
    return fallback
  }
}

export function storeSize(key: string, value: number): void {
  try {
    window.localStorage.setItem(key, String(Math.round(value)))
  } catch {
    // Best-effort — the pane has already resized on screen.
  }
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
