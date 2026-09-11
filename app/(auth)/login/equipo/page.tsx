import Link from 'next/link'
import { PasswordLoginForm } from '@/components/features/auth/PasswordLoginForm'
import { Logo } from '@/components/shared/Logo'

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'El correo o la contraseña no son correctos.',
  account_inactive: 'Tu cuenta aún no ha sido aprobada por el administrador.',
}

export default async function TeamLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const errorMessage = params.error ? ERROR_MESSAGES[params.error] : null

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex justify-center">
          <Logo className="mb-4" height={60} />
        </div>

        <h1 className="text-center text-xl font-semibold text-card-foreground">
          Iniciar sesión — Equipo
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Accede a tu panel de restaurante o repartidor
        </p>

        {errorMessage && (
          <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        )}

        <div className="mt-6">
          <PasswordLoginForm />
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿Eres cliente?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Inicia sesión con Google
          </Link>
        </p>
      </div>
    </main>
  )
}