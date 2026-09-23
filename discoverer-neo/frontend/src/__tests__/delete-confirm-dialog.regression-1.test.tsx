// Regression: ISSUE-001 — deleting a run warned that the map would be deactivated
// Found by /qa on 2026-09-23
// Report: .gstack/qa-reports/qa-report-localhost-5174-2026-09-23.md
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog'

describe('DeleteConfirmDialog description', () => {
  it('shows the caller description instead of the soft-delete wording', () => {
    render(
      <DeleteConfirmDialog
        open
        onOpenChange={() => {}}
        itemName="Sales by Region"
        description="This permanently deletes this run."
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByText('This permanently deletes this run.')).toBeInTheDocument()
    expect(screen.queryByText('Sales by Region')).toBeNull()
  })

  it('keeps the default wording when no description is given', () => {
    render(
      <DeleteConfirmDialog open onOpenChange={() => {}} itemName="Sales by Region" onConfirm={() => {}} />,
    )
    expect(screen.getByText('Sales by Region')).toBeInTheDocument()
  })
})
