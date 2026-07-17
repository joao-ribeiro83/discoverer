import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import {
  ParameterPromptDialog,
  needsParameterPrompt,
  type PromptableParameter,
} from '@/components/parameters/ParameterPromptDialog'

function param(over: Partial<PromptableParameter> = {}): PromptableParameter {
  return {
    id: 'p1',
    name: 'Region',
    paramType: 'STRING',
    defaultValue: null,
    isRequired: false,
    ...over,
  }
}

describe('needsParameterPrompt', () => {
  it('is false when there are no parameters', () => {
    expect(needsParameterPrompt([])).toBe(false)
  })

  it('is false when every parameter already has a usable default', () => {
    expect(
      needsParameterPrompt([param({ defaultValue: 'East' }), param({ defaultValue: '0' })]),
    ).toBe(false)
  })

  it('is true when any parameter lacks a default', () => {
    expect(needsParameterPrompt([param({ defaultValue: 'East' }), param({ defaultValue: null })])).toBe(
      true,
    )
    expect(needsParameterPrompt([param({ defaultValue: '' })])).toBe(true)
  })
})

describe('ParameterPromptDialog', () => {
  it('pre-fills each input from its parameter default', () => {
    render(
      <ParameterPromptDialog
        parameters={[param({ id: 'p1', name: 'Region', defaultValue: 'East' })]}
        open
        onOpenChange={() => {}}
        onSubmit={() => {}}
      />,
    )
    expect(screen.getByLabelText('Region')).toHaveValue('East')
  })

  it('renders a date input for DATE parameters and a number input for NUMBER', () => {
    render(
      <ParameterPromptDialog
        parameters={[
          param({ id: 'p1', name: 'StartDate', paramType: 'DATE' }),
          param({ id: 'p2', name: 'MinAmount', paramType: 'NUMBER' }),
        ]}
        open
        onOpenChange={() => {}}
        onSubmit={() => {}}
      />,
    )
    expect(screen.getByLabelText('StartDate')).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('MinAmount')).toHaveAttribute('type', 'number')
  })

  it('blocks submit and shows an error when a required parameter is empty', async () => {
    const onSubmit = vi.fn()
    render(
      <ParameterPromptDialog
        parameters={[param({ id: 'p1', name: 'Region', isRequired: true, defaultValue: null })]}
        open
        onOpenChange={() => {}}
        onSubmit={onSubmit}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    expect(await screen.findByText('This parameter is required.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits collected, trimmed values and omits blank optional parameters', async () => {
    const onSubmit = vi.fn()
    render(
      <ParameterPromptDialog
        parameters={[
          param({ id: 'p1', name: 'Region', isRequired: true }),
          param({ id: 'p2', name: 'Notes', isRequired: false }),
        ]}
        open
        onOpenChange={() => {}}
        onSubmit={onSubmit}
      />,
    )
    fireEvent.change(screen.getByLabelText(/Region/), { target: { value: '  East  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledWith({ Region: 'East' })
  })
})
