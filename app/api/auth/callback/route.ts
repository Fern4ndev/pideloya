import { NextResponse } from 'next/server'
import { createClient } from '@/lib/db/server'

/**
 * Callback de OAuth. Supabase redirige aquí después de que Google
 * autentica al usuario, con un `code` en la query string que hay
 * que intercambiar por una sesión.
 *
 * Esta lógica DEBE vivir en un Route Handler (no en un Server Action)
 * porque Supabase construye la URL de redirect apuntando directo a
 * esta ruta — no hay forma de que sea una Server Action.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // `next` es la ruta a la que queremos volver después del login
  // (la seteamos nosotros mismos al armar la URL de login, ver auth.ts)
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Algo falló en el intercambio: mandamos a login con el error visible.
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}