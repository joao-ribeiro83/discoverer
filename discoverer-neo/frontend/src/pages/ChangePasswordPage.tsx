import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Loader2 } from 'lucide-react'

import { apiClient, getErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/** Must match the backend's MIN_PASSWORD_LENGTH. */
const MIN_PASSWORD_LENGTH = 12

function buildSchema(t: (key: string) => string) {
  return z
    .object({
      currentPassword: z.string().min(1, t('auth:changePassword.currentRequired')),
      newPassword: z.string().min(MIN_PASSWORD_LENGTH, t('auth:changePassword.tooShort')),
      confirmPassword: z.string().min(1, t('auth:changePassword.confirmRequired')),
    })
    .refine((v) => v.newPassword === v.confirmPassword, {
      path: ['confirmPassword'],
      message: t('auth:changePassword.mismatch'),
    })
    .refine((v) => v.newPassword !== v.currentPassword, {
      path: ['newPassword'],
      message: t('auth:changePassword.mustDiffer'),
    })
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>

/**
 * Forced password rotation for an account provisioned with a temporary
 * password (EUL migration).
 *
 * This screen is a convenience, not the control: the API refuses every other
 * route while `mustChangePassword` is set, so a user who skips the UI simply
 * gets 403s. That is deliberate — a front-end-only prompt would be decoration.
 */
export function ChangePasswordPage() {
  const { t } = useTranslation(['auth', 'common'])
  const { toast } = useToast()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(buildSchema(t)),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      apiClient.auth.changePassword(values.currentPassword, values.newPassword),
    onSuccess: () => {
      // Clear the flag locally so ProtectedRoute stops redirecting here; the
      // existing token stays valid because the backend re-reads the flag from
      // the database on every request.
      if (user) setUser({ ...user, mustChangePassword: false })
      toast({ title: t('auth:changePassword.success') })
      void navigate('/', { replace: true })
    },
    onError: (err) => setServerError(getErrorMessage(err)),
  })

  const forced = user?.mustChangePassword === true

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            {t('auth:changePassword.title')}
          </CardTitle>
          <CardDescription>
            {forced
              ? t('auth:changePassword.forcedDescription')
              : t('auth:changePassword.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              // handleSubmit returns a promise; the DOM handler expects void.
              void form.handleSubmit((values) => {
                setServerError(null)
                mutation.mutate(values)
              })(e)
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="currentPassword">
                {forced
                  ? t('auth:changePassword.temporaryPasswordLabel')
                  : t('auth:changePassword.currentPasswordLabel')}
              </Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                {...form.register('currentPassword')}
              />
              {form.formState.errors.currentPassword && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.currentPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('auth:changePassword.newPasswordLabel')}</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                {...form.register('newPassword')}
              />
              <p className="text-xs text-muted-foreground">
                {t('auth:changePassword.lengthHint', { count: MIN_PASSWORD_LENGTH })}
              </p>
              {form.formState.errors.newPassword && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.newPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                {t('auth:changePassword.confirmPasswordLabel')}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                {...form.register('confirmPassword')}
              />
              {form.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            {serverError && (
              <p role="alert" className="text-sm text-destructive">
                {serverError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('auth:changePassword.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
