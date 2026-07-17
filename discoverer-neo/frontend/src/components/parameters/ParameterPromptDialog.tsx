import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { MapParameter } from '@/lib/types'

/**
 * Minimal shape this dialog needs. Kept narrower than the persisted
 * `MapParameter` (which requires `id`/`mapId`/`createdAt`) so it can also be
 * fed straight from the map builder's client-side, not-yet-saved parameter
 * rows (which key on `key`, not a server `id`).
 */
export interface PromptableParameter {
  id: string
  name: string
  paramType: MapParameter['paramType']
  defaultValue: string | null
  isRequired: boolean
}

function inputType(paramType: PromptableParameter['paramType']): 'text' | 'number' | 'date' {
  if (paramType === 'NUMBER') return 'number'
  if (paramType === 'DATE') return 'date'
  return 'text'
}

/**
 * Whether a map needs to interrupt "Run" with a prompt before executing.
 * Skipped entirely when every declared parameter already has a usable
 * default — the map can just run with those defaults immediately.
 */
export function needsParameterPrompt(
  parameters: Array<Pick<PromptableParameter, 'defaultValue'>>,
): boolean {
  return !parameters.every((p) => p.defaultValue != null && p.defaultValue !== '')
}

interface ParameterPromptDialogProps {
  parameters: PromptableParameter[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: Record<string, unknown>) => void
}

/** Modal collecting run-time parameter values before a map executes. */
export function ParameterPromptDialog({
  parameters,
  open,
  onOpenChange,
  onSubmit,
}: ParameterPromptDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Pre-fill from each parameter's default whenever the dialog (re)opens.
  useEffect(() => {
    if (!open) return
    const initial: Record<string, string> = {}
    for (const p of parameters) initial[p.name] = p.defaultValue ?? ''
    setValues(initial)
    setErrors({})
  }, [open, parameters])

  function handleSubmit() {
    const nextErrors: Record<string, string> = {}
    for (const p of parameters) {
      const value = (values[p.name] ?? '').trim()
      if (p.isRequired && value === '') {
        nextErrors[p.name] = 'This parameter is required.'
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    const collected: Record<string, unknown> = {}
    for (const p of parameters) {
      const value = (values[p.name] ?? '').trim()
      if (value !== '') collected[p.name] = value
    }
    onSubmit(collected)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Run parameters</DialogTitle>
          <DialogDescription>
            Enter values for this map&apos;s parameters, then run.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {parameters.map((p) => (
            <div key={p.id} className="space-y-1.5">
              <Label htmlFor={`param-prompt-${p.id}`}>
                {p.name}
                {p.isRequired && <span className="text-destructive"> *</span>}
              </Label>
              <Input
                id={`param-prompt-${p.id}`}
                type={inputType(p.paramType)}
                value={values[p.name] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}
                placeholder={p.paramType === 'LIST' ? 'comma, separated, values' : undefined}
              />
              {errors[p.name] && <p className="text-sm text-destructive">{errors[p.name]}</p>}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit}>
            Run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
