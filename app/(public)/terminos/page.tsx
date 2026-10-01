import type { Metadata } from 'next'
import { LegalDocumentLayout, LegalSection } from '@/components/features/legal/LegalDocumentLayout'

export const metadata: Metadata = {
  title: 'Términos y Condiciones | PideloYa',
  description: 'Términos y condiciones de uso de la plataforma PideloYa.',
}

// NOTA INTERNA (D10): estos textos cubren el flujo de pago al repartidor de
// forma funcional, pero no sustituyen una revisión legal. Antes de un
// lanzamiento comercial deben revisarse con un abogado, especialmente la
// sección 6 (pago del pedido y del envío) y el tratamiento de la relación con
// los repartidores independientes.
const UPDATED_AT = '30 de septiembre de 2026'

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
          pagar el monto acordado, que puede incluir el precio de los productos y el
          costo del envío.
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
          menor tiempo razonable. El repartidor es responsable de cobrar el monto
          que la plataforma le indica, de declarar con veracidad lo que cobró y de
          reportar de inmediato cualquier problema con el pago.
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

      <LegalSection title="6. Pago del pedido y del envío">
        <p>
          El pago de los productos y el pago del servicio de envío son dos cosas
          distintas. El precio de los productos se paga al restaurante; el monto del
          envío se paga al repartidor. La plataforma muestra, antes de confirmar el
          pedido, cuánto corresponde a cada uno.
        </p>
        <p>
          Para el pago al repartidor puedes elegir entre <strong>Yape</strong> o{' '}
          <strong>efectivo</strong>, y entre pagarlo por adelantado o pagarlo al
          recibir. Si eliges pagar al recibir con Yape, el repartidor te muestra su
          código QR al momento de la entrega; si eliges efectivo, pagas el monto
          exacto al recibirlo. Cuando la modalidad elegida lo exige, debes adjuntar
          el comprobante de tu pago para que el repartidor pueda entregarte el
          pedido.
        </p>
        <p>
          Cuando el repartidor adelanta el pago de la comida en el restaurante y tú
          elegiste pagarle al recibir, el monto que le entregas incluye ese adelanto
          además del envío, tal como se muestra en el detalle del pedido. Al recibir
          el pedido confirmas el pago de la comida al restaurante desde la
          plataforma.
        </p>
        <p>
          El repartidor puede cobrar en efectivo un monto que originalmente estaba
          anunciado para Yape, o al contrario, siempre que el monto sea el que la
          plataforma le muestra; el repartidor declara el método con el que
          efectivamente cobró y ese registro queda en el pedido. El repartidor
          también puede configurar en su perfil que no acepta pedidos con pago al
          recibir, en cuyo caso la plataforma no le ofrecerá esos pedidos.
        </p>
        <p>
          Si alguna de las partes no puede cobrar o no puede acreditar el pago,
          puede reportar una incidencia desde la plataforma. PideloYa revisa el
          caso con la información registrada del pedido (método y momento del pago,
          monto, cobro declarado y comprobantes adjuntos) y puede contactar a las
          partes para conciliar. PideloYa no es responsable del pago entre las
          partes ni actúa como entidad de pagos: la plataforma solo registra la
          información necesaria para que el cobro sea verificable y para resolver
          disputas. PideloYa no procesa ni custodia el dinero del pedido ni del
          envío en ninguna modalidad.
        </p>
        <p>
          El comprobante que adjuntes y las atestaciones que registres (por ejemplo,
          que pagaste o que recibiste el monto) tienen valor de declaración de las
          partes y sirven como evidencia del cobro dentro de la plataforma; no
          constituyen verificación bancaria ni confirmación de una entidad
          financiera. No pagar el monto acordado, declarar un cobro falso o no
          reportar un problema de pago puede suspender temporal o definitivamente la
          cuenta. Los reclamos y disputas de pago se atienden por el canal de soporte
          indicado en la sección 11, y se revisan con la información registrada del
          pedido.
        </p>
      </LegalSection>

      <LegalSection title="7. Propiedad intelectual">
        <p>
          El nombre PideloYa, su logotipo, diseño e interfaz son propiedad de
          PideloYa. El contenido que restaurantes y usuarios suban (fotos, nombres de
          productos, descripciones) sigue siendo de su titularidad, pero al subirlo
          otorgan a PideloYa una licencia para mostrarlo dentro de la plataforma.
        </p>
      </LegalSection>

      <LegalSection title="8. Limitación de responsabilidad">
        <p>
          PideloYa facilita la conexión entre las partes, pero no garantiza la
          calidad, inocuidad o exactitud de los productos ofrecidos por cada
          restaurante, ni es responsable por retrasos originados en el tráfico, el
          clima u otras causas ajenas a su control razonable.
        </p>
      </LegalSection>

      <LegalSection title="9. Modificaciones">
        <p>
          PideloYa puede actualizar estos términos en cualquier momento. Los cambios
          entran en vigencia desde su publicación en esta página, indicando la fecha
          de la última actualización.
        </p>
      </LegalSection>

      <LegalSection title="10. Ley aplicable">
        <p>
          Estos términos se rigen por las leyes de la República del Perú. Cualquier
          controversia se resolverá ante los jueces y tribunales competentes de
          Abancay, Apurímac, salvo que la ley disponga un fuero distinto de forma
          obligatoria.
        </p>
      </LegalSection>

      <LegalSection title="11. Contacto">
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
