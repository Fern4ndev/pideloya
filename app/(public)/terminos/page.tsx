import type { Metadata } from 'next'
import { LegalDocumentLayout, LegalSection } from '@/components/features/legal/LegalDocumentLayout'

export const metadata: Metadata = {
  title: 'Términos y Condiciones | PideloYa',
  description: 'Términos y condiciones de uso de la plataforma PideloYa.',
}

const UPDATED_AT = '12 de septiembre de 2026'

export default function TerminosPage() {
  return (
    <LegalDocumentLayout title="Términos y Condiciones" updatedAt={UPDATED_AT}>
      <LegalSection title="1. Aceptación de los términos">
        <p>
          Estos Términos y Condiciones regulan el uso de PideloYa, la plataforma que
          conecta a clientes, restaurantes y repartidores en Abancay. Al registrarte o
          usar la plataforma —como cliente, restaurante o repartidor— aceptas quedar
          sujeto a estos términos. Si no estás de acuerdo, no debes usar el servicio.
        </p>
      </LegalSection>

      <LegalSection title="2. Descripción del servicio">
        <p>
          PideloYa es un marketplace que permite a los clientes explorar restaurantes
          locales, realizar pedidos y recibirlos a través de repartidores
          independientes. PideloYa actúa como intermediario tecnológico entre las tres
          partes; no elabora los alimentos ni presta el servicio de reparto de forma
          directa.
        </p>
      </LegalSection>

      <LegalSection title="3. Registro de cuenta">
        <p>
          Para usar ciertas funciones debes crear una cuenta con información veraz,
          completa y actualizada (nombre, documento de identidad, celular, correo y,
          según el rol, datos del negocio o del vehículo). Eres responsable de
          mantener la confidencialidad de tu contraseña y de toda actividad realizada
          desde tu cuenta.
        </p>
        <p>
          El registro de restaurantes y repartidores queda sujeto a revisión y
          aprobación por parte de PideloYa antes de activarse.
        </p>
      </LegalSection>

      <LegalSection title="4. Obligaciones según el rol">
        <p>
          <strong className="text-foreground">Clientes:</strong> brindar una
          dirección de entrega correcta, estar disponibles para recibir el pedido y
          pagar el monto acordado.
        </p>
        <p>
          <strong className="text-foreground">Restaurantes:</strong> mantener su
          menú, precios y horarios actualizados, preparar los pedidos con las
          condiciones sanitarias exigidas por la normativa vigente, y entregarlos
          dentro del tiempo estimado.
        </p>
        <p>
          <strong className="text-foreground">Repartidores:</strong> contar con
          mayoría de edad, un medio de transporte adecuado y la documentación
          vigente que corresponda, y realizar la entrega de forma diligente y en el
          menor tiempo razonable.
        </p>
      </LegalSection>

      <LegalSection title="5. Pedidos, precios y cancelaciones">
        <p>
          Los precios de los productos son fijados por cada restaurante y pueden
          incluir cargos de envío y de servicio, mostrados antes de confirmar el
          pedido. Un pedido puede cancelarse solo mientras se encuentre en un estado
          que lo permita; una vez que el restaurante empieza a prepararlo o el
          repartidor lo recoge, la cancelación puede no ser posible o generar un
          cargo.
        </p>
      </LegalSection>

      <LegalSection title="6. Propiedad intelectual">
        <p>
          El nombre PideloYa, su logotipo, diseño e interfaz son propiedad de
          PideloYa. El contenido que restaurantes y usuarios suban (fotos, nombres de
          productos, descripciones) sigue siendo de su titularidad, pero al subirlo
          otorgan a PideloYa una licencia para mostrarlo dentro de la plataforma.
        </p>
      </LegalSection>

      <LegalSection title="7. Limitación de responsabilidad">
        <p>
          PideloYa facilita la conexión entre las partes, pero no garantiza la
          calidad, inocuidad o exactitud de los productos ofrecidos por cada
          restaurante, ni es responsable por retrasos originados en el tráfico, el
          clima u otras causas ajenas a su control razonable.
        </p>
      </LegalSection>

      <LegalSection title="8. Modificaciones">
        <p>
          PideloYa puede actualizar estos términos en cualquier momento. Los cambios
          entran en vigencia desde su publicación en esta página, indicando la fecha
          de la última actualización.
        </p>
      </LegalSection>

      <LegalSection title="9. Ley aplicable">
        <p>
          Estos términos se rigen por las leyes de la República del Perú. Cualquier
          controversia se resolverá ante los jueces y tribunales competentes de
          Abancay, Apurímac, salvo que la ley disponga un fuero distinto de forma
          obligatoria.
        </p>
      </LegalSection>

      <LegalSection title="10. Contacto">
        <p>
          Si tienes dudas sobre estos términos, escríbenos a{' '}
          <a href="mailto:hola@pideloya.pe" className="text-brand-600 font-medium hover:underline">
            hola@pideloya.pe
          </a>
          .
        </p>
      </LegalSection>
    </LegalDocumentLayout>
  )
}
