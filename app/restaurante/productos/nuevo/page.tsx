import { ProductForm } from '@/components/features/products/ProductForm'

export default function NewProductPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Nuevo producto
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Va a aparecer disponible de inmediato en tu carta, a menos que
        desactives el interruptor de abajo.
      </p>

      <div className="mt-6">
        <ProductForm />
      </div>
    </div>
  )
}