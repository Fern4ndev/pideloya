import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { SetPasswordForm } from '@/components/features/auth/SetPasswordForm'

export default async function SetPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Se llega aquí solo desde el link de invitación (vía /api/auth/callback,
  // que ya deja la sesión activa). Sin sesión, no hay nada que hacer aquí.
  if (!user) {
    redirect('/login')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-900">
          Crea tu contraseña
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Es la última vez que la vas a necesitar escribir para entrar a
          PideloYa desde aquí.
        </p>

        <div className="mt-6">
          <SetPasswordForm />
        </div>
      </div>
    </main>
  )
}