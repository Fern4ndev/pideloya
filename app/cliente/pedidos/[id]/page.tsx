import { notFound } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { ClientPageContainer } from "@/components/layout/ClientPageContainer";
import { OrderStatusSection } from "@/components/features/orders/OrderStatusSection";
import { OrderStatusAnnouncer } from "@/components/features/orders/OrderStatusAnnouncer";
import { RealtimeRefresh } from "@/components/ui/realtime-refresh";
import { OrderSummaryCard } from "@/components/features/orders/OrderSummaryCard";
import { PaymentVoucherViewer } from "@/components/features/orders/PaymentVoucherViewer";
import {
  DeliveryPaymentCard,
  type DeliveryOffer,
} from "@/components/features/orders/DeliveryPaymentCard";
import {
  PAYMENT_VOUCHER_BUCKET,
  VOUCHER_SIGNED_URL_TTL_S,
} from "@/lib/constants/payment-voucher";
import {
  toPaymentMethod,
  toPaymentTiming,
} from "@/lib/constants/payment-method";
import type { OrderStatus } from "@/lib/constants/order-status";
import { MapPinIcon, StickyNoteIcon } from "lucide-react";

/**
 * Estados en los que existe una entrega VIVA, es decir en los que tiene sentido
 * pedir la oferta del repartidor: su teléfono mientras el cliente todavía tiene
 * que pagarle, y el comprobante una vez que pagó.
 *
 * Es una copia deliberada del filtro de `get_delivery_offer_details`. Si
 * divergiera, el síntoma sería silencioso (la tarjeta o el comprobante dejan de
 * aparecer, sin error), así que está escrito junto al porqué.
 */
const LIVE_ORDER_STATUSES: OrderStatus[] = [
  "AWAITING_PAYMENT",
  "ASSIGNED",
  "PICKED_UP",
  "ON_THE_WAY",
];

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      `id, status, total, delivery_fee, payment_method, payment_timing, notes, created_at,
       addresses(address_text, reference),
       order_items(quantity, unit_price, product_name, image_url)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) {
    notFound();
  }

  // Identidad, QR y teléfono del repartidor que está esperando el pago. Solo se
  // pide en AWAITING_PAYMENT: es el único momento en que el cliente necesita
  // verlos.
  //
  // La función RPC (SECURITY DEFINER) filtra por current_profile_id() y por
  // estado, así que un pedido ajeno —o un pedido ya cancelado o entregado—
  // devuelve cero filas: el cliente nunca puede usar esto para leer el perfil
  // de un repartidor desde otro pedido ni para contactar a uno con el que la
  // relación ya terminó.
  //
  // La consulta corre en los estados VIVOS (esperando el pago o ya en camino),
  // y de la misma fila salen dos cosas distintas:
  //
  //   - la tarjeta de pago, que solo aplica en AWAITING_PAYMENT;
  //   - la URL firmada del comprobante, que solo aplica una vez que el cliente
  //     YA pagó (payment_voucher_path no es null) y que es de SOLO LECTURA: la
  //     policy de `update` del bucket ya impide reemplazarlo después de
  //     confirmar (Fase 2).
  //
  // El QR y el teléfono del repartidor NO se leen acá: con pago al recibir el
  // cliente no necesita transferir nada por adelantado, y el QR se muestra en
  // la puerta desde el teléfono del repartidor (Fase 5 del plan "pagar al
  // recibir"). Pedirlos igual sería traer datos que nadie dibuja.
  let deliveryOffer: DeliveryOffer | null = null;
  let voucherUrl: string | null = null;

  if (LIVE_ORDER_STATUSES.includes(order.status)) {
    const { data: offers } = await supabase.rpc("get_delivery_offer_details", {
      p_order_id: id,
    });
    const offer = offers?.[0];

    if (offer) {
      // Si la entrega no tiene tarifa (dato imposible en el flujo nuevo) no se
      // muestra la tarjeta: mejor no ofrecer un botón de "confirmar pago"
      // sobre un monto en cero que inventar un S/ 0.00.
      if (order.status === "AWAITING_PAYMENT" && offer.delivery_fee != null) {
        // (D7) ¿El repartidor acepta cobrar al recibir? La función RPC acotada
        // no lo expone (agregarle un campo exigiría DROP+CREATE que rompería el
        // código desplegado), así que se lee la fila de `deliveries` con la
        // policy ya existente: el cliente de un pedido vivo puede leer SU
        // entrega. Es un snapshot de la oferta: si el repartidor cambia su
        // perfil después, la oferta enviada no cambia.
        const { data: deliveryRow } = await supabase
          .from("deliveries")
          .select("allows_pay_on_delivery")
          .eq("order_id", id)
          .maybeSingle();

        deliveryOffer = {
          fullName: offer.full_name,
          avatarUrl: offer.avatar_url,
          yapeQrUrl: offer.yape_qr_url,
          phone: offer.phone,
          deliveryFee: Number(offer.delivery_fee),
          // Default `true` = el comportamiento de siempre (el pago al recibir
          // ya existía): un dato ausente no le cierra opciones al cliente.
          allowsPayOnDelivery: deliveryRow?.allows_pay_on_delivery !== false,
        };
      }

      // Se firma con el cliente DEL USUARIO (no service role): si la RLS de
      // lectura no le corresponde, simplemente no hay URL. Una URL caducada
      // tampoco rompe nada — al recargar se genera una nueva.
      if (offer.payment_voucher_path) {
        const { data: signed } = await supabase.storage
          .from(PAYMENT_VOUCHER_BUCKET)
          .createSignedUrl(
            offer.payment_voucher_path,
            VOUCHER_SIGNED_URL_TTL_S,
          );
        voucherUrl = signed?.signedUrl ?? null;
      }
    }
  }

  // `orders.delivery_fee` es un snapshot que se escribe recién cuando el cliente
  // confirma (ver confirm_delivery_payment), así que mientras espera el pago
  // sigue en NULL. La tarifa vigente vive en la oferta: se usa como respaldo
  // para que el total muestre lo que el cliente realmente va a pagar y no un
  // "por confirmar" que contradice a la tarjeta de arriba.
  const deliveryFee =
    order.delivery_fee != null
      ? Number(order.delivery_fee)
      : (deliveryOffer?.deliveryFee ?? null);

  // Método de pago elegido (snapshot de `orders.payment_method`), estrechado a
  // PaymentMethod: la columna es `text` con un CHECK que la acota, pero
  // TypeScript no lo sabe. Solo lo llenan las filas anteriores al pago al
  // recibir sin método: con ON_DELIVERY queda NULL y el resumen decide con el
  // TIMING. Sin método quedan dos casos legítimos: el pedido todavía espera la
  // elección (AWAITING_PAYMENT) o es una entrega legacy aceptada sin oferta.
  const paymentMethod = toPaymentMethod(order.payment_method);

  // Layout: DOS columnas explícitas en desktop (lg+), UNA pila en móvil.
  //
  // Columna principal (ancha): Resumen → Pago (si falta elegir) → Estados.
  // Columna lateral (20 rem): Entrega, con dirección y notas — metadata que
  // no necesita ancho y que antes se estiraba a la medida completa para
  // dibujar una línea ("Av. Arenas 123") dejando media pantalla vacía.
  //
  // En móvil el grid colapsa a una columna y el orden visual vuelve a ser el
  // del DOM: Resumen → Pago → Estados → Entrega — el mismo orden de la pila
  // anterior, que es además el que leen los lectores de pantalla y el que
  // sigue el foco del teclado.
  //
  // La primera versión de esta página (plan del método de pago) tuvo ya un
  // grid de dos columnas y se deshizo por tres defectos, todos del mismo
  // origen: la colocación automática del grid depende de CUÁNTOS hijos
  // existan. Este layout no los reintroduce porque las columnas son
  // CONTENEDORES explícitos, no auto-flow:
  //
  //   1. la tarjeta de pago nace en la columna ancha SIEMPRE (el QR y el
  //      panel de Yape necesitan ese ancho), venga oferta o no;
  //   2. ninguna tarjeta comparte fila con otra — cada columna es su propia
  //      pila `flex-col`, así que nada estira la altura de la más corta;
  //   3. un hijo que devuelve `null` (OrderStatusSection en DELIVERED)
  //      simplemente deja su columna más corta, sin huecos.
  //
  // El contenedor vuelve a `wide` (max-w-4xl) porque ahora SÍ hay una
  // segunda columna que usa el espacio: ~552 px de principal (el QR y el
  // panel de Yape necesitan ese ancho) + 320 px de lateral.
  return (
    <ClientPageContainer size="wide">
      {/* Dos componentes que no dibujan nada, montados una sola vez para todo
          el pedido (Fase 1 del plan de realtime): uno le pide al servidor que
          vuelva a renderizar cuando hay algo nuevo, y el otro avisa al cliente
          qué cambió. Antes de esto el único que escuchaba el pedido era el
          timeline, y su estado era privado del componente: el timeline avanzaba
          solo pero la tarjeta de pago no aparecía hasta recargar a mano.

          `debounceMs={150}` y no el 1000 de admin/restaurante: aquí el cliente
          está mirando la pantalla justamente esperando este evento, así que 1 s
          se siente roto; 150 ms se siente instantáneo y aun así agrupa la
          ráfaga de updates que puede emitir un mismo cambio del pedido. */}
      <RealtimeRefresh
        channelName={`customer-order-${order.id}`}
        table="orders"
        event="UPDATE"
        filter={`id=eq.${order.id}`}
        debounceMs={150}
        syncOnSubscribe
        refreshOnFocus
      />
      <OrderStatusAnnouncer status={order.status} />
      {/* Encabezado sin tarjeta (Fase 3.2): es metadata de contexto, no
          contenido que compita con el estado del pedido. El identificador
          corto (#XXXXXXXX) le da al cliente algo estable para referenciar el
          pedido (ej. con soporte), que antes no existía en la UI. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Pedido #{order.id.slice(0, 8)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {new Date(order.created_at).toLocaleDateString("es-PE", {
            day: "numeric",
            month: "long",
          })}
          {" · "}
          {new Date(order.created_at).toLocaleTimeString("es-PE", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
      {/* Dos columnas (ver el comentario de arriba): principal y lateral.
          En móvil, una sola pila con el orden del DOM. Cada tarjeta es
          `w-full min-w-0`: el `min-w-0` impide que un nombre de producto o
          una nota larga ensanchen su columna (los hijos de flex/grid tienen
          `min-width: auto`, que es justo lo que permite ese desborde). */}
      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Principal: qué pedí, qué falta pagar y cómo va. */}
        <div className="flex min-w-0 flex-col gap-4">
          <OrderSummaryCard
            items={(order.order_items ?? []).map((item) => ({
              productName: item.product_name,
              quantity: item.quantity,
              unitPrice: Number(item.unit_price),
              imageUrl: item.image_url,
            }))}
            subtotal={Number(order.total)}
            deliveryFee={deliveryFee}
            paymentMethod={paymentMethod}
            paymentTiming={toPaymentTiming(order.payment_timing)}
            voucher={
              voucherUrl ? (
                // "Comprobante enviado" + "Ver", sin frase explicativa: el
                // comprobante solo existe con pago por adelantado, y la nota de
                // arriba ya dice "Pagaste S/ X por Yape." — la frase repetía lo
                // mismo dos veces en la misma tarjeta.
                <div className="flex items-center gap-3">
                  <PaymentVoucherViewer
                    url={voucherUrl}
                    alt="Comprobante de pago por Yape"
                    actionLabel="Ver"
                  />
                  <p className="min-w-0 text-sm font-medium">
                    Comprobante enviado
                  </p>
                </div>
              ) : undefined
            }
          />

          {/* La acción pendiente va pegada al resumen, donde está el monto que el
              cliente tiene que decidir: `total` viaja para que cada opción
              muestre lo que le pagará al repartidor (comida + envío, D1). */}
          {deliveryOffer && (
            <DeliveryPaymentCard
              orderId={order.id}
              total={Number(order.total)}
              deliveryPerson={deliveryOffer}
            />
          )}

          {/* Los estados van DEBAJO del resumen y de la acción: responden "¿cómo
              va?", que es la segunda pregunta, no la primera. No reciben datos de
              pago: la nota del monto vive SOLO en el resumen, junto al número que
              explica (Fase 5 del plan "pagar al recibir"). */}
          <OrderStatusSection orderId={order.id} status={order.status} />
        </div>

        {/* Lateral: metadata de la entrega (Fase 3.4: dirección y notas en
            UNA tarjeta — antes eran dos). En desktop vive en la columna de
            20 rem, que es todo el ancho que una dirección necesita; en
            móvil queda al final de la pila, donde siempre estuvo. */}
        {(order.addresses || order.notes) && (
          <div className="flex min-w-0 flex-col gap-4">
            <div className="w-full min-w-0 rounded-3xl border border-black/5 bg-white/50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <h2 className="text-sm font-medium text-muted-foreground">
                Entrega
              </h2>
              <div className="mt-3 space-y-3">
                {order.addresses && (
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600">
                      <MapPinIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="break-words text-sm [overflow-wrap:anywhere]">
                        {order.addresses.address_text}
                      </p>
                      {order.addresses.reference && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {order.addresses.reference}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {order.notes && (
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600">
                      <StickyNoteIcon className="h-4 w-4" />
                    </span>
                    <p className="min-w-0 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                      {order.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ClientPageContainer>
  );
}
