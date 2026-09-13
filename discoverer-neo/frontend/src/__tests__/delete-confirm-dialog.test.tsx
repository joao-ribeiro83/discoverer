import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog'

describe('DeleteConfirmDialog', () => {
  it('falls back to a default item label when none is given', () => {
    render(
      <DeleteConfirmDialog open itemName="Sales by Region" onOpenChange={vi.fn()} onConfirm={vi.fn()} />,
    )
    expect(screen.getByRole('heading', { name: /Delete item\?/i })).toBeInTheDocument()
  })

  it('shows a pending label on the confirm button while deleting', () => {
    render(
      <DeleteConfirmDialog
        open
        itemName="Sales by Region"
        itemLabel="worksheet"
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        isPending
      />,
    )
    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeInTheDocument()
  })
})
