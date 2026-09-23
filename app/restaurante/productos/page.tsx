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
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { TablePagination } from '@/components/ui/table-pagination'
import { getPagination } from '@/lib/pagination'
import { PlusIcon } from 'lucide-react'

export default async function RestaurantProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const supabase = await createClient()
  const { page } = await searchParams

  // No filtramos por restaurant_id: la policy "products_select_owner"
  // ya limita el resultado a los productos del restaurante del usuario.
  const getCount = supabase
    .from('products')
    .select('id', { count: 'exact', head: true })

  const total = (await getCount).count ?? 0
  const pagination = getPagination(total, page)

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, price, available, image_url')
    .order('created_at', { ascending: false })
    .range(pagination.start, pagination.end - 1)

  return (
    <PageContainer size="lg">
      <PageHeader
        title="Productos"
        description="Lo que ven tus clientes en tu carta."
        action={
          <Button render={<Link href="/restaurante/productos/nuevo" />} nativeButton={false}>
            <PlusIcon />
            Nuevo producto
          </Button>
        }
      />

      {error && (
        <p className="mt-6 text-sm text-destructive">
          No se pudo cargar tu catálogo.
        </p>
      )}

      {!error && products && products.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-2xl border">
          <Table>
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
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {p.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      {p.name}
                    </div>
                  </TableCell>
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
        </div>
      )}

      {!error && products && products.length > 0 && (
        <TablePagination
          basePath="/restaurante/productos"
          page={pagination.page}
          pageCount={pagination.pageCount}
        />
      )}

      {!error && total === 0 && (
        <div className="mt-10 flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
          <p className="font-medium">Todavía no tienes productos</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Crea el primero para que empiece a aparecer en tu carta pública.
          </p>
        </div>
      )}
    </PageContainer>
  )
}