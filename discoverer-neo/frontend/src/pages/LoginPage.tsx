import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, type Location } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuth } from '@/hooks/useAuth'
import { setRememberMe } from '@/store/auth'

type LoginFormValues = z.infer<ReturnType<typeof buildLoginSchema>>

// Built with a translator so validation messages localize with the UI.
function buildLoginSchema(t: (key: string) => string) {
  return z.object({
    email: z
      .string()
      .min(1, t('auth:validation.emailRequired'))
      .email(t('auth:validation.emailInvalid')),
    password: z.string().min(1, t('auth:validation.passwordRequired')),
    rememberMe: z.boolean(),
  })
}

interface LocationState {
  from?: Location
  message?: string
}

export function LoginPage() {
  const { t } = useTranslation(['auth'])
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState<string | null>(null)

  const state = location.state as LocationState | null

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: standardSchemaResolver(buildLoginSchema(t)),
    defaultValues: { email: '', password: '', rememberMe: true },
  })

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null)
    setRememberMe(values.rememberMe)
    try {
      await login(values.email, values.password)
      const redirectTo = state?.from?.pathname ?? '/dashboard'
      void navigate(redirectTo, { replace: true })
    } catch (error) {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        t('auth:login.genericError')
      setServerError(message)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t('auth:login.appName')}</CardTitle>
        <CardDescription>{t('auth:login.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        {state?.message && (
          <div className="mb-4 rounded-md border border-input bg-muted p-3 text-sm text-muted-foreground">
            {state.message}
          </div>
        )}
        {serverError && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {serverError}
          </div>
        )}
        <form
          className="space-y-4"
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth:login.emailLabel')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('auth:login.passwordLabel')}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="rememberMe"
              checked={watch('rememberMe')}
              onCheckedChange={(checked) => setValue('rememberMe', checked === true)}
            />
            <Label htmlFor="rememberMe" className="font-normal">
              {t('auth:login.rememberMe')}
            </Label>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? t('auth:login.submitting') : t('auth:login.submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
