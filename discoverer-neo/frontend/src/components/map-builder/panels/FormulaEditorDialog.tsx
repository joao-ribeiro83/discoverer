import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor as MonacoEditorNS } from 'monaco-editor'
import { Loader2 } from 'lucide-react'
import i18n from '@/i18n'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { apiClient, getErrorMessage } from '@/lib/api'
import { useMapBuilderStore, columnLabel } from '@/store/mapBuilder'

// Mirrors the scalar allowlist in
// `backend/src/services/calculated-field-evaluator.ts` (grouped for this
// reference sidebar — arithmetic/string/date/conditional per the session
// spec). Keep in sync if that allowlist changes; this list is developer
// guidance only, not enforced server-side by this file.
const FUNCTION_CATEGORIES: { labelKey: string; functions: string[] }[] = [
  {
    labelKey: 'mapBuilder:panels.formula.categories.arithmetic',
    functions: ['ROUND', 'TRUNC', 'FLOOR', 'CEIL', 'ABS', 'MOD', 'POWER', 'SQRT', 'SIGN', 'GREATEST', 'LEAST'],
  },
  {
    labelKey: 'mapBuilder:panels.formula.categories.string',
    functions: [
      'UPPER',
      'LOWER',
      'INITCAP',
      'LENGTH',
      'SUBSTR',
      'TRIM',
      'LTRIM',
      'RTRIM',
      'INSTR',
      'REPLACE',
      'CONCAT',
      'LPAD',
      'RPAD',
    ],
  },
  {
    labelKey: 'mapBuilder:panels.formula.categories.date',
    functions: ['TO_CHAR', 'TO_DATE', 'ADD_MONTHS', 'MONTHS_BETWEEN', 'LAST_DAY'],
  },
  {
    labelKey: 'mapBuilder:panels.formula.categories.conditional',
    functions: ['NVL', 'NVL2', 'COALESCE', 'DECODE', 'TO_NUMBER', 'CASE'],
  },
]

const ALL_FUNCTION_NAMES = new Set(
  FUNCTION_CATEGORIES.flatMap((c) => c.functions).filter((f) => f !== 'CASE'),
)
const KEYWORDS = new Set(['CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'LIKE'])

/**
 * Lightweight client-side heuristic: balanced parens/brackets/quotes,
 * non-empty, every `NAME(` call resolves to an allowlisted function, and
 * every `[Bracket]` column reference resolves to a known name. This is
 * deliberately NOT a reimplementation of the backend's tokenizer/AST (see
 * `calculated-field-evaluator.ts`) — it is a fast, approximate check to catch
 * obvious typos before hitting "Test formula". Bare (non-bracketed) column
 * references are accepted by the backend grammar too but are not validated
 * here, to avoid false positives from a naive regex.
 */
export function validateFormulaHeuristic(formula: string, knownReferences: string[]): string[] {
  const errors: string[] = []
  const trimmed = formula.trim()
  if (!trimmed) {
    errors.push(i18n.t('mapBuilder:panels.formula.errors.empty'))
    return errors
  }

  // Strip string literal contents ('' is an escaped quote) so they don't
  // confuse paren/bracket balance checks below.
  const withoutStrings = trimmed.replace(/'(?:[^']|'')*'/g, "''")

  const singleQuotes = (withoutStrings.match(/'/g) ?? []).length
  if (singleQuotes % 2 !== 0) errors.push(i18n.t('mapBuilder:panels.formula.errors.unbalancedQuotes'))

  let depth = 0
  let unbalancedParens = false
  for (const ch of withoutStrings) {
    if (ch === '(') depth += 1
    else if (ch === ')') depth -= 1
    if (depth < 0) {
      unbalancedParens = true
      break
    }
  }
  if (unbalancedParens || depth !== 0) {
    errors.push(i18n.t('mapBuilder:panels.formula.errors.unbalancedParens'))
  }

  const openBrackets = (withoutStrings.match(/\[/g) ?? []).length
  const closeBrackets = (withoutStrings.match(/\]/g) ?? []).length
  if (openBrackets !== closeBrackets) {
    errors.push(i18n.t('mapBuilder:panels.formula.errors.unbalancedBrackets'))
  }

  const known = new Set(knownReferences.map((r) => r.toUpperCase()))

  const seenFunctions = new Set<string>()
  const callRe = /([A-Za-z_][A-Za-z0-9_$#]*)\s*\(/g
  let match: RegExpExecArray | null
  while ((match = callRe.exec(withoutStrings))) {
    const name = match[1].toUpperCase()
    if (KEYWORDS.has(name) || ALL_FUNCTION_NAMES.has(name) || seenFunctions.has(name)) continue
    seenFunctions.add(name)
    errors.push(i18n.t('mapBuilder:panels.formula.errors.unknownFunction', { name: match[1] }))
  }

  const seenRefs = new Set<string>()
  const bracketRe = /\[([^\]]+)\]/g
  while ((match = bracketRe.exec(withoutStrings))) {
    const name = match[1].trim()
    const upper = name.toUpperCase()
    if (known.size === 0 || known.has(upper) || seenRefs.has(upper)) continue
    seenRefs.add(upper)
    errors.push(i18n.t('mapBuilder:panels.formula.errors.unknownColumnReference', { name }))
  }

  return errors
}

/** Safe stringification for arbitrary formula-preview result values. */
function formatValue(value: unknown): string {
  if (value == null) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  return JSON.stringify(value)
}

type TestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; columnName: string; values: unknown[] }
  | { status: 'error'; message: string }

export function FormulaEditorDialog({
  fieldKey,
  open,
  onOpenChange,
}: {
  fieldKey: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation(['mapBuilder', 'common'])
  const field = useMapBuilderStore((s) =>
    fieldKey ? s.calculatedFields.find((f) => f.key === fieldKey) : undefined,
  )
  const selectedItems = useMapBuilderStore((s) => s.selectedItems)
  const calculatedFields = useMapBuilderStore((s) => s.calculatedFields)
  const parameters = useMapBuilderStore((s) => s.parameters)
  const mapId = useMapBuilderStore((s) => s.mapId)
  const updateCalculatedField = useMapBuilderStore((s) => s.updateCalculatedField)

  const [formula, setFormula] = useState('')
  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null)
  const [testState, setTestState] = useState<TestState>({ status: 'idle' })

  useEffect(() => {
    if (!open || !field) return
    setFormula(field.formula)
    setTestState({ status: 'idle' })
  }, [open, field])

  const knownReferences = useMemo(
    () => [
      ...selectedItems.map((i) => columnLabel(i)),
      ...calculatedFields.filter((f) => f.key !== fieldKey).map((f) => f.name),
    ],
    [selectedItems, calculatedFields, fieldKey],
  )

  const validationErrors = useMemo(
    () => validateFormulaHeuristic(formula, knownReferences),
    [formula, knownReferences],
  )

  const handleMount: OnMount = (editorInstance) => {
    editorRef.current = editorInstance
  }

  function insertText(text: string) {
    const editorInstance = editorRef.current
    const selection = editorInstance?.getSelection()
    const model = editorInstance?.getModel()
    if (editorInstance && selection && model) {
      const start = model.getOffsetAt(selection.getStartPosition())
      const end = model.getOffsetAt(selection.getEndPosition())
      setFormula((f) => f.slice(0, start) + text + f.slice(end))
      editorInstance.focus()
      return
    }
    setFormula((f) => `${f}${text}`)
  }

  function handleSave() {
    if (!fieldKey) return
    updateCalculatedField(fieldKey, { formula })
    onOpenChange(false)
  }

  async function handleTest() {
    if (!mapId || !field) return
    setTestState({ status: 'loading' })
    try {
      const paramValues: Record<string, unknown> = {}
      for (const p of parameters) {
        if (p.defaultValue != null && p.defaultValue !== '') paramValues[p.name] = p.defaultValue
      }
      const res = await apiClient.maps.execute(mapId, {
        parameters: paramValues,
        calculatedFields: [{ name: field.name, formula, displayOrder: field.displayOrder }],
      })
      const rows = res.data.data.rows.slice(0, 5)
      setTestState({
        status: 'success',
        columnName: field.name,
        values: rows.map((r) => r[field.name]),
      })
    } catch (err) {
      setTestState({ status: 'error', message: getErrorMessage(err) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('mapBuilder:panels.formula.title')}</DialogTitle>
          <DialogDescription>
            {field ? field.name : t('mapBuilder:panels.formula.fallbackFieldName')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_220px] gap-4">
          <div className="space-y-2">
            <div className="overflow-hidden rounded-md border">
              <Editor
                height="220px"
                defaultLanguage="sql"
                value={formula}
                onChange={(v) => setFormula(v ?? '')}
                onMount={handleMount}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                }}
              />
            </div>

            {validationErrors.length > 0 && (
              <ul className="space-y-0.5 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
                {validationErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void handleTest()}
                disabled={!mapId || !field || testState.status === 'loading'}
              >
                {testState.status === 'loading' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t('mapBuilder:panels.formula.testFormula')}
              </Button>
              {!mapId && (
                <span className="text-xs text-muted-foreground">
                  {t('mapBuilder:panels.formula.saveHint')}
                </span>
              )}
            </div>

            {testState.status === 'success' && (
              <div className="rounded-md border bg-muted/30 p-2 text-xs">
                <p className="mb-1 font-medium">
                  {t('mapBuilder:panels.formula.previewHeader', {
                    columnName: testState.columnName,
                    count: testState.values.length,
                  })}
                </p>
                <p className="font-mono">
                  {testState.values.length > 0
                    ? testState.values.map(formatValue).join(', ')
                    : t('mapBuilder:panels.formula.noRows')}
                </p>
              </div>
            )}
            {testState.status === 'error' && (
              <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                {testState.message}
              </p>
            )}
          </div>

          <ScrollArea className="h-[280px] rounded-md border p-2">
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">
                  {t('mapBuilder:panels.formula.columnsHeader')}
                </p>
                <div className="flex flex-wrap gap-1">
                  {selectedItems.map((item) => (
                    <Badge
                      key={item.key}
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => insertText(`[${columnLabel(item)}]`)}
                    >
                      {columnLabel(item)}
                    </Badge>
                  ))}
                  {selectedItems.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t('mapBuilder:panels.formula.noColumnsYet')}
                    </p>
                  )}
                </div>
              </div>

              {FUNCTION_CATEGORIES.map((cat) => (
                <div key={cat.labelKey}>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">{t(cat.labelKey)}</p>
                  <div className="flex flex-wrap gap-1">
                    {cat.functions.map((fn) => (
                      <Badge
                        key={fn}
                        variant="outline"
                        className="cursor-pointer font-mono"
                        onClick={() =>
                          insertText(fn === 'CASE' ? 'CASE WHEN  THEN  ELSE  END' : `${fn}()`)
                        }
                      >
                        {fn}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="button" onClick={handleSave} disabled={!field}>
            {t('common:actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
