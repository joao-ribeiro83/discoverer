import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { AUTH_USER, jsonRoute, makeFakeJwt } from './fixtures'

test.describe('Login', () => {
  test('unauthenticated visit redirects to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Discoverer Neo' })).toBeVisible()
  })

  test('signs in with valid credentials and redirects to dashboard', async ({ page }) => {
    await page.route('**/api/auth/login', (route) =>
      jsonRoute(route, { data: { token: makeFakeJwt(), user: AUTH_USER } }),
    )
    await page.route(/\/api\/maps(\?.*)?$/, (route) => jsonRoute(route, { data: { all: [] } }))
    await page.route(
      /\/api\/dashboard\/stats$/,
      (route) => jsonRoute(route, { data: { totalExecutions: 0, scheduledMaps: 0, scheduledResults: 0 } }),
    )

    await page.goto('/login')
    await page.getByLabel('Email').fill(AUTH_USER.email)
    await page.getByLabel('Password').fill('correct-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible()
  })

  test('shows an inline error on invalid credentials and stays on the page', async ({ page }) => {
    await page.route('**/api/auth/login', (route) =>
      jsonRoute(route, { error: 'Invalid email or password' }, 401),
    )

    await page.goto('/login')
    await page.getByLabel('Email').fill(AUTH_USER.email)
    await page.getByLabel('Password').fill('wrong-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByRole('alert')).toHaveText('Invalid email or password')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('rejects an empty form with client-side validation', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Email is required')).toBeVisible()
    await expect(page.getByText('Password is required')).toBeVisible()
  })

  test('has no detectable accessibility violations', async ({ page }) => {
    await page.goto('/login')
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(results.violations).toEqual([])
  })
})
