import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { JoinSection } from '@/components/features/registration/JoinSection'

export default function HomePage() {
  return (
    <main>
      <section className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Pide en tus negocios favoritos de Abancay
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          PideloYa conecta a los negocios de Abancay con repartidores locales
          y clientes que quieren pedir sin salir de casa.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button render={<Link href="/login" />} nativeButton={false}>
            Pedir ahora
          </Button>
          <Button
            variant="outline"
            render={<Link href="#unete" />}
            nativeButton={false}
          >
            Únete como negocio o repartidor
          </Button>
        </div>
      </section>

      <div className="border-t">
        <JoinSection />
      </div>
    </main>
  )
}