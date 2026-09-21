import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Braces } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMapBuilderStore } from '@/store/mapBuilder'

/**
 * Discoverer's own title text variables (Edit Title → Insert). The backend
 * substitutes them at run and export time (`substituteTitleTokens`); a
 * parameter is inserted as `&<its name>` the same way.
 */
const BUILT_IN_VARIABLES = ['Date', 'Time', 'Workbook', 'Worksheet'] as const

/**
 * The map description with an "Insert variable" menu: the heading printed
 * above the grid and at the top of every export, so the run date/time and the
 * parameter values a user entered can be written into it without knowing the
 * `&Token` syntax by heart.
 */
export function DescriptionEditor() {
  const { t } = useTranslation(['mapBuilder', 'common'])
  const description = useMapBuilderStore((s) => s.description)
  const setDescription = useMapBuilderStore((s) => s.setDescription)
  const parameters = useMapBuilderStore((s) => s.parameters)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function insert(token: string) {
    const el = textareaRef.current
    const current = description ?? ''
    const start = el?.selectionStart ?? current.length
    const end = el?.selectionEnd ?? current.length
    // A space before the token when it lands right after a word, so
    // `Vendas&Date` does not read as one token.
    const before = current[start - 1] ?? ''
    const needsSpace = /[^\s([]/.test(before)
    const text = `${needsSpace ? ' ' : ''}&${token}`
    const next = current.slice(0, start) + text + current.slice(end)
    setDescription(next)
    // Put the caret after what was inserted once React has re-rendered.
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + text.length, start + text.length)
    })
  }

  const namedParameters = parameters.filter((p) => p.name.trim() !== '')

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="map-description">{t('common:labels.description')}</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
              <Braces className="h-3.5 w-3.5" />
              {t('mapBuilder:panels.properties.insertVariable')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            {BUILT_IN_VARIABLES.map((name) => (
              <DropdownMenuItem key={name} onSelect={() => insert(name)}>
                <span className="flex-1">
                  {t(`mapBuilder:panels.properties.variables.${name.toLowerCase()}`)}
                </span>
                <code className="text-xs text-muted-foreground">&amp;{name}</code>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {t('mapBuilder:panels.properties.variables.parameters')}
            </DropdownMenuLabel>
            {namedParameters.length === 0 ? (
              <DropdownMenuItem disabled>
                {t('mapBuilder:panels.properties.variables.noParameters')}
              </DropdownMenuItem>
            ) : (
              namedParameters.map((p) => (
                <DropdownMenuItem key={p.key} onSelect={() => insert(p.name)}>
                  <span className="flex-1 truncate">{p.name}</span>
                  <code className="text-xs text-muted-foreground">&amp;{p.name}</code>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Textarea
        ref={textareaRef}
        id="map-description"
        rows={4}
        value={description ?? ''}
        onChange={(e) => setDescription(e.target.value || null)}
        placeholder={t('mapBuilder:panels.properties.descriptionPlaceholder')}
      />
      <p className="text-xs text-muted-foreground">
        {t('mapBuilder:panels.properties.variableHint')}
      </p>
    </div>
  )
}
