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
    .select(
      'id, name, description, price, image_url, image_file_id, available, category_id, restaurant_id'
    )
    .order('created_at', { ascending: false })
    .range(pagination.start, pagination.end - 1)

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .order('sort_order', { ascending: true })

  const rows =
    products?.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? '',
      price: String(p.price),
      imageUrl: p.image_url ?? '',
      imageFileId: p.image_file_id ?? '',
      available: p.available,
      categoryId: p.category_id ?? '',
      restaurantId: p.restaurant_id,
    })) ?? []

  return (
    <PageContainer size="full">
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
                <TableHead className="w-12">N°</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((product, index) => (
                <TableRow key={product.id}>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {pagination.start + index + 1}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      {product.name}
                    </div>
                  </TableCell>
                  <TableCell>S/ {Number(product.price).toFixed(2)}</TableCell>
                  <TableCell>
                    {product.available ? (
                      <Badge variant="secondary">Disponible</Badge>
                    ) : (
                      <Badge variant="outline">No disponible</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <ProductRowActions
                      product={product}
                      categories={categories ?? []}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!error && products && products.length > 0 && (
        <TablePagination
          alwaysShow
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