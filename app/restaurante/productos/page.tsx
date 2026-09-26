import Link from 'next/link'
import { redirect } from 'next/navigation'
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
import { TableShell } from '@/components/ui/table-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { getPagination } from '@/lib/pagination'
import { PlusIcon, PackageOpenIcon } from 'lucide-react'

export default async function RestaurantProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const supabase = await createClient()
  const { page } = await searchParams

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_id', user!.id)
    .single()

  const { data: member } = await supabase
    .from('restaurant_members')
    .select('restaurant_id')
    .eq('user_id', profile!.id)
    .single()

  const restaurantId = member?.restaurant_id ?? null

  if (!restaurantId) redirect('/restaurante')

  // Defensa en profundidad: además de la policy "products_select_owner",
  // filtramos explícitamente por nuestro restaurante. La policy pública
  // "products_select_customer" (migración 20260920201230) no excluía al rol
  // RESTAURANT, así que confiar solo en RLS mostraba el catálogo ajeno.
  const getCount = supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)

  const total = (await getCount).count ?? 0
  const pagination = getPagination(total, page)

  const { data: products, error } = await supabase
    .from('products')
    .select(
      'id, name, description, price, image_url, image_file_id, available, category_id, restaurant_id'
    )
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .range(pagination.start, pagination.end - 1)

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('restaurant_id', restaurantId)
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
          <Button
            variant="lime"
            render={<Link href="/restaurante/productos/nuevo" />}
            nativeButton={false}
          >
            <PlusIcon />
            Nuevo producto
          </Button>
        }
      />

      {error && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          No se pudo cargar tu catálogo.
        </p>
      )}

      {!error && products && products.length > 0 && (
        <TableShell className="mt-6">
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
        </TableShell>
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
        <EmptyState
          icon={PackageOpenIcon}
          title="Todavía no tienes productos"
          description="Crea el primero para que empiece a aparecer en tu carta pública."
          className="mt-10"
        />
      )}
    </PageContainer>
  )
}