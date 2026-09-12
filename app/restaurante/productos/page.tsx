import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ProductRowActions } from '@/components/features/products/ProductRowActions'

export default async function RestaurantProductsPage() {
  const supabase = await createClient()

  // No filtramos por restaurant_id: la policy "products_select_owner"
  // ya limita el resultado a los productos del restaurante del usuario.
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, price, available, image_url')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lo que ven tus clientes en tu carta.
          </p>
        </div>
        <Button render={<Link href="/restaurante/productos/nuevo" />} nativeButton={false}>
          Nuevo producto
        </Button>
      </div>

      {error && (
        <p className="mt-6 text-sm text-destructive">
          No se pudo cargar tu catálogo.
        </p>
      )}

      {!error && products && products.length > 0 && (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>S/ {Number(p.price).toFixed(2)}</TableCell>
                <TableCell>
                  {p.available ? (
                    <Badge variant="secondary">Disponible</Badge>
                  ) : (
                    <Badge variant="outline">No disponible</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <ProductRowActions productId={p.id} available={p.available} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {!error && products && products.length === 0 && (
        <div className="mt-10 flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
          <p className="font-medium">Todavía no tienes productos</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Crea el primero para que empiece a aparecer en tu carta pública.
          </p>
        </div>
      )}
    </div>
  )
}
