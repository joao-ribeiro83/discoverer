import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function MapsListPage() {
  const { t } = useTranslation(['mapViewer'])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t('mapViewer:mapsList.title')}</h2>
        <p className="text-muted-foreground">{t('mapViewer:mapsList.description')}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('mapViewer:mapsList.placeholderTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('mapViewer:mapsList.comingSoon')}</p>
        </CardContent>
      </Card>
    </div>
  )
}
