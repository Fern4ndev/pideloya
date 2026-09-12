import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { PasswordLoginForm } from '@/components/features/auth/PasswordLoginForm'
import { Logo } from '@/components/shared/Logo'

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'El correo o la contraseña no son correctos.',
  account_inactive: 'Tu cuenta aún no ha sido aprobada.',
}

const ROLE_HOME: Record<string, string> = {
  CUSTOMER: '/cliente',
  RESTAURANT: '/restaurante',
  DELIVERY: '/repartidor',
  ADMIN: '/admin',
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('auth_id', user.id)
      .single()

    redirect(ROLE_HOME[profile?.role ?? 'CUSTOMER'])
  }

  const errorMessage = params.error ? ERROR_MESSAGES[params.error] : null

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex justify-center">
          <Logo className="mb-4" height={60} />
        </div>

        <h1 className="text-center text-xl font-semibold text-card-foreground">
          Iniciar sesión — Administrador
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Gestiona tu plataforma PideloYa
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
