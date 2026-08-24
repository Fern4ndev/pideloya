'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RestaurantRegisterForm } from './RestaurantRegisterForm'
import { DeliveryRegisterForm } from './DeliveryRegisterForm'

export function JoinSection() {
  return (
    <section id="unete" className="mx-auto max-w-lg px-4 py-16">
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          Únete a PideloYa
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Suma tu negocio o empieza a repartir en Abancay.
        </p>
      </div>

      <Tabs defaultValue="restaurante" className="mt-8">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="restaurante">Soy restaurante</TabsTrigger>
          <TabsTrigger value="repartidor">Soy repartidor</TabsTrigger>
        </TabsList>
        <TabsContent value="restaurante" className="mt-6">
          <RestaurantRegisterForm />
        </TabsContent>
        <TabsContent value="repartidor" className="mt-6">
          <DeliveryRegisterForm />
        </TabsContent>
      </Tabs>
    </section>
  )
}