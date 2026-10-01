import type { Metadata } from 'next'
import { LegalDocumentLayout, LegalSection } from '@/components/features/legal/LegalDocumentLayout'

export const metadata: Metadata = {
  title: 'Política de Privacidad | PideloYa',
  description: 'Cómo PideloYa recopila, usa y protege tus datos personales.',
}

// NOTA INTERNA (D10): política actualizada para reflejar el flujo de pago al
// repartidor y la conciliación. No sustituye una revisión legal antes de un
// lanzamiento comercial.
const UPDATED_AT = '30 de septiembre de 2026'

export default function PrivacidadPage() {
  return (
    <LegalDocumentLayout title="Política de Privacidad" updatedAt={UPDATED_AT}>
      <LegalSection title="1. Responsable del tratamiento">
        <p>
          PideloYa es responsable del tratamiento de los datos personales que
          recopila a través de su plataforma web y aplicaciones, conforme a la Ley
          N.º 29733, Ley de Protección de Datos Personales, y su reglamento.
        </p>
      </LegalSection>

      <LegalSection title="2. Datos que recopilamos">
        <p>Según tu rol, podemos recopilar:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Datos de identificación: nombre completo, tipo y número de documento.</li>
          <li>Datos de contacto: celular, WhatsApp y correo electrónico.</li>
          <li>Datos de ubicación: dirección de entrega o del negocio, y ubicación en tiempo real durante una entrega activa (repartidores).</li>
          <li>Datos del negocio: nombre comercial, tipo de comida y menú (restaurantes).</li>
          <li>Datos del vehículo: tipo de vehículo usado para repartir (repartidores).</li>
          <li>Imágenes: foto de perfil y código QR de Yape para pagos directos — opcional, solo repartidores.</li>
          <li>Comprobantes de pago: la imagen del comprobante de Yape que adjuntas al confirmar el pago del envío (clientes).</li>
          <li>Historial de pedidos y preferencias dentro de la plataforma.</li>
          <li>
            Datos del pago al repartidor: método elegido (Yape o efectivo),
            momento del pago (ahora o al recibir), el cobro que el repartidor
            declara haber recibido, la constancia de que pagaste la comida al
            restaurante cuando el repartidor la adelantó, y las incidencias de
            pago que cualquiera de las partes reporte.
          </li>
          <li>Credenciales de acceso, almacenadas de forma cifrada.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Finalidad del tratamiento">
        <p>Usamos tus datos para:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Crear y administrar tu cuenta, y validar tu identidad al registrarte.</li>
          <li>Procesar pedidos y coordinar la entrega entre cliente, restaurante y repartidor.</li>
          <li>Confirmar el pago al repartidor: el comprobante que adjuntas se comparte únicamente con el repartidor asignado a tu pedido, como constancia de que le pagaste.</li>
          <li>
            Llevar la conciliación del pago entre cliente, repartidor y
            restaurante, y resolver disputas o incidencias de pago entre las
            partes.
          </li>
          <li>
            Mostrar al restaurante si el repartidor pagó o quedó debiendo el precio
            de los productos, para que pueda cobrar el pedido.
          </li>
          <li>Comunicarnos contigo por WhatsApp, correo o notificaciones sobre tus pedidos o tu registro.</li>
          <li>Prevenir fraude y mantener la seguridad de la plataforma.</li>
          <li>Cumplir obligaciones legales y responder a autoridades competentes.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Base legal">
        <p>
          Tratamos tus datos con base en tu consentimiento, otorgado al marcar la
          casilla de autorización durante el registro, y en la necesidad de
          ejecutar el servicio que solicitas (procesar y entregar tu pedido, o
          activar tu cuenta de restaurante o repartidor).
        </p>
      </LegalSection>

      <LegalSection title="5. Encargados de tratamiento y terceros">
        <p>
          Para operar la plataforma usamos proveedores de infraestructura que
          procesan datos por encargo nuestro, entre ellos: Supabase (base de datos y
          autenticación) e ImageKit (almacenamiento y entrega de imágenes). Estos
          proveedores solo acceden a los datos necesarios para prestar su servicio y
          están sujetos a obligaciones de confidencialidad.
        </p>
        <p>No vendemos tus datos personales a terceros.</p>
      </LegalSection>

      <LegalSection title="6. Conservación de datos">
        <p>
          Conservamos tus datos mientras mantengas una cuenta activa en PideloYa.
        </p>
        <p>
          Si solicitas la eliminación de tu cuenta y tienes historial de pedidos,
          tus datos de identificación (nombre, contacto, documento, direcciones,
          foto de perfil, código QR de Yape y los comprobantes de pago que hayas
          adjuntado) se anonimizan y tu cuenta pierde el acceso de forma
          permanente. Las imágenes se eliminan además de nuestro
          proveedor de almacenamiento, de modo que dejan de estar accesibles. El
          registro de la transacción (pedidos, montos y fechas, sin datos que te
          identifiquen directamente) se conserva por 5 años, plazo exigido por
          obligaciones contables y tributarias (SUNAT, Código Tributario). Los
          datos del pago al repartidor —método, momento del pago, cobro declarado,
          constancia de pago al restaurante e incidencias reportadas— forman parte
          de ese registro de la transacción: no identifican directamente a una
          persona, se usan para conciliar y resolver disputas, y se conservan
          también por 5 años.
        </p>
        <p>
          Si tu cuenta no registra pedidos, se elimina por completo junto con sus
          datos. Los pedidos ya realizados conservan el nombre y teléfono que
          tenías al momento de cada pedido, como parte del comprobante de la
          transacción.
        </p>
      </LegalSection>

      <LegalSection title="7. Tus derechos (ARCO)">
        <p>
          Como titular de datos personales, tienes derecho a acceder, rectificar,
          cancelar y oponerte al tratamiento de tus datos (derechos ARCO), así como
          a revocar tu consentimiento en cualquier momento.
        </p>
        <p>
          Puedes ejercer estos derechos escribiendo a{' '}
          <a href="mailto:privacidad@pideloya.pe" className="text-brand-600 font-medium hover:underline">
            privacidad@pideloya.pe
          </a>
          . Si consideras que tu solicitud no fue atendida correctamente, puedes
          acudir a la Autoridad Nacional de Protección de Datos Personales del
          Ministerio de Justicia y Derechos Humanos.
        </p>
      </LegalSection>

      <LegalSection title="8. Seguridad de la información">
        <p>
          Aplicamos medidas técnicas y organizativas razonables (cifrado de
          contraseñas, control de acceso mediante políticas de seguridad a nivel de
          base de datos) para proteger tus datos frente a accesos no autorizados,
          pérdida o alteración.
        </p>
      </LegalSection>

      <LegalSection title="9. Menores de edad">
        <p>
          El registro como repartidor requiere ser mayor de edad. Si eres cliente
          menor de edad, el uso de la plataforma debe realizarse bajo la
          supervisión de un padre, madre o tutor.
        </p>
      </LegalSection>

      <LegalSection title="10. Cambios a esta política">
        <p>
          Podemos actualizar esta política para reflejar cambios en nuestras
          prácticas o en la normativa vigente. Publicaremos cualquier cambio en
          esta misma página junto con la fecha de actualización.
        </p>
      </LegalSection>

      <LegalSection title="11. Contacto">
        <p>
          Para consultas sobre el tratamiento de tus datos personales, escríbenos a{' '}
          <a href="mailto:privacidad@pideloya.pe" className="text-brand-600 font-medium hover:underline">
            privacidad@pideloya.pe
          </a>
          .
        </p>
      </LegalSection>
    </LegalDocumentLayout>
  )
}
