'use client'

import { Icon } from '@iconify-icon/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RestaurantRegisterForm } from './RestaurantRegisterForm'
import { DeliveryRegisterForm } from './DeliveryRegisterForm'

export function JoinSection() {
  return (
    <section id="unete" className="relative py-28 px-6 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/30 to-background" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-brand-500/5 rounded-full blur-3xl" />

      <div className="relative max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/10 text-brand-600 text-xs font-semibold mb-6">
            <Icon icon="lucide:rocket" width="14" height="14" />
            Únete al equipo
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Haz parte de{' '}
            <span className="bg-gradient-to-r from-brand-500 to-orange-500 bg-clip-text text-transparent">
              PideloYa
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            Ya seas restaurante o repartidor, hay un lugar para ti en Abancay.
          </p>
        </div>

        <Tabs defaultValue="restaurante" className="max-w-4xl mx-auto">
          <div className="flex justify-center mb-8">
            <TabsList className="inline-flex h-12 p-1 bg-muted/60 backdrop-blur-sm rounded-2xl border border-border/50">
              <TabsTrigger
                value="restaurante"
                className="inline-flex items-center gap-2 rounded-xl px-7 py-2.5 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-foreground transition-all duration-200"
              >
                <Icon icon="lucide:store" width="16" height="16" className="text-brand-500" />
                Soy restaurante
              </TabsTrigger>
              <TabsTrigger
                value="repartidor"
                className="inline-flex items-center gap-2 rounded-xl px-7 py-2.5 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-foreground transition-all duration-200"
              >
                <Icon icon="lucide:zap" width="16" height="16" className="text-emerald-500" />
                Soy repartidor
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="restaurante" className="animate-in fade-in-50 slide-in-from-bottom-4 duration-400">
            <RestaurantRegisterForm />
          </TabsContent>

          <TabsContent value="repartidor" className="animate-in fade-in-50 slide-in-from-bottom-4 duration-400">
            <DeliveryRegisterForm />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}
