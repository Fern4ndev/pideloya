'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RestaurantRegisterForm } from './RestaurantRegisterForm'
import { DeliveryRegisterForm } from './DeliveryRegisterForm'

export function JoinSection() {
  return (
    <section id="unete" className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <span className="inline-block text-sm font-semibold text-brand-600 tracking-wide uppercase mb-4">
            Únete al equipo
          </span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Haz parte de PideloYa</h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            Ya seas restaurante o repartidor, hay un lugar para ti.
          </p>
        </div>

        <Tabs defaultValue="restaurante" className="max-w-xl mx-auto">
          <TabsList className="grid w-full max-w-xs mx-auto grid-cols-2 h-auto p-1 bg-muted rounded-2xl">
            <TabsTrigger
              value="restaurante"
              className="rounded-xl py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground"
            >
              Soy restaurante
            </TabsTrigger>
            <TabsTrigger
              value="repartidor"
              className="rounded-xl py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground"
            >
              Soy repartidor
            </TabsTrigger>
          </TabsList>
          <TabsContent value="restaurante" className="mt-8">
            <RestaurantRegisterForm />
          </TabsContent>
          <TabsContent value="repartidor" className="mt-8">
            <DeliveryRegisterForm />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}
