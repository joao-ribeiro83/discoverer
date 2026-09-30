import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Go back to the page the user came from. A page opened directly (a pasted
 * link, a new tab) has no in-app history — `location.key` is then 'default' —
 * so it goes to `fallback` instead of leaving the app.
 */
export function BackButton({ fallback, className }: { fallback: string; className?: string }) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      title={t('common:backTooltip')}
      onClick={() => void (location.key !== 'default' ? navigate(-1) : navigate(fallback))}
    >
      <ArrowLeft className="h-4 w-4" /> {t('common:actions.back')}
    </Button>
  )
}
