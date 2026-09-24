import { createClient } from '@/lib/db/server'
import { CustomerTable } from '@/components/features/admin/CustomerTable'

export default async function UsuariosPage() {
  const supabase = await createClient()

  const { data: customers, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, is_active, created_at')
    .eq('role', 'CUSTOMER')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Revisa y administra los clientes que se registraron con su cuenta de Google.
        </p>
      </div>

      {error && (
        <p className="mt-6 text-sm text-destructive">
          No se pudo cargar la lista de clientes.
        </p>
      )}

      {!error && customers && customers.length > 0 && (
        <CustomerTable customers={customers} />
      )}

      {!error && customers && customers.length === 0 && (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Todavía no hay clientes registrados.
        </p>
      )}
    </div>
  )
}
