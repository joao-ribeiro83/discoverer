import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import { formatDate, formatNumber, formatInteger } from '@/lib/format'

function Sample() {
  const { t } = useTranslation(['common'])
  return (
    <div>
      <span data-testid="save">{t('common:actions.save')}</span>
      <span data-testid="close">{t('common:actions.close')}</span>
      <span data-testid="selected">{t('common:rows.selected', { count: 3 })}</span>
      <span data-testid="selected-one">{t('common:rows.selected', { count: 1 })}</span>
    </div>
  )
}

async function changeLanguage(lng: string) {
  await act(async () => {
    await i18n.changeLanguage(lng)
  })
}

describe('i18n', () => {
  afterEach(async () => {
    await changeLanguage('en')
  })

  it('renders the en baseline resources', async () => {
    await changeLanguage('en')
    render(<Sample />)
    expect(screen.getByTestId('save')).toHaveTextContent('Save')
  })

  it('interpolates values and applies pluralization', async () => {
    await changeLanguage('en')
    render(<Sample />)
    expect(screen.getByTestId('selected')).toHaveTextContent('3 rows selected')
    expect(screen.getByTestId('selected-one')).toHaveTextContent('1 row selected')
  })

  it('uses a translated value when the active locale provides one', async () => {
    render(<Sample />)
    await changeLanguage('pt-PT')
    expect(screen.getByTestId('save')).toHaveTextContent('Guardar')
  })

  it('falls back to en when a key is missing in the active locale', async () => {
    // Inject a synthetic en-only key rather than relying on some namespace
    // happening to be incomplete in a locale — every locale is now fully
    // translated (Sessions 7.5–7.7), so an incidental gap can't be counted
    // on to still exist.
    i18n.addResourceBundle('en', 'common', { e2eProbe: { missing: 'English Fallback' } }, true, true)
    render(<Sample />)
    await changeLanguage('es-ES')
    expect(screen.getByTestId('save')).toHaveTextContent('Guardar')
    expect(i18n.t('common:e2eProbe.missing')).toBe('English Fallback')
  })

  it('re-renders translated text when the locale switches at runtime', async () => {
    render(<Sample />)
    await changeLanguage('en')
    expect(screen.getByTestId('save')).toHaveTextContent('Save')
    await changeLanguage('es-ES')
    expect(screen.getByTestId('save')).toHaveTextContent('Guardar')
  })
})

describe('locale-aware formatting', () => {
  it('formats integers with locale grouping', () => {
    expect(formatInteger(1000, 'en')).toBe('1,000')
  })

  it('formats numbers differently across locales', () => {
    const en = formatNumber(1234.5, 'en')
    const fr = formatNumber(1234.5, 'fr-FR')
    expect(en).toBe('1,234.5')
    expect(fr).not.toBe(en)
  })

  it('returns empty string for invalid input', () => {
    expect(formatNumber(Number.NaN, 'en')).toBe('')
    expect(formatDate(null, 'en')).toBe('')
    expect(formatDate('not-a-date', 'en')).toBe('')
  })

  it('formats a valid date without throwing', () => {
    expect(formatDate('2026-07-20T00:00:00Z', 'en')).not.toBe('')
  })
})
