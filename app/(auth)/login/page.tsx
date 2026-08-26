import { signInWithGoogle } from '@/lib/actions/auth'
import { PasswordLoginForm } from '@/components/features/auth/PasswordLoginForm'
import { Logo } from '@/components/shared/Logo'

const ERROR_MESSAGES: Record<string, string> = {
  oauth_init_failed: 'No se pudo iniciar sesión con Google. Intenta de nuevo.',
  auth_callback_error: 'Hubo un problema al confirmar tu sesión. Intenta de nuevo.',
  account_inactive: 'Tu cuenta aún no ha sido aprobada por el administrador.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const params = await searchParams
  const next = params.next ?? '/cliente'
  const errorMessage = params.error ? ERROR_MESSAGES[params.error] : null

  // Server Action "atada" al path de destino: así el form puede seguir
  // siendo un <form action={...}> plano, sin necesitar un input hidden.
  const signInWithGoogleForPath = signInWithGoogle.bind(null, next)

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex justify-center">
          <Logo className="mb-4" height={60} />
        </div>

        <h1 className="text-xl font-semibold text-card-foreground text-center">
          Iniciar sesión
        </h1>
        <p className="mt-1 text-sm text-muted-foreground text-center">
          Pide lo que quieras, cuando quieras...
        </p>

        {errorMessage && (
          <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        )}

        <form action={signInWithGoogleForPath} className="mt-6">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-card-foreground transition hover:bg-accent"
          >
            <GoogleIcon />
            Continuar con Google
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">
            restaurantes y repartidores
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <PasswordLoginForm />
      </div>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.03l3.05-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.97l3.05 2.33C4.66 5.17 6.65 3.58 9 3.58z"
      />
    </svg>
  )
}