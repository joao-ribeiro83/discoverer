import { useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, Loader2 } from 'lucide-react'
import { apiClient, getErrorMessage } from '@/lib/api'
import { useLocale } from '@/hooks/useLocale'
import { useTheme, SUPPORTED_THEMES, isSupportedTheme } from '@/providers/ThemeProvider'
import { LOCALE_LABELS, isSupportedLocale } from '@/i18n'
import { useToast } from '@/hooks/use-toast'
import { AdminPageWrapper } from '@/components/admin/AdminPageWrapper'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export function SettingsPage() {
  const { t } = useTranslation(['settings', 'common'])
  const { toast } = useToast()
  const { locale, setLocale, supportedLocales } = useLocale()
  const { theme, setTheme } = useTheme()

  const {
    data: preferences,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: async () => (await apiClient.users.getPreferences()).data.data,
  })

  // Once the account's saved preferences load, sync the live language/theme
  // to match them — they already ARE the saved values, so persist:false
  // avoids an immediate redundant PATCH (mirrors ThemeProvider's own
  // account-preference sync).
  useEffect(() => {
    if (!preferences) return
    if (isSupportedLocale(preferences.locale) && preferences.locale !== locale) {
      void setLocale(preferences.locale, { persist: false })
    }
    if (isSupportedTheme(preferences.theme) && preferences.theme !== theme) {
      void setTheme(preferences.theme, { persist: false })
    }
    // Only re-run when the fetched preferences change — locale/theme/setters
    // are intentionally excluded to avoid re-triggering this sync every time
    // the user picks a new value below.
  }, [preferences])

  const saveMutation = useMutation({
    mutationFn: () => apiClient.users.updatePreferences({ locale, theme }),
    onSuccess: () => {
      toast({ title: t('settings:saved') })
    },
    onError: (err) => {
      toast({
        title: t('common:states.error'),
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24" role="status" aria-label={t('common:states.loading')}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <AdminPageWrapper title={t('settings:title')} description={t('settings:subtitle')}>
      {isError && (
        <p className="text-sm text-destructive">{t('common:states.error')}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('settings:language.title')}</CardTitle>
          <CardDescription>{t('settings:language.description')}</CardDescription>
        </CardHeader>
        <CardContent className="max-w-xs space-y-2">
          <Label htmlFor="settings-language">{t('settings:language.label')}</Label>
          <Select
            value={locale}
            onValueChange={(value) => void setLocale(value as typeof locale, { persist: false })}
          >
            <SelectTrigger id="settings-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {supportedLocales.map((code) => (
                <SelectItem key={code} value={code}>
                  {LOCALE_LABELS[code]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings:theme.title')}</CardTitle>
          <CardDescription>{t('settings:theme.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Label className="mb-3 block">{t('settings:theme.label')}</Label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {SUPPORTED_THEMES.map((option) => (
              <button
                key={option}
                type="button"
                data-testid={`theme-swatch-${option}`}
                aria-pressed={theme === option}
                onClick={() => void setTheme(option, { persist: false })}
                className={cn(
                  'flex flex-col overflow-hidden rounded-lg border-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  theme === option ? 'border-primary' : 'border-transparent hover:border-muted-foreground/30'
                )}
              >
                {/* Scoping data-theme to this preview box renders each swatch
                    in its own theme's real colors, independent of whichever
                    theme is currently applied to the page. */}
                <div data-theme={option} className="space-y-2 bg-background p-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-primary" />
                    <div className="h-2 flex-1 rounded bg-muted" />
                  </div>
                  <div className="h-2 w-3/4 rounded bg-muted" />
                  <div className="h-2 w-1/2 rounded bg-muted" />
                  <div className="mt-2 h-6 w-16 rounded bg-primary" />
                </div>
                <div className="flex items-center justify-between border-t bg-card px-3 py-2 text-sm font-medium text-card-foreground">
                  <span>{t(`settings:theme.options.${option}`)}</span>
                  {theme === option && <Check className="h-4 w-4 text-primary" />}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? t('common:actions.saving') : t('common:actions.save')}
        </Button>
      </div>
    </AdminPageWrapper>
  )
}
