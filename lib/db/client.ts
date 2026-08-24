import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

/**
 * Cliente de Supabase para Client Components ("use client").
 * Úsalo en formularios, hooks (use-cart, use-auth) y cualquier
 * componente interactivo que corra en el navegador.
 *
 * NO uses este cliente dentro de Server Components o Server Actions —
 * para eso está lib/db/server.ts.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}