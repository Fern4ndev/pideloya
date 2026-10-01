# Decisions and Learnings — PideloYa

Memoria viva del proyecto: una entrada por decisión concreta, con el "por qué" y no solo el "qué". Si una decisión cambia, se agrega una nueva entrada (no se borra la anterior) para conservar el razonamiento histórico.

## 2026-09-25/26 — Manejo de eliminación de cuentas (Fases 1–5 del plan)

Fuente: `plan-manejo-eliminacion-cuentas.md`. Orden de ejecución real: **2 → 1 → 3 → 4 → 5** (la Fase 2 iba primero por ser el único bug con impacto en usuarios reales: pedidos colgados).

### Fase 2 — Pedidos nunca quedan colgados (implementada primero)

- **Desactivar un repartidor con entrega en curso se BLOQUEA** (`deactivateUser` en `lib/actions/admin.ts`, helper `lib/admin/delivery-lifecycle.ts`): el pedido quedaría en tracking eterno para el cliente e inasignable para otros (con `delivery_person_id = null` no vuelve al pool). El error se lanza como `Error` (no `{ success: false }`) porque `ConfirmDialog` ya muestra `err.message` como toast de error; un `success: false` se mostraría como toast verde de éxito.
- **Eliminar un repartidor libera sus pedidos activos ANTES del `auth.admin.deleteUser()`** (`releaseActiveDeliveries`): el borrado de auth aplica `ON DELETE SET NULL` en `deliveries.delivery_person_id` (migración 20260923100000) y sin liberación el pedido quedaría huérfano sin persona para siempre. Devolverlo a `PENDING` lo hace visible de nuevo en `/repartidor/disponibles` (el realtime de `orders` ya invalida esa lista). Cubre también colgados legacy de desactivaciones anteriores.
- **Orden crítico en `releaseActiveDeliveries`:** primero se borra la fila de `deliveries` y después se devuelve el pedido a `PENDING`. Al revés, otro repartidor podría aceptar entre ambas operaciones y chocar con el `UNIQUE(order_id)` de `deliveries`.
- **Eliminar/desactivar un restaurante cancela sus pedidos `PENDING`** (`removeRestaurant`, branch soft-delete): un `PENDING` nunca tiene fila en `deliveries`, así que no hay nada más que limpiar. Los `ASSIGNED/PICKED_UP/ON_THE_WAY` **no** se auto-cancelan (entregas ya en camino): caso conocido para revisión manual del admin.
- `deactivateUser`/`deleteUser` traen el perfil (rol) ANTES de actuar: los guardas solo aplican a `DELIVERY`; clientes/restaurantes quedan intactos.

### Fase 1 — Snapshot del cliente en `orders`

- **`orders.customer_name` / `orders.customer_phone`** (migración 20260926000000 + backfill desde `profiles`): `order_items` ya congelaba `product_name/restaurant_name/image_url/unit_price`, pero `orders` no congelaba nada del cliente; al purgar un perfil (`customer_id` → SET NULL, 20260923130100) el historial perdía para siempre quién hizo el pedido. Ambos writes (`createOrder` en `lib/actions/orders.ts` y `POST /api/v1/orders`) llenan el snapshot al crear.
- **El snapshot NO se anonimiza** al eliminar la cuenta: es dato histórico "al momento del pedido" (igual que `product_name`), no dato vivo del perfil. La anonimización de PII viva vive en `profiles`/`addresses`.
- Pedidos cuyo cliente ya fue borrado antes del backfill quedan sin snapshot (no existe fuente); las lecturas usan el join a `profiles` como fallback (ver `RecentOrdersTable`).
- `types/database.ts` se editó a mano (agregar columnas a Row/Insert/Update): regenerarlo con `supabase gen types` es válido pero requiere la migración aplicada a la base de referencia.

### Fase 3 — Política unificada de hard-delete vs. soft-delete

- **Regla única para todos los roles:** con historial transaccional (`hasTransactionalHistory`: ≥1 pedido para CUSTOMER, ≥1 fila en `deliveries` para DELIVERY) la cuenta **NUNCA se purga de `auth.users`**; se anonimiza + desactiva + se revoca el login. Sin historial: hard-delete completo (comportamiento legacy, sin regresión).
- **Anonimización** (`lib/admin/anonymize-profile.ts`): limpia `full_name/phone/email/document_*` en `profiles` y `address_text/reference` en `addresses`. Las filas de direcciones NO se borran: `orders.address_id` sigue apuntando a una fila válida (y lat/lng se conservan: no identifican por sí solas).
- **Revocación de login sin borrar auth.users:** `ban_duration: '876000h'` (ban permanente de GoTrue, ~100 años). Elección documentada porque el comportamiento exacto de `ban_duration` puede variar entre versiones del SDK; si un día hay que "revivir" una cuenta, se levanta el ban con `ban_duration: 'none'` y la fila conserva su identidad.
- **Flags calculados server-side en batch (cero N+1):** `hasOrders`/`hasDeliveries` se resuelven con un solo query `IN (ids de la página)` desde las páginas de admin, no con una llamada por fila. Se consulta con service role porque el cruce RLS (un admin no ve pedidos de otros clientes vía policies de orders) daría falsos negativos.
- **La UI anuncia la acción real antes de confirmar:** `UserRowActions` muestra "Eliminar" (sin historial) o "Desactivar y anonimizar" (con historial) según el flag del server component. Evita la expectativa incorrecta de que una cuenta con pedidos se borra de verdad.
- Nota: el chequeo cubre `CUSTOMER`/`DELIVERY`. Un hipotético perfil `RESTAURANT`/`ADMIN` con historial pasado a `deleteUser` hoy caería al branch de hard-delete; si alguna vez se elimina un restaurante vía perfil (hoy no existe esa ruta), revisar este punto.

### Fase 4 — Sin huérfanos de ImageKit

- **El hard-delete de un restaurante borra su logo y las imágenes de sus productos de ImageKit** (`removeRestaurant`): el `ON DELETE CASCADE` purga filas de BD pero nunca toca ImageKit — sin esto, cada restaurante eliminado dejaba archivos huérfanos para siempre (costo de almacenamiento).
- **Orden deliberado: recolectar fileIds → borrar imágenes → borrar filas.** Si el borrado de BD falla después, a lo sumo queda un restaurante sin imágenes (recuperable); al revés, quedarían filas borradas con fileIds perdidos e imágenes huérfanas irrecuperables.
- **Soft-delete NO toca imágenes:** el restaurante desactivado conserva logo/productos por si se reactiva.
- `deleteProduct()` ya borraba su imagen correctamente (auditado, sin cambios). No existe foto de perfil de repartidor en el esquema actual — cuando se agregue, recordar borrarla aquí.

### Fase 5 — Privacidad alineada con el código

- **La sección 6 de la Política de Privacidad** (`app/(public)/privacidad/page.tsx`) ahora describe el comportamiento real: con historial → anonimización + pérdida de acceso permanente + conservación de la transacción **por 5 años** (plazo contable/tributario SUNAT); sin pedidos → borrado completo; los pedidos conservan nombre/teléfono "al momento del pedido" como comprobante.
- **El plazo de 5 años es provisional hasta confirmación del contador** del proyecto (prescripción tributaria general y conservación de libros/registros). Si el contador fija otro plazo, es un cambio de una palabra en la página.

### Lecciones transversales

- Server actions que fallan deben **lanzar `Error`** (no devolver `success: false`): el patrón de UI existente solo muestra toasts de error con excepciones.
- Antes de escribir guardas de negocio, revisar si ya existe una query equivalente validada (la de entregas activas del route `accept` se reutilizó tal cual en `delivery-lifecycle.ts`).
- Toda guarda de este plan vive en helpers de `lib/admin/*` compartidos entre server actions y rutas API: una sola implementación, dos puntos de entrada.

## 2026-09-27 — Perfil de repartidor: foto, QR de Yape y seguridad

Fuente: `docs/plans/plan-perfil-repartidor-foto-yape-password.md`.

### Fase 1 — Modelo de datos (migración 20260928000000_profiles_delivery_media.sql)

- **`avatar_url`/`avatar_file_id`/`yape_qr_url`/`yape_qr_file_id` viven en `profiles`, NO en `deliveries`.** En el esquema hay dos conceptos con nombre parecido: `deliveries` registra el ciclo de vida de **un pedido** (`accepted_at`, `picked_up_at`, `delivered_at`) y `profiles` (rol `DELIVERY`) es la **identidad de la persona** (`full_name`, `phone`, `document_*`, `vehicle_type`). La foto y el QR son datos de la persona: ponerlos en `deliveries` los duplicaría en cada pedido y los perdería al archivar el pedido.
- **Junto a la URL se guarda el `fileId` interno de ImageKit** — mismo patrón que `restaurants.logo_file_id`/`products.image_file_id` (migración 20260912132932). Sin el `fileId` no hay forma de borrar el archivo anterior al reemplazarlo ni de limpiarlo al anonimizar la cuenta: cada cambio de foto dejaría un archivo huérfano pagado para siempre en ImageKit.
- **Cero migraciones de RLS y cero Storage.** `20260830062645_profile_column_security.sql` usa **lista negra** (`revoke update (role, is_active) ... from authenticated`), no lista blanca: las columnas nuevas quedan editables por el dueño bajo la policy `profiles_update_own` ya existente, igual que `full_name`/`phone`/`vehicle_type` hoy. Y el proyecto usa ImageKit (no Supabase Storage) para imágenes de usuario: la migración `20260912135915_restaurant_logos_storage.sql` que crea un bucket es un **vestigio** de la implementación anterior, no el patrón vigente. No se creó ningún bucket nuevo.
- **Columnas genéricas; la regla "yape_qr solo para DELIVERY" va en la capa de aplicación**, no como constraint — mismo criterio que `document_type`/`vehicle_type`, que también son columnas genéricas usadas hoy por un solo rol. La validación de rol se hará en la server action (un `CUSTOMER` no debe poder guardar un QR llamando la action directamente), porque RLS no distingue por columna.
- **Sin backfill:** `NULL` es exactamente el estado correcto para "todavía no subió nada"; no hay dato previo que migrar. `types/database.ts` se editó a mano en el mismo cambio que la migración (mismo criterio que la Fase 1 del plan de eliminación de cuentas).
- **Pendiente (Fase 6 de este plan):** esta migración cierra el pendiente anotado en la Fase 4 del plan anterior ("no existe foto de perfil de repartidor — cuando se agregue, recordar borrarla"). Ahora que las columnas existen, `lib/admin/anonymize-profile.ts` **debe** leer `avatar_file_id`/`yape_qr_file_id` antes de anonimizar y borrarlos de ImageKit, o una cuenta "eliminada" seguiría con foto y QR de Yape públicamente accesibles.

### Fase 2 — Un solo sistema de subida (extender, no duplicar)

- **Se extendió `ImageUploader` con una prop `shape` (`'square' | 'circle'`) en vez de crear un `AvatarImageUploader` paralelo.** Duplicar el componente habría significado mantener ~150 líneas de drag&drop, progreso, validación de tipo/tamaño y vista previa optimista en dos lugares. `LogoUploader` y `ProductForm` no pasan la prop: siguen viendo `square` (default) y no cambiaron.
- **Corrección a una premisa del plan (bug real encontrado al implementar):** el plan asumía que el botón "Quitar" (`right-1.5 top-1.5`) "funciona igual sobre un círculo". **No funciona.** Con `size="lg"` (160px), el centro del botón queda a ~88px del centro cuando el radio es 80px: el botón cae *fuera* de la circunferencia, y el `overflow-hidden` del recuadro lo recorta hasta dejar visible apenas una astilla. Por eso, en `shape="circle"` el botón se ancla `bottom-1.5 left-1/2 -translate-x-1/2` (ahí sí entra completo en los tres tamaños). **Lección transversal: `rounded-full` + `overflow-hidden` invalida cualquier elemento posicionado en las esquinas.**
- **El botón "Quitar" dependía solo de `:hover`** (`opacity-0` + `group-hover`), que es un anti-patrón explícito de `ui-ux-pro-max` ("Reliance on hover only") y en la práctica significaba **no poder borrar la foto desde el celular** — justo el dispositivo de los repartidores. En `shape="circle"` se invierte: visible por defecto y oculto solo bajo `pointer-fine:` (puntero fino = hay mouse). Verificado en el CSS compilado que Tailwind emite `@media (pointer:fine){ … @media (hover:hover){ … } }`. Logo y QR conservan el hover de siempre para no alterar UI ya validada.
- **`focus-visible:opacity-100` se agregó a la base (aplica también a logo/QR):** el botón ahora aparece al enfocarlo con teclado. Es un cambio real en esas dos UI, pero solo durante navegación por teclado (sin efecto visual en uso normal con mouse), a cambio de hacerlo alcanzable sin puntero.
- Limitación residual aceptada: un dispositivo con puntero fino pero sin capacidad de hover (ej. lápiz/stylus) no ve el botón "Quitar" en el avatar; sí ve el overlay "Cambiar" al enfocar y puede reemplazar la foto. Es un caso muy acotado y no justificaba más complejidad.

### Fase 3 — Server Actions de avatar y QR de Yape

- **Se valida la forma de `{ url, fileId }` con zod antes de escribirlo** (`uploadedImageSchema`: la URL debe empezar con `https://`, el `fileId` no puede ser vacío). `saveRestaurantLogo` — el patrón que este plan manda replicar — no valida nada, pero una Server Action es un endpoint HTTP público: sin esto, cualquiera podría guardar un string arbitrario que después se renderiza como `<img src>`. Se exige `https` porque es lo único que devuelve ImageKit.
- **`getCurrentAuthUser()` centraliza cliente + sesión** para las cuatro acciones nuevas: el `authId` sale **siempre** de la sesión de cookies, nunca de un argumento del cliente. Se usa el cliente normal (respeta RLS), no `service_role` — editar la fila propia es exactamente el caso que cubre `profiles_update_own`.
- **`saveYapeQr` valida el rol en el servidor** (`role !== 'DELIVERY'` → error). RLS no distingue por columna, así que "el botón no se le muestra a un CUSTOMER" no impide invocar la action desde DevTools. `saveAvatar` **no** valida rol a propósito: las columnas `avatar_*` son genéricas de `profiles` (podrían usarlas cliente/restaurante a futuro).
- **Orden guardar → borrar (nunca al revés):** se lee el `fileId` anterior, se guarda el nuevo, y **después** `deleteImageKitFileSafe(anterior)`. Si el borrado en ImageKit falla, el usuario conserva su foto nueva (falla hacia adelante) en vez de quedarse sin nada; mismo orden y misma razón que `saveRestaurantLogo`. Sin este borrado, cada reemplazo dejaría un archivo huérfano pagado para siempre.
- **Se descartó usar `after()` de `next/server`** para no bloquear la respuesta con el borrado en ImageKit (regla `server-after-nonblocking` de `vercel-react-best-practices`). Sería más rápido, pero el checklist de QA exige verificar que el archivo anterior desaparece de ImageKit: si `after()` no se ejecutara en este runtime, el archivo quedaría huérfano en silencio. Se priorizó el comportamiento consistente con el código ya validado.
- **`revalidatePath` solo de `/repartidor/perfil`** (única página que hoy las renderiza). Cuando la Fase 6.3 muestre miniaturas en el panel de admin, o la consideración futura muestre el avatar al cliente en el seguimiento, esas rutas deben agregarse aquí.
- `updateProfile` y `changePassword` quedaron **sin tocar**: son flujos compartidos por cliente/restaurante/admin y no formaban parte del pedido.

### Fase 4 — Componentes de UI (avatar, QR y contraseña)

- **`PasswordChangeForm` salió de `ProfileForm` al archivo `components/features/profile/PasswordChangeForm.tsx`**, pero **el separador visual (`border-t pt-6`) se quedó en `ProfileForm`**, envolviendo al componente. Motivo: en cliente/restaurante/admin separa dos bloques del mismo formulario, mientras que en la página del repartidor va en su propia tarjeta (con título), donde un borde superior sobraría. Si el separador hubiera viajado dentro del componente, las tres páginas existentes habrían perdido el divisor.
- **El espaciado interno del formulario de contraseña se mantuvo idéntico** (`space-y-3` / `space-y-1`) en vez del `space-y-4` / `space-y-1.5` que sugería el plan: el criterio de aceptación de esta fase era "regresión cero" para las tres páginas que ya lo usaban, y ahí una diferencia de 2-4px no aportaba nada. El ojo de mostrar/ocultar sí se agregó para todos los roles (esa es la mejora pedida).
- **`PasswordInput`** (`components/ui/password-input.tsx`) es genérico y **no** saca el botón del orden de tabulación (el `PasswordField` del registro sí lo hace con `tabIndex={-1}`): alternar la visibilidad es funcionalidad, y toda funcionalidad debe ser alcanzable por teclado. El foco se ve porque `app/globals.css` ya define un `:focus-visible` global con outline lima. Deja además `autoComplete="new-password"` para los gestores de contraseñas.
- **`useId()` para los ids de los campos**, no ids fijos como antes: si el componente se montara dos veces en una página, dos `<input>` con el mismo id harían que la `<Label>` apunte al campo equivocado. Mismo criterio que ya usaba `ImageUploader`.
- **El QR usa `fit="contain"`, no `object-cover`.** Encontrado al implementar: `cover` recorta una foto rectangular a cuadrado, y un QR recortado (aunque sea en las esquinas o en la zona de silencio) deja de escanear. El avatar mantiene `cover`, que es lo correcto para un círculo. Es la segunda prop agregada al uploader compartido, y también es puramente aditiva (default = comportamiento actual).
- **Feedback de las mutaciones: toasts (convención del proyecto), más un remonte defensivo.** Las acciones lanzan `Error` y el proyecto comunica eso con toasts (`useToast`), no con mensajes inline. Pero un uploader con preview optimista tiene un problema extra: si ImageKit acepta el archivo y **el guardado en la base falla**, el preview muestra una foto que no está guardada. Por eso ambos wrappers incrementan una `key` en el `catch`, remontando el uploader con la URL real del servidor: la UI nunca miente sobre lo que hay en la base. Es especialmente visible hoy, con la migración aún sin aplicar (el guardado falla con "column does not exist").
- Los wrappers llaman a las Server Actions **dentro de `startTransition` y con `try/catch`**: un rechazo sin capturar dentro de una transición termina en el error boundary más cercano, es decir, rompería la página por un error de subida.

### Fase 5 — `/repartidor/perfil` en cuatro tarjetas

- **Tarjetas separadas para foto, datos personales, cobro por Yape y seguridad**, cada una con su título e ícono (mismo patrón `flex items-center gap-2 text-base` que ya usaban las tablas del panel). La página ya **no** pasa `showPasswordChange` a `ProfileForm`: la contraseña dejó de estar escondida al final del formulario de datos personales.
- **`PageContainer size="sm"` se mantiene** (`max-w-md`): el ancho angosto sigue siendo el correcto para un formulario de perfil, y garantiza que las cuatro tarjetas quepan sin scroll horizontal en 375px.
- **Nota de despliegue (importante):** esta página hace `select` de `avatar_url` y `yape_qr_url`, así que **la migración `20260928000000_profiles_delivery_media.sql` debe estar aplicada antes de desplegar** — sin ella, `/repartidor/perfil` falla con "column does not exist". Mismo orden que ya establecía el plan: migración primero, código después.
- Los cuatro fetches de la página no se pueden paralelizar: la consulta del perfil depende del `user.id` que devuelve `auth.getUser()`. Es la misma cadena secuencial que usan todas las páginas del panel.

### Fase 6 — Ciclo de vida de las imágenes de PII

- **Nullar la columna NO borra la imagen.** La URL de ImageKit es pública: si `anonymize-profile.ts` solo pusiera `avatar_url = null`, la foto de rostro del usuario seguiría accesible para siempre por su enlace directo y el archivo seguiría ocupando espacio. Por eso el helper ahora lee `avatar_file_id`/`yape_qr_file_id` **antes** del update (después ya no existen en la fila) y borra ambos archivos con `deleteImageKitFileSafe`.
- **Orden deliberado: leer fileIds → anonimizar el perfil → borrar de ImageKit → anonimizar direcciones.** Las imágenes se borran apenas la fila deja de referenciarlas y **antes** del paso de direcciones: si ese último paso falla, al menos la cara ya no es alcanzable. Como `deleteImageKitFileSafe` nunca lanza, un fallo de ImageKit no puede dejar la anonimización a medias (queda un archivo huérfano, que es el modo de fallo aceptable).
- **Se corrigió un comentario obsoleto y peligroso:** el docblock afirmaba "El rol DELIVERY no llega aquí hoy (deleteUser solo se invoca desde la tabla de clientes)". Es falso desde el plan anterior: `deleteUser()` deriva CUSTOMER **y** DELIVERY, y un repartidor con al menos una entrega pasa exactamente por aquí. Importaba porque el avatar y el QR de Yape son campos que **solo** llena un repartidor — el comentario desactualizado habría hecho que nadie notara la fuga.
- **Política de Privacidad actualizada en dos puntos:** nueva viñeta de "Imágenes" en la sección 2 (datos que se recopilan) y la sección 6 ahora dice explícitamente que las imágenes se eliminan "además de nuestro proveedor de almacenamiento, de modo que dejan de estar accesibles". Se subió `UPDATED_AT` al 27 de septiembre porque la sección 10 se compromete a publicar cada cambio con su fecha — y agregar una categoría nueva de dato (imágenes) es un cambio material, no una corrección de redacción.
- **6.3 — Avatar visible para el admin, QR no.** La tabla de repartidores muestra la miniatura junto al nombre y el diálogo de edición la muestra en grande (solo lectura) para poder contrastar la cara con el documento al aprobar. **El QR de Yape se excluye a propósito:** es una credencial de cobro, no un dato de identificación, y el admin no lo necesita para validar quién reparte (mínimo privilegio). Tampoco se agregó al CSV de exportación.
- **Componente `DeliveryAvatar` compartido** entre la tabla y el diálogo, apoyado en el `Avatar` de Base UI. Se verificó en el código de la librería instalada que el fallback se renderiza cuando `imageLoadingStatus !== 'loaded'` y que el hook de carga marca `'error'`: una URL rota degrada a la inicial, nunca a un ícono de imagen rota.
- **La migración `20260928000000` ahora bloquea más que la página del repartidor.** Con este cambio, `anonymize-profile.ts` hace `select` y `update` de las columnas nuevas: si el código se despliega **antes** de aplicar la migración, la eliminación/anonimización de cuentas con historial desde `/admin/usuarios` falla con "column does not exist". El orden de la Fase 9 (migración → código) deja de ser una recomendación y pasa a ser obligatorio para no romper un flujo de cumplimiento.

### Fase 7 — `vehicleType` editable por el repartidor

- **Bug real, no cosmético:** `ProfileFormData` declaraba `vehicleType`, la página ya lo traía, `updateProfile()` ya lo persistía — pero **no había ningún control que lo mostrara**, así que un repartidor solo podía cambiarlo pidiéndoselo a un admin. Se agregó un `Select` en el branch `showDeliveryFields`.
- **El select tolera valores fuera de la lista.** El diálogo de admin edita el vehículo como **texto libre**, así que un perfil puede tener `"moto"`, `"Cuatrimoto"`, etc. Si el valor guardado no está en el vocabulario, se agrega como opción extra: el campo muestra el valor real del perfil en lugar de aparecer vacío, que es lo que invitaría a sobrescribirlo sin querer. Sin esto, abrir el perfil y guardar habría borrado el vehículo de un repartidor con un valor no estándar.
- **No se endureció `profileUpdateSchema` a un enum:** un perfil con un valor legacy fallaría al guardar **cualquier** cambio (aunque fuera el teléfono). El esquema sigue permisivo y el vocabulario se aplica en la UI — igual que en la base, donde `vehicle_type` es `text` sin CHECK.
- **No se convirtió el campo de admin (`EditDeliveryDialog`) al mismo select**: el plan acota la fase 7 a `ProfileForm.tsx`, y dejar al admin la posibilidad de escribir un vehículo poco común es defendible. Queda como divergencia conocida: el vocabulario es cerrado para el repartidor y abierto para el admin. Si se quiere cerrar en todas partes, el select debe compartir la misma lista.
- `lib/actions/profile.ts::updateProfile()` y `lib/validations/profile.ts` **no necesitaron cambios** (ya aceptaban y persistían `vehicleType`): era puramente una pieza de UI que faltaba.

### Fases 8 y 9 — QA y despliegue

- **`docs/qa/qa-checklist-perfil-repartidor.md`** reúne los casos manuales (fases 1 a 7) y, al final, el orden de despliegue de la fase 9. Sigue el formato de `docs/qa/qa-checklist-eliminacion-cuentas.md`. Los casos incluyen las comprobaciones que este plan no podía dar por hechas: que el archivo **anterior** desaparece de ImageKit al reemplazarlo, que el QR rectangular **no** queda recortado, que el botón "Quitar" del avatar es visible **sin hover** en móvil, que el preview vuelve a la foto previa si el guardado falla, y la regresión de las otras tres páginas de perfil.
- **El orden de despliegue no admite separar las fases 5 y 6.** Si la subida de fotos se desplegara sin la limpieza en `anonymize-profile.ts`, toda cuenta anonimizada en ese intervalo quedaría con su foto y su QR de pago accesibles por su URL de ImageKit, y **sin forma de limpiarlas después**: el `fileId` se habría puesto en `NULL` sin haber borrado el archivo. Es el único punto del plan con daño irreversible, y por eso quedó escrito tanto en el runbook como aquí.
- **Rollback:** revertir el código es seguro (las columnas se quedan, nullable y sin uso); **no** hacer `drop column` si ya hay fotos subidas, porque se perderían las referencias a los archivos de ImageKit.

### Hallazgo abierto (fuera del alcance de este plan): los revokes por columna podrían no estar haciendo nada

- Mientras escribía el checklist apareció una duda sobre la premisa de `20260830062645_profile_column_security.sql` (`revoke update (role, is_active) on public.profiles from authenticated`) y de `20260923130000_profiles_email.sql` (`revoke update (email) ...`).
- **La documentación de Supabase lo dice explícitamente:** si el rol tiene el privilegio **a nivel de tabla**, revocar el privilegio **a nivel de columna** no lo elimina ("the table-level privilege will still be in effect"), y el privilegio por defecto es a nivel de tabla.
- **Impacto potencial si aplica:** la RLS `profiles_update_own` sí permite a cualquier usuario autenticado editar su propia fila, así que sin el revoke efectivo un usuario podría ponerse `role = 'ADMIN'` (o reactivarse con `is_active = true`) con un solo PATCH. La protección real dependería solo de que la UI no ofrezca el campo.
- **No está verificado.** Comprobarlo requiere una sesión real contra la base y no se hizo. El caso **F1.2** del checklist es exactamente esa comprobación (PATCH a `/rest/v1/profiles` con el token del propio usuario), con el SQL de remediación al final del documento. Conviene resolverlo antes de considerar cerrado el trabajo de seguridad de los planes anteriores.

## 2026-09-27 — Fase 10 del plan del panel admin: badge de pendientes en el sidebar

Fuente: `docs/plans/plan-mejora-panel-admin.md` (tarea 3, la única que faltaba: las tareas 1 y 2 ya estaban implementadas y se verificaron en el código antes de tocar nada).

- **Los conteos salen del LAYOUT (`app/admin/layout.tsx`), no del sidebar.** Es el padre común de todas las páginas del panel: el badge existe en cualquier pantalla y se recalcula cuando el layout se re-ejecuta (carga completa o `router.refresh()`). Sigue el patrón de keep-alive del App Router: los layouts compartidos no se vuelven a ejecutar al navegar entre rutas hermanas, así que el costo son dos `count` por carga, no por clic.
- **`fetchPendingApprovalCounts` reutiliza los MISMOS appliers que las listas** (`status: 'pending'`) en vez de repetir el `eq(...)` a mano: el badge no puede divergir del filtro "Pendientes de aprobar" al que enlaza. Dos `count` con `head: true` (Postgres cuenta, no viajan filas) en paralelo. Es la misma invariante que el docblock de `query-builders.ts` ya declaraba para la página y el CSV, ahora extendida al badge.
- **Best-effort a propósito:** si el conteo falla, se registra en consola y el panel se muestra sin badges. Un adorno no puede tumbar todas las páginas de admin — mismo criterio que `deleteImageKitFileSafe`.
- **Los canales realtime se movieron de las dos páginas al layout.** Dos motivos: (a) el badge debe actualizarse también en `/admin/usuarios`, `/admin/auditoria`, etc., donde no había ninguna suscripción montada; (b) si se hubieran dejado en las páginas, cada evento habría disparado **dos** `router.refresh()` (suscripción duplicada: la del layout y la de la página). Como `router.refresh()` re-ejecuta también los server components de la página actual, las listas siguen refrescándose igual que antes. El canal de `/admin` (tabla `orders`) se dejó intacto: es otra tabla y no se duplica.
- **Se conserva INSERT + filtro server-side** (no `UPDATE` sin filtro): aprobar o editar una fila existente no dispara refresh — el admin que aprueba está viendo la lista y su propia acción ya la re-renderiza. Suscribirse a todo habría provocado refrescos por cada toggle de `is_open`, que es exactamente lo que el plan pedía evitar.
- **Bug de filtro que el badge destapó (corregido):** `applyDeliveryFilters` con `status: 'pending'` filtraba solo `is_active = false`, lo que incluía cuentas **anonimizadas**. Una cuenta anonimizada está de baja permanente y su fila no ofrece ni aprobar ni reactivar, así que era un "pendiente" que nunca se podía cerrar. Ahora es `is_active = false AND anonymized_at IS NULL`. Sin este arreglo, el badge habría contado esas cuentas y al hacer clic el admin habría visto una lista con más filas que el número mostrado. Efecto colateral deseado: la lista "Pendientes de aprobar" y el CSV con ese filtro dejan de listarlas.
- **UI:** el badge no se dibuja en el sidebar colapsado (ahí tampoco hay label), pero el conteo viaja en el `title` del botón para no perderse. Se usa `Badge variant="secondary"` y no `outline` ni lima: es la única variante legible sobre los DOS fondos posibles del link (activo en lima, inactivo transparente) y en ambos temas — lima desaparecería sobre el link activo, y `outline` (texto `foreground`) se volvería blanco sobre lima en modo oscuro.
- **`count: 0` no dibuja nada**: un badge con "0" es ruido, no información.

## 2026-09-27 — Rediseño visual del panel de cliente (`docs/plans/plan-mejora-ui-panel-cliente.md`)

Alcance: `/cliente` (home, carta, carrito, pedidos, direcciones, perfil, favoritos). 22 archivos, cero archivos nuevos de implementación. Verificación completa en `docs/qa/qa-checklist-panel-cliente.md`.

### Fase 0 — tokens propios del panel

- **Tailwind v4 no tiene namespace `--duration-*`** (sólo `--ease-*`, verificado en `node_modules/tailwindcss/theme.css`): `--duration-client-fast/base/slow` del plan no generarían utilidades, así que quedaron como variables de referencia documentadas y las clases usan los valores numéricos equivalentes. `--ease-client` sí genera `ease-client` y se usa como curva del panel.
- **Se verificó que las utilidades emiten CSS real**, no sólo que el build pase: `shadow-client-card` sale como `--tw-shadow: var(--client-shadow-card)` y `ease-client` como `cubic-bezier(.16,1,.3,1)`. Una utilidad mal escrita se pierde en silencio; el checklist de QA ahora incluye esa comprobación para los valores arbitrarios.

### Fase 1 — header

- **El estado de scroll se lee como store externo (`useSyncExternalStore`), no con `useState` + listener.** El snapshot es un boolean, así que React sólo re-renderiza al cruzar el umbral (no en cada evento de scroll) y no hay `setState` dentro de un efecto. Los tres callbacks viven fuera del componente, de modo que la suscripción nunca se recrea. Además `getServerSnapshot` devuelve `false`, así que el HTML del servidor coincide con el primer render del cliente y una recarga ya scrolleada no produce hydration mismatch (React corrige después de hidratar).
- **Se completaron las dos ramas de `supports-[backdrop-filter]`,** no sólo la base: en Tailwind las variantes se emiten después de las utilidades, así que un `bg-white/90` pelado nunca le ganaría al `supports-[backdrop-filter]:bg-white/60` del estado plano y el header no se opacaría al scrollear en ningún navegador moderno. Mismo motivo por el que se cambió el par completo.
- **El badge del carrito pulsa con `key={itemCount}`** sobre el `<span>`: un re-mount dispara `animate-stat-in` sin estado extra ni temporizador.

### Fases 2 a 6 — decisiones que el plan no fijaba

- **El saludo horario se calcula en el servidor y se formatea en `en-US`** con `timeZone: 'America/Lima'` (`hour: 'numeric'`, `hour12: false`): es el único locale que devuelve el número pelado, sin sufijo, y `Number()` no depende de eso. Calcularlo en el cliente habría arriesgado hydration mismatch entre franjas horarias.
- **Lime no puede ser color de texto sobre blanco** (1.2:1): el "Agregado ✓" va como chip `bg-lime` con texto `#0C0C0E` (≈15:1), nunca como texto suelto.
- **El `+` pulsa con un `@keyframes add-pulse` nuevo** en `globals.css` (Tailwind no tiene un pulso de escala; `animate-pulse` es de opacidad e infinito). La limitación conocida: si se agrega dos veces el mismo producto dentro de 1.2s, el botón no vuelve a pulsar (la clase ya está aplicada) — el badge del header sí pulsa siempre, porque su `key` cambia con el número.
- **El "Ver menú" de la tarjeta de restaurante pasó de `opacity-0` + hover a siempre visible con `bg-white/95`.** En táctil no existe `:hover`, así que el affordance nunca se veía; y animar la opacidad del pill completo también bajaba el contraste de su texto. Se arregló el color (`text-brand-700`) y no la opacidad.
- **El reloj que "hace el tic" (`animate-clock-tick`) es el lenguaje único de "esperando":** carta cerrada, carrito con negocio cerrado y pedido buscando repartidor (antes usaban tres íconos distintos). No se extrajo un componente compartido: el plan lo prohíbe (cero archivos nuevos) y los dos banners ya tenían clases idénticas, así que la divergencia posible era sólo el ícono.
- **`ProductOrderCard` es exclusivo de `/cliente`** (verificado: su único consumidor es `RestaurantMenuView`; la carta pública usa otro markup), así que el stepper unificado y las 40×40 no afectan a la zona pública.
- **El rail del timeline se centra con `left-[11px]`** para un círculo de 24px con línea de 2px, y el círculo lleva `relative` a propósito: sin posicionarlo, el rail (absoluto) se pintaría encima del número. Arranca en `top-6` con `h-[calc(100%-0.75rem)]`, que cubre exactamente el hueco del `space-y-3`.
- **El paso activo usa un halo con `animate-ping` en vez de `animate-pulse` en el círculo:** animar la opacidad del círculo completo apaga el número la mitad del ciclo. El halo se pinta antes del texto, así que la legibilidad no cambia.
- **La `CartBar` queda montada e invisible (`opacity-0` + `translate-y-4` + `inert` + `aria-hidden`) en vez de desmontarse:** es lo que permite animar la salida al vaciar el carrito. El `inert` es obligatorio, no decorativo: sin él quedaría un enlace a `/cliente/carrito` invisible pero enfocable por teclado. En `/cliente/carrito` sigue sin renderizarse (eso no cambió).
- **El total del checkout es `sticky`, no `fixed`:** conserva su lugar en el flujo, así que no tapa el último ítem al llegar al final de la lista.
- **`ProfileForm` es compartido por los cuatro paneles:** el avatar de solo lectura se activa con una prop opcional (`showAccountAvatar`), que sólo pasa `/cliente/perfil`. Sin la prop, restaurante/repartidor/admin quedan idénticos. Sigue el precedente de `showPasswordChange`.
- **Los estados vacíos de `/cliente` adoptaron el `EmptyState` compartido** con `className` para conservar el contenedor que ya tenían (dashed, `bg-black/[0.02]`, `rounded-3xl`). Se pierde el cuadro con gradiente de marca como ícono: `EmptyState` sólo acepta un `LucideIcon`, y agregarle un slot de nodo habría cambiado un componente compartido con admin/restaurante/repartidor. Se prefirió la consistencia entre paneles.
- **Excepción deliberada:** el aviso dashed "No tienes una dirección guardada" dentro del checkout **no** se convirtió en `EmptyState` — es un aviso compacto en medio del flujo, y el bloque centrado de `py-14` lo rompería.

### Fase 8 — accesibilidad

- **Contraste: se corrigieron los textos pequeños que estaban en archivos ya en alcance** (`text-xs`/`text-sm` en `brand-600`, que da ~3.3:1) subiéndolos a `brand-700` (~5.2:1): etiqueta de `AddressCard`, la del diálogo de dirección, los tres textos del carrito y el hover del título de `RestaurantCard`. También `text-green-600` → `green-700` en el "Guardado." de `ProfileForm` (~3.3:1 → ~5:1).
- **Los que quedan NO se tocaron y están documentados en el checklist:** el subtítulo del hero (`text-white/85` sobre el gradiente de marca, ~2.6:1), el badge coral del carrito (blanco 10px, 3.3:1) y el badge de `food_type` (blanco 12px sobre `brand-500`, 3.6:1). El plan acota la verificación de contraste a los puntos **nuevos** de esta ronda; cambiarlos implica rediseñar elementos de identidad, así que se listaron con la corrección sugerida para que se decida aparte.
- **`env(safe-area-inset-bottom)` no se usó:** el proyecto no declara `viewport-fit=cover` en ningún layout, así que la variable resolvería `0` — habría sido código inútil con apariencia de soporte. El plan lo pedía "si hace falta"; no hace falta hasta habilitar `viewport-fit=cover`.

### Hallazgos abiertos (fuera de alcance, no corregidos)

- **`app/cliente/loading.tsx` renderiza su propio header skeleton** mientras el layout ya monta el `CustomerHeader` real: durante la carga se ven **dos** headers. Es pre-existente; el plan sólo pedía alinear el radio del skeleton (hecho). Candidato claro a limpieza en un próximo pase.

## 2026-09-28 — Tiempo real del detalle de pedido (Fases 0 y 1)

Fuente: `docs/plans/plan-realtime-oferta-telefono-y-voucher-yape.md`. Alcance de esta entrada: **sólo las Fases 0 y 1** (el hotfix de tiempo real). La feature de teléfono + voucher (Fases 2 a 9) queda deliberadamente sin empezar.

### Fase 0 — Diagnóstico: confirmado en el código, no era un problema de Realtime

Los tres puntos del plan se verificaron uno por uno antes de tocar nada:

- `app/cliente/pedidos/[id]/page.tsx` es un Server Component: llama a `get_delivery_offer_profile` **en el render** y sólo si `order.status === 'AWAITING_PAYMENT'`. Si la página se abrió en `PENDING`, la oferta no existe en el árbol y ninguna cantidad de eventos la hace aparecer.
- `OrderStatusSection` **sí** recibía los eventos (`postgres_changes` sobre `orders` con `filter: id=eq.<id>`) y por eso el timeline avanzaba solo — pero guardaba el estado en un `useState` privado, así que el servidor nunca se enteraba. Realtime funcionaba; lo que fallaba era la arquitectura de datos.
- `components/ui/realtime-refresh.tsx` (usado por admin y restaurante) ya era el patrón correcto: el evento no trae datos, sólo dispara `router.refresh()`.

Se confirmó además que `OrderStatusSection` era el **único** componente del proyecto con canal propio (`grep postgres_changes`: sólo `realtime-refresh.tsx` y `lib/hooks/use-realtime-invalidate.ts`). Con eso la Fase 1 se podía cerrar sin dejar estados duplicados en otra parte.

### Fase 1 — Una sola fuente de verdad

- **`RealtimeRefresh` ganó dos props opt-in** (`syncOnSubscribe`, `refreshOnFocus`) con defaults `false`: admin y restaurante no cambian de comportamiento (requisito explícito del plan). Se prefirió eso a encenderlas para todos porque son señales con costo — `syncOnSubscribe` implica un `router.refresh()` extra en cada carga.
- **Las tres señales pasan por un único `schedule()`** dentro del efecto (evento, suscripción y visibilidad), así que una ráfaga se agrupa en un solo `router.refresh()` en vez de que varias señales compitan por el mismo timer.
- **`syncOnSubscribe` se colgó del callback de `subscribe`, no de un `useEffect` aparte**: así se dispara también en cada **re**suscripción tras una caída del WebSocket, que es el mismo agujero visto por el revés (mientras el canal estuvo caído, nadie escuchó).
- **`OrderStatusSection` pasó de `initialStatus` a `status` derivado.** Era el bug clásico de "estado derivado copiado a estado local": la prop cambiaba con `router.refresh()` y el `useState` no se reinicializa nunca. Se eliminaron el `useState` **y** el canal propio (ya no importa `createClient`): un solo canal por página, y timeline / tarjeta de pago / desglose de envío no pueden contradecirse.
- **`debounceMs={150}` en el detalle, no el 1000 de admin.** Es la pantalla que el cliente mira *esperando* el evento; aun así el debounce sigue cumpliendo su función real, que es agrupar la ráfaga de updates de un mismo cambio.
- **`OrderStatusAnnouncer` compara contra el estado ANTERIOR, no contra el inicial:** abrir un pedido que ya estaba en `AWAITING_PAYMENT` no dispara ningún aviso, porque no hubo transición estando el cliente en la pantalla. Los toasts de `useToast` no están memoizados, así que el efecto se re-ejecuta en cada render, pero la guarda `before === status` lo vuelve idempotente y no hay bucle (el componente no tiene estado propio, así que tampoco se re-renderiza por su cuenta).
- **El aviso cubre las dos transiciones que el cliente no provocó:** llegó la oferta (info) y se retiró/expió volviendo a `PENDING` (warning). Sin el segundo, que la tarjeta desapareciera parecería un fallo de la app en vez de una noticia.
- **`animate-fade-up` en la tarjeta de pago** (una clase, cambio aditivo): ahora que puede aparecer sola, el movimiento es lo que avisa que llegó algo nuevo. La regla global de `prefers-reduced-motion` la neutraliza sin trabajo extra.

### Verificación

`npm run typecheck` ✅ · `npm run lint`: 8 warnings preexistentes, 0 errores, ninguno en los archivos tocados ✅ · `npm run build` ✅

### Hallazgo abierto (fuera del alcance de las Fases 0 y 1)

- **`/repartidor/pedidos/[id]` no tiene NINGÚN mecanismo de tiempo real** (verificado: es un Server Component sin `RealtimeRefresh`, y el canal `my-deliveries` que usa `DeliveryOrdersClient` vive sólo en la lista). El repartidor que acaba de enviar su oferta y se queda mirando el detalle no ve pasar el pedido a `ASSIGNED` hasta que refresca a mano — el mismo síntoma que este hotfix corrige en el panel del cliente, pero al otro lado de la transacción. No es un estado duplicado (esa página renderiza directo lo que le da el servidor, así que le basta con montar `RealtimeRefresh` con `syncOnSubscribe`/`refreshOnFocus`), pero el plan reserva ese archivo para la Fase 5, así que se deja para entonces en vez de ampliar el alcance de la Fase 1.

## 2026-09-28 — Comprobante de Yape y teléfono del repartidor (Fases 2 y 3)

Fuente: `docs/plans/plan-realtime-oferta-telefono-y-voucher-yape.md`. Fases 2 (migraciones) y 3 (backend). Fases 4 a 9 siguen sin empezar.

### Fase 2 — Base de datos

- **Bucket privado, y `on conflict do update` en vez del `do nothing` del precedente** (`20260912135915_restaurant_logos_storage.sql`): si el bucket ya existiera con la configuración por defecto, `do nothing` dejaría un bucket PÚBLICO — un fallo silencioso de privacidad. `do update` fija `public = false` y los límites aunque el bucket ya exista.
- **`voucher_order_id()` (regex) en vez de `(storage.foldername(name))[1]::uuid`** — el patrón que ya usa el proyecto para los logos. Dos motivos: un cast fallido dentro de una policy LANZA error (22P02) en vez de denegar, y el planner de Postgres es libre de reordenar los términos de un `AND`, así que "envolverlo en un AND para que el cast no llegue a evaluarse" no es una garantía. La regex restringe el patrón completo (`{uuid}/voucher.jpg`), con lo cual el cast ya es seguro cuando matchea.
- **Las dos funciones que se usan dentro de policies NO se revocan** (`voucher_order_id`, `customer_awaiting_payment_order_ids`): las expresiones de una policy se evalúan con los privilegios del rol que consulta, así que revocar EXECUTE no "endurece" nada — rompe la consulta con `permission denied for function`. Es el mismo hallazgo ya documentado en `20260928100200`.
- **`customer_awaiting_payment_order_ids()` filtra por estado A PROPÓSITO** (solo los pedidos del cliente en `AWAITING_PAYMENT`): esa es la ventana en la que existe algo que comprobar. Al pasar a `ASSIGNED` el comprobante queda inmutable — nadie puede reemplazar la evidencia después de que el pedido arrancó.
- **La policy de `SELECT` sí usa `current_customer_order_ids()` sin filtrar por estado**, al revés que la de escritura: el cliente y el repartidor tienen que poder ver el comprobante DESPUÉS de confirmar (Fase 5). Filtrar por estado acá le escondería al cliente su propia evidencia justo cuando el pedido avanza.
- **Policy de `UPDATE` además de `INSERT`**: el reintento usa `upsert: true`, así que sin policy de UPDATE el camino del reintento (el que recorre un usuario que ya perdió una vez por red) fallaría con un 403 desconcertante.
- **Sin policy de `DELETE`**: el comprobante es la única evidencia del cobro del repartidor; un cliente que pudiera borrarlo podría dejarlo sin nada después de que el pedido arrancó. El borrado real solo pasa por la API de Storage con service_role (Fase 6) — y queda anotado en la migración que borrar filas de `storage.objects` NO elimina el archivo físico.
- **`deliveries_voucher_path_check`**: la ruta guardada solo puede ser `{order_id}/voucher.jpg` de ESE pedido. Es una invariante de datos, no una validación duplicada: impide que cualquier camino futuro (Server Action, API v1, un UPDATE a mano) apunte la fila al comprobante de otro cliente, lo que le daría al repartidor de este pedido los datos personales de otro.
- **Sobrecarga `confirm_delivery_payment(uuid, text)` en vez de reemplazo**: cambiar las columnas de retorno o la firma exige DROP + CREATE, y esa ventana rompe el código ya desplegado. La convivencia tiene un costo consciente que el plan ya documenta: mientras la firma de un argumento exista, se puede confirmar sin comprobante (D1 no se cumple). Se cierra en la Fase 9.3.
- **El cuerpo de la función se conservó literal** (mismo orden de validaciones, mismos `errcode`, mismo `for update of o`, misma idempotencia antes del chequeo de estado, mismos `if not found`) y los tres cambios van marcados `(1)`, `(2)`, `(3)` en el archivo. Cualquier otro ajuste del cuerpo tendría que ser una decisión explícita, no un efecto colateral de este cambio.
- **`is distinct from` para el comprobante**, igual que las comparaciones de identidad de esa función: con `<>`, un `p_voucher_path` NULL devuelve NULL y el `IF` no se dispara. Un solo predicado cubre los dos casos (NULL y ruta ajena) porque la ruta válida es única y está determinada.
- **El comprobante tiene que existir en `storage.objects`**: es lo que convierte "el comprobante es obligatorio" en una garantía de la BASE y no solo de la UI (un upload que falló en silencio dejaría un pedido "pagado" sin evidencia). Sobre la RLS de esa tabla: la función es SECURITY DEFINER y `auth.uid()` se conserva dentro de ella, así que `payment_vouchers_select_parties` da verdadero justo para el cliente dueño del pedido — en cualquiera de los dos escenarios (que el rol definer salte la RLS de `storage.objects` o que la evalúe) el resultado es el que se busca. Y no puede llegar "temprano": la API de Storage responde 200 recién después de insertar la fila.

### Fase 3 — Backend

- **`lib/constants/payment-voucher.ts` es la única fuente de la ruta.** Ese string lo cruzan cuatro capas (navegador que sube, Server Action, API v1 y la función SQL que lo valida contra el CHECK); si una se desvía, el error que ve el usuario es "Adjunta el comprobante" en una ruta que sí lo tiene. También se dejaron ahí los números que deben coincidir con el bucket: **si se cambia `VOUCHER_MAX_BYTES` hay que cambiar `file_size_limit` en la migración** (la barrera que de verdad importa es la del servidor de Storage, la del navegador se puede saltar).
- **`types/database.ts` declara la sobrecarga como unión de `Args`** (`{ p_order_id }` | `{ p_order_id; p_voucher_path }`), que es como la genera el CLI de Supabase para funciones con overloads. Es lo que permite que la firma vieja siga typecheckeando.
- **La Server Action deriva la ruta del `orderId`; el navegador no la elige.** La función SQL la vuelve a validar (defensa en profundidad): un cliente que llamara a la RPC directamente tampoco puede apuntar a otro archivo. El docblock de la acción deja escrito el ORDEN (subir → confirmar), que no es negociable porque la función rechaza la llamada si el archivo no existe.
- **API v1 (`confirm_payment`)**: mismo cambio + un comentario que documenta la obligación para consumidores externos (subir el comprobante con el mismo token Bearer y recién después llamar la acción). No hizo falta tocar el mapeo de errores: `rpcErrorResponse` ya traduce `22000` a 400 con el mensaje de la función.
- **Desviación deliberada en la lectura de la oferta (3.5):** la página ya usa `get_delivery_offer_details`, pero **no** se firmó la URL del comprobante ni se llama la RPC en los estados vivos posteriores al pago — las dos cosas que el plan incluye en 3.5 quedan para la Fase 5, que es donde existe la UI que las consume. Hacerlas ahora sería consultar y firmar una URL por carga de página que nadie lee (y dejar un `voucherUrl` sin consumidor). Los dos párrafos del plan apuntan a lo mismo; se separó por dónde se usa, no por fase.

### Verificación

`npm run typecheck` ✅ · `npm run lint`: 8 warnings preexistentes, 0 errores ✅ · `npm run build` ✅

Las 4 migraciones se aplicaron al proyecto vinculado con `supabase db push` (paso 2 de la Fase 9), junto con una migración previa que estaba pendiente (`20260929000000_orders_customer_created_idx.sql`). Verificado contra la base REAL:

- `storage/v1/bucket/payment-vouchers` → `public: false`, `file_size_limit: 5242880`, `allowed_mime_types: [jpeg, png, webp]`.
- `deliveries.payment_voucher_path` responde por REST (existe la columna).
- `get_delivery_offer_details` y la sobrecarga `confirm_delivery_payment(uuid, text)` existen (PostgREST las resuelve por firma) y **rechazan a `anon` con `42501 permission denied for function`** — o sea, el `revoke ... from public, anon` hizo lo que debía.
- `supabase migration list --linked` muestra las cinco migraciones aplicadas en local Y en remoto, y el CHECK `deliveries_voucher_path_check` salió adelante: no se pudo inspeccionar la restricción directamente (el bucket y las policies viven en el esquema `storage`, y `supabase db dump` exige Docker, apagado), pero `alter table add constraint` con una expresión no inmutable (el `order_id::text || '/voucher.jpg'`) habría abortado la migración `...100100`, y las dos migraciones POSTERIORES de esa misma cadena se aplicaron — el CLI de Supabase es secuencial y se detiene en el primer error.

Lo que sigue sin poder probarse sin dos sesiones reales (queda para la Fase 8): las tres policies de `storage.objects` (subir en el pedido propio, 403 en el ajeno, 403 fuera de `AWAITING_PAYMENT`), el `403` del repartidor no asignado y que el `SELECT` sobre `storage.objects` no dé falso negativo dentro de `confirm_delivery_payment`.

### Ventana entre la Fase 3 y la Fase 4 (CERRADA)

Mientras solo existía la Fase 3, el botón "Ya pagué, confirmar" no podía completar el flujo (la acción ya exigía comprobante y no había UI para subirlo). La Fase 4 cierra esa ventana. Los scripts `scripts/e2e-*.mjs` (locales, no versionados) siguen fallando hasta que se actualicen en la Fase 8, porque llaman a `confirm_payment` sin subir comprobante.

## 2026-09-28 — Tarjeta de pago, comprobante visible y ciclo de vida (Fases 4, 5 y 6)

Fuente: `docs/plans/plan-realtime-oferta-telefono-y-voucher-yape.md`.

### Fase 4 — La tarjeta (`DeliveryPaymentCard`)

- **El párrafo eliminado se reemplaza por ORDEN, no por otro párrafo.** El cliente tiene una tarea de tres pasos (pagar, adjuntar, confirmar) y la tarjeta ahora los numera con títulos cortos. Se descartó un stepper interactivo a propósito: no hay navegación entre pasos —los tres están a la vista— así que agregar uno habría sumado taps para no aportar nada. El CTA sigue siendo el único botón lleno.
- **La tarifa sube de `text-xs` a `text-lg font-semibold`**: es el dato que el cliente necesita para pagar, no una nota al pie.
- **Contraste MEDIDO, no estimado** (Fase 7 del plan): los textos pequeños de la tarjeta usan `amber-900` (~8.9:1 sobre el fondo ámbar) en lugar de `muted-foreground`, que sobre ese fondo queda en ~4.6:1. Pasa el mínimo AA, pero sin margen: cualquier ajuste de token lo rompería en silencio, así que se prefirió el color con margen de sobra. En modo oscuro, `amber-100` sobre el ámbar translúcido.
- **Fases explícitas en vez de `useTransition`** (`preparing` → `uploading` → `confirming`): son tres esperas distintas y el usuario tiene que poder distinguirlas (comprimir una foto de 6 MB no es lo mismo que subirla con mala señal). Con un booleano las tres se veían como "Confirmando…".
- **El archivo se sube ANTES de llamar a la acción de confirmación**, con el cliente de navegador y la RLS del usuario. Las Server Actions tienen un límite de cuerpo de 1 MB por defecto; subir el límite global sería peor que este camino, que además es el mismo patrón ya validado con ImageKit.
- **El reintento conserva el archivo** y usa la misma ruta con `upsert`: un corte de red no obliga a volver a buscar la foto en la galería ni deja dos comprobantes del mismo pedido.
- **El estado deshabilitado del botón se explica con texto visible**, no con un `title`: un botón gris sin motivo es un callejón sin salida.
- **`CopyButton` con feedback en el ícono** (`Copy` → `Check` por 2 s), no un toast: en el celular un toast arriba puede quedar fuera de la vista justo cuando el usuario mira el botón que acaba de pulsar. El toast queda para el error. Se copian los 9 dígitos SIN espacios (lo que Yape acepta al pegar) y se muestran agrupados (987 654 321) para leerlos y dictarlos.
- **40×40 px logrados con la variante por defecto + `h-10 w-10 p-0`, no con `size="icon"`**: `size-8` y `h-10` no son excluyentes para `twMerge` (grupos distintos), así que la combinación dejaría las dos clases y el tamaño final dependería del orden del CSS. Verificado con el propio `twMerge` antes de escribir el componente.
- **`PaymentVoucherPicker` es controlado y no sabe de Supabase**: recibe `file`/`onChange` y el padre decide cuándo subir. Es lo que hace posible el diseño de un solo paso (subir al confirmar) y deja el componente testeable sin red. Los `objectURL` de la vista previa se revocan en cada cambio y al desmontar (el `ImageUploader` existente no lo hace; acá el archivo puede ser de varios MB y el usuario puede cambiar de foto varias veces).
- **No se reutilizó `ImageUploader`**: está atado a ImageKit y al modo público. Forzarlo a subir a un bucket privado lo habría vuelto un componente con dos personalidades. Duplicación consciente y chica, documentada en el plan.
- **El `<input type="file">` va `sr-only`, no `hidden`**: con `display:none` desaparece del árbol de accesibilidad y la tecnología asistiva pierde la única forma de elegir el archivo. Verificado en el árbol de accesibilidad real (aparece como `button "Toca para subir tu comprobante…" value="No file chosen"`).

### Fase 5 — El comprobante después de confirmar

- **La URL firmada se genera con el cliente DEL USUARIO** (nunca service role): la RLS del bucket decide de verdad, así que un repartidor que no es parte del pedido simplemente no obtiene URL.
- **`createSignedUrl` + `<img>`, nunca `next/image`**: el optimizador cachearía la imagen fuera del control de expiración de la firma, que es justamente lo que la firma busca evitar. El `eslint-disable` de `no-img-element` es deliberado y está explicado en el archivo.
- **La fila del cliente va dentro de `OrderSummaryCard`** (slot nuevo `voucher`), no en una tarjeta nueva: el comprobante es la prueba del `Envío S/ X` que se muestra dos centímetros más arriba. Separarlos habría vuelto a fragmentar una misma idea ("cuánto pagué y con qué"), que es exactamente lo que ese componente existe para evitar.
- **Slot y no booleano**: el contenido es un componente de cliente (el diálogo) y la tarjeta es de servidor; así el servidor decide SI hay comprobante y el cliente solo lo abre.
- **El repartidor ve el monto AL LADO de la imagen**, que es lo que le permite contrastar de un vistazo que el comprobante coincide con lo que cobró, sin leer la captura.
- **En la lista del repartidor hay un indicador, no la imagen**: un chip "Comprobante adjunto" que enlaza al detalle. Cargar la miniatura exigiría firmar una URL (y una petición de Storage) por fila para mostrar un dato del que no se puede leer nada a ese tamaño.
- **Se usó `DialogTitle` en los dos diálogos de la tarjeta** (el QR y el visor): un `role="dialog"` sin nombre se anuncia solo como "diálogo". El texto del pie del QR se conserva palabra por palabra —el pedido apuntaba al párrafo de la tarjeta, no a ese— pero ahora es el nombre accesible del diálogo.

### Fase 6 — Ciclo de vida y privacidad

- **El borrado es "mejor esfuerzo" y va DESPUÉS de la operación de negocio** (igual que `deleteImageKitFileSafe`): los llamadores ya cancelaron el pedido / retiraron la oferta / anonimizaron la cuenta. Un fallo de Storage no puede deshacer eso ni devolverle un error al usuario; deja un huérfano —el modo de fallo aceptable— y lo registra.
- **Borrar una ruta inexistente no es error** en la API de Storage, así que los llamadores no necesitan comprobar antes si el pedido tenía comprobante.
- **La guarda es `payment_confirmed_at`, y su lectura va ANTES de borrar la oferta** (`removeUnconfirmedVoucher`): la fila de `deliveries` es la que dice si el pago se confirmó, y `releaseUnconfirmedOffer` la borra. Al revés, la guarda leería siempre `null` y no protegería nada. El mismo orden se replicó en la ruta de la API v1, que tenía su propia copia de la limpieza.
- **"Sin fila de `deliveries`" NO es una excepción a la guarda**: los tres caminos que borran la fila (cancelar, retirar, expirar) exigen `payment_confirmed_at is null`, así que sin fila no puede haber pago confirmado. Y es justo el caso del huérfano a limpiar.
- **En retirar la oferta la limpieza va DESPUÉS del RPC**, y es seguro por una garantía del propio RPC: se niega a retirar una oferta ya pagada. Es lo que hace que llegar hasta ahí implique que no hay nada que proteger.
- **En `anonymizeProfile` las dos lecturas van en `Promise.all`** (perfiles y pedidos del cliente, tablas distintas): son independientes y encadenarlas sería un waterfall. Los pedidos se buscan por `customer_id` sin preguntar el rol — para un repartidor la lista vuelve vacía y el borrado es un no-op, que es lo que mantiene el helper agnóstico del rol.
- **Privacidad**: nueva viñeta en "Datos que recopilamos", finalidad en la sección 3 (se comparte únicamente con el repartidor asignado), mención en conservación (se borran al anonimizar) y `UPDATED_AT` al 28/09. Una categoría nueva de dato es un cambio material y la propia política se compromete a publicar cada cambio con su fecha.

### Verificación

`npm run typecheck` ✅ · `npm run lint`: 8 warnings preexistentes, 0 errores, ninguno en los archivos nuevos ✅ · `npm run build` ✅

**Verificación visual y funcional en el navegador** (ruta temporal de preview, ya borrada — se usó el dev server que ya estaba corriendo en :3000 de este mismo directorio), porque la Fase 7 del plan marca accesibilidad y responsive como no negociables:

- **Responsive 360 px: sin scroll horizontal.** El primer intento marcó overflow, pero era de la PÁGINA de preview (una columna de grid con `min-width: auto`), no de la tarjeta: con el contenedor en bloque, la tarjeta mide 311 px y todos sus hijos quedan en 270. La misma trampa existe en el grid de la página real, y el plan anterior ya la había validado; queda anotada por si alguien mete ahí un hijo no encogible.
- **Modo oscuro** revisado en captura: ámbar translúcido sobre fondo oscuro, círculos numerados y textos de aviso legibles.
- **`CopyButton`**: 40×40 reales (medidos), y al copiar cambia el ícono, el `aria-label` pasa a "número del repartidor copiado" y la región `aria-live` anuncia lo mismo. **Acá apareció un bug real:** `navigator.clipboard.writeText` puede EXISTIR y aun así rechazar ("Document is not focused" en una pestaña sin foco, política de permisos heredada de un WebView...). La primera versión se rendía ahí, sin probar el respaldo que sí funciona. Ahora se espera la promesa y, si rechaza, se sigue al `execCommand`; verificado que con eso el copiado funciona en el mismo entorno donde antes fallaba.
- **Compresión medida** (ruido pseudoaleatorio = peor caso de compresión; captura realista = caso real): foto de 12 MP → **422 KB en 166 ms**; captura de iPhone con ruido → 553 KB; cuadrada de 1600 px con ruido → 1.15 MB (sigue muy lejos del tope de 5 MB del bucket); **captura de Yape realista → 58 KB en 96 ms** (el plan pedía < 500 KB). Salida siempre `image/jpeg`.
- **PNG transparente → esquina `rgb(255,255,255)`**: el relleno blanco evita el bloque negro que JPEG produce al descartar el alfa.
- **Segundo bug real encontrado acá:** con un archivo que el navegador no puede decodificar, el toast mostraba el error nativo en inglés ("The source image could not be decoded"). Ahora `toVoucherJpeg` traduce ese caso a "No pudimos procesar esa imagen. Prueba con otra foto o captura." (foto truncada, archivo dañado o HEIC sin soporte son casos reales). Verificado.
- **Camino de error del envío verificado de punta a punta**: con un archivo válido, la tarjeta pasó por "Subiendo comprobante…", la subida fue denegada por la policy (respuesta `{"statusCode":"403","message":"new row violates row-level security policy"}` — el 400 de HTTP es el envoltorio de Storage), apareció el toast con el mensaje en español y **el archivo elegido siguió seleccionado** para reintentar. Que la denegación sea de RLS (y no del bucket) confirma que la ruta, el `contentType` y el tamaño pasan la validación del servidor: lo único que faltaba era una sesión real.
- **Sin verificar (necesita dos sesiones reales, Fase 8):** el camino feliz completo (subida con éxito + confirmación + `payment_voucher_path` guardado), las tres policies de `storage.objects` por rol, que el repartidor asignado lea el comprobante y otro no, y la limpieza de la Fase 6 contra el bucket real.

### Hallazgo abierto — el huérfano del job de expiración

La Fase 6 del plan pide limpiar el comprobante también "en el job de expiración, una pasada de limpieza por los pedidos devueltos a `PENDING`", y **eso no se puede implementar desde este repo**:

- `expire_stale_delivery_offers` no tiene ningún invocador en el código (se llama desde un cron/Edge Function externo con la service role key, por decisión de equipo documentada en su migración), y **devuelve un `integer` con el número de pedidos expirados, no sus ids** — quien la llama no puede saber qué pedidos liberar, así que ni siquiera podría hacer la limpieza aunque quisiera.
- El huérfano concreto es acotado (el cliente alcanzó a subir el archivo y su confirmación falló, y además la oferta expiró después): un archivo de ~60-400 KB sin referencias. La purga por antigüedad (Fase 6.3 del plan, 90 días tras `DELIVERED`) tampoco lo cubriría, porque se apoya en las filas de `deliveries` que ese camino borra.
- **Corrección recomendada (fuera del alcance de estas fases):** que la función devuelva los ids liberados (una migración de una función, con el `drop`+`create` de siempre) y que el job llame a la limpieza. Requiere tocar el job externo en cualquier caso, así que es una decisión de despliegue, no un cambio que se pueda resolver dentro de la app.

### Fase 7 — Accesibilidad y responsive (medidas, no estimadas)

- **Contraste medido en el navegador con un arnés temporal** (ruta de preview, ya borrada): `amber-900` ≈ 8.89:1 sobre el fondo ámbar, `muted-foreground` 4.74:1 (pasa AA sin margen), `emerald-700` 5.36:1, `destructive` 4.77/4.63:1 claro/oscuro; en modo oscuro todo entre 14.65 y 16.74:1.
- **Botones táctiles ≥ 40×40 px y 360 px sin scroll horizontal**: confirmados por medición.
- **`prefers-reduced-motion` ya estaba cubierto**: el bloque global `*, ::before, ::after` con `animation-duration: 0.01ms !important` alcanza a `animate-fade-up`; no hizo falta tocar la animación.
- **Lección: `transition-all` puede hacer que el foco "parezca roto" en un arnés.** Los botones tienen transición también en el outline; leer `getComputedStyle` justo después de `focus()` devuelve el outline a mitad de animación y cualquier script lo registraría como "sin indicador de foco". Esperando ~250–400 ms, todos los botones enfocan en lima 2 px con offset 1 px. Falso positivo del arnés, no bug del producto.
- **Lección: `navigator.clipboard.readText` da `NotAllowedError` sin foco del documento aunque el copiado SÍ funcione** (el `CopyButton` escribe con `writeText` + respaldo `execCommand`, ya validado). Al probar portapapeles por script, ese error no implica que la función esté rota.
- **Dos fixes reales en `PaymentVoucherPicker`:** (1) el layout pasa a apilarse en móvil (`flex flex-col gap-3 sm:flex-row sm:items-center` con contenedor interno `min-w-0 flex-1`) porque en 360 px el nombre del archivo y el botón se pisan; (2) el overlay de ocupado sube a `bg-white/90 dark:bg-black/75` (antes 75%/60%) porque los textos quedaban legibles pero superpuestos con la imagen.

### Fase 8 — Suite E2E con sesiones reales (extension)

- **`scripts/e2e-delivery-offer.mjs` pasó de 399 a 572 líneas (44 verificaciones), TODO VERDE contra la base remota + dev server reales** — dos corridas completas en verde (la segunda tras el drop de la Fase 9).
- **Los fixtures de MIME y tamaño usan bytes reales, no headers mentirosos:** `allowed_mime_types` del bucket evalúa el archivo subido, así que el fixture lleva JPEG/GIF/PNG reales inline (base64). Eso permite probar los rechazos 415 (GIF) y 413 (>5 MB) que con un `Blob` mal etiquetado no se ejercitan.
- **El fixture setea `phone='987654321'` a ambos repartidores**: `get_delivery_offer_details` expone el teléfono, y sin dato de prueba la columna vuelve siempre `null` y el test no distingue "no hay" de "no llega".
- **Storage oculta la existencia: la lectura no autorizada devuelve 404, no 403** — verificado en la base real para otro repartidor y para `anon` (el objeto no existe, desde el punto de vista de quien no puede verlo).
- **Casos cubiertos que antes quedaban como "pendiente dos sesiones reales":** confirmar sin comprobante → 400 con mensaje; ruta `null` o de otro pedido → 22000 "Adjunta el comprobante"; las tres policies de `storage.objects` (403 en ruta ajena, en PENDING, y re-subida tras ASSIGNED); la CHECK de la ruta (23514); doble confirmación → 409; confirmación ajena → 403; cancelar en AWAITING_PAYMENT borra el voucher; carrera confirmar-vs-expirar consistente; y la limpieza deja el bucket con 0 archivos de prueba.
- **Lección de operación:** la suite depende del dev server; una corrida con el servidor caído falla en cascada (los fixtures quedan `undefined` y la RPC se invoca con una sola clave, lo que produce un `PGRST202` que PARECE un problema de firma de función pero no lo es — es el fixture). Si el resumen trae fallos de `fetch failed` mezclados con `PGRST202`, revisar primero si el servidor estaba vivo.

### Fase 9 — Drop de las funciones legacy y orden de despliegue

- **Migración `20260930100400_drop_legacy_offer_functions.sql`:** `drop function public.confirm_delivery_payment(uuid)` y `drop function public.get_delivery_offer_profile(uuid)`. Cierra la ventana D1: ya no existe ningún camino para confirmar el pago sin comprobante.
- **El drop lleva la firma explícita `(uuid)`**: sin ella, `drop function confirm_delivery_payment` sería ambiguo con la sobrecarga `(uuid, text)` y Postgres fallaría con "function is not unique". El drop de una sobrecarga no toca a la otra.
- **El rollback va verbatim en comentarios dentro de la misma migración** (cuerpos copiados de 20260928100200, incluidos los `revoke`/`grant`): revertir el despliegue a una app anterior no exige buscar en el historial de migraciones.
- **`types/database.ts` quedó con una sola firma:** `confirm_delivery_payment: { Args: { p_order_id: string; p_voucher_path: string } }` y fuera `get_delivery_offer_profile`. La unión de dos firmas que dejó la Fase 3 existía para que el código viejo siguiera compilando durante la ventana; cerrada la ventana, el tipo dice la verdad.
- **Verificado contra la base real después del `db push`:** las dos funciones legacy responden `PGRST202` (no existen), mientras `confirm_delivery_payment(uuid, text)` y `get_delivery_offer_details` siguen vivas y siguen rechazando a `anon` con 42501.
- **La suite E2E se re-corrió DESPUÉS del drop: TODO VERDE (44/44).** El orden exigido por el plan se cumplió: primero el código que usa las firmas nuevas (Fases 3–5), después la suite verde (Fase 8), y recién entonces el drop. El rollback inline es el plan B si hiciera falta volver atrás.

### Verificación final (Fases 7 a 9)

`npm run typecheck` ✅ · `npm run lint`: 8 warnings preexistentes, 0 errores ✅ · `npm run build` ✅ · suite E2E post-drop: 44/44 TODO VERDE ✅ · drop verificado por RPC contra la base real ✅

### Pendiente

- **Purga por antigüedad de comprobantes (6.3):** falta definir el plazo con el asesor legal.
- **Corrección recomendada del job de expiración** (que `expire_stale_delivery_offers` devuelva los ids liberados para que el job limpie los comprobantes huérfanos): documentada arriba como decisión de despliegue, fuera del alcance de la app.

---

## 2026-09-29 — Método de pago del envío (efectivo o Yape) y reorden del detalle del pedido

Plan: `docs/plans/plan-metodo-pago-efectivo-o-yape-y-reorden-detalle-pedido.md`. Es un cambio de flujo, no solo de UI: el cliente puede pagar el envío **por Yape por adelantado o en EFECTIVO al recibir**, y el repartidor tiene que verlo antes de salir.

### Decisiones D1–D8 (el plan las dejaba abiertas)

- **D1 — el efectivo cubre el ENVÍO + LA COMIDA** (decisión del producto). El cliente le entrega al repartidor `orders.total` + `deliveries.delivery_fee` al recibir el pedido. **No se agregó ninguna columna de monto a cobrar**: los dos montos ya existían como snapshots del pedido y el efectivo se deriva con `cashAmountDue()` (`lib/constants/payment-method.ts`). Un dato derivado no se puede desincronizar; una columna nueva sí (bastaba con que una edición futura del pedido la olvidara). El copy dice siempre "comida + envío" en vez de un "total" ambiguo: para quien paga en la puerta, la diferencia entre S/ 12.50 y S/ 20.00 es la diferencia entre lo que tiene en el bolsillo y lo que no.
- **D2 — sin preselección.** Los dos radios arrancan vacíos; el CTA del panel no se puede confirmar sin elegir (`paymentMethodSchema` rechaza `undefined`). Preseleccionar Yape le habría hecho confirmar "por Yape" a quien quería efectivo con un solo toque, que es exactamente el error que este flujo no puede permitirse (mueve dinero).
- **D3 — la elección es definitiva y el aviso va ANTES del clic.** El aviso de irrevocabilidad (`PAYMENT_METHOD_LOCK_NOTICE`) se muestra dentro del panel, no en un diálogo de confirmación posterior: quien ya decidió no necesita un paso extra, y quien no, tiene que enterarse antes de apretar. La razón de que sea definitiva es que al confirmar el pedido sale de `AWAITING_PAYMENT` y arranca el repartidor — no hay camino de vuelta en la aplicación.
- **D4 — `text` + `CHECK`, no un `enum`.** Es el mismo problema que ya se sufrió con `AWAITING_PAYMENT` (`20260928100000`): un valor nuevo de un enum no se puede usar en la misma transacción que lo agrega. El dominio va a crecer (Plin, tarjeta), así que la columna es `text` con `deliveries_payment_method_check`/`orders_payment_method_check` en `('YAPE','CASH')`, y su espejo en TypeScript es `PAYMENT_METHODS`.
- **D5 — `payment_confirmed_at` cambia de SIGNIFICADO, no de columna:** de "el cliente pagó por Yape" a **"el cliente cerró su elección"**. Se hizo con un `comment on column` en la migración (el invariante queda en la base, junto al dato) y con un backfill `payment_method='YAPE'` donde ya estaba puesto, ANTES de crear los CHECK: la única elección que podía existir hasta hoy era Yape. Sin ese orden, el CHECK habría rechazado las filas históricas.
- **D6 — el cobro en efectivo lo confirma el repartidor al entregar** (`deliveries.cash_collected_at`). La UX es un `ConfirmDialog` con el monto a la vista; la garantía es `complete_delivery()`, que rechaza (22000) la entrega de un pedido CASH sin el flag `p_cash_collected`. El diálogo solo pregunta; la base es la que no deja pasar.
- **D7 — orden del detalle del cliente: Resumen → Pago (solo en `AWAITING_PAYMENT`) → Estados → Entrega.** Antes el pago era una columna lateral "sticky" y el cliente tenía que buscarlo; ahora la acción pendiente es el segundo bloque del documento, en la posición donde termina el resumen que la justifica.
- **D8 — etiquetas "Pagar al recibir" y "Pagar ahora"**. Describen el CUÁNDO (que es lo que el cliente decide) en vez del medio (`PAYMENT_METHOD_COPY`); el subtítulo agrega el cómo. El chip del resumen usa la forma corta ("Efectivo al recibir"/"Yape").

### Lección: un grid plano con hijos condicionales coloca las tarjetas según el estado del contenido

El detalle del cliente era `md:grid-cols-[1fr_22rem] md:items-stretch` con las tarjetas como celdas. En un grid **plano**, la posición de cada hijo la decide su ÍNDICE, no su significado: como la tarjeta de pago se renderiza solo en `AWAITING_PAYMENT`, al elegir método desaparecía una celda y las siguientes se corrían (Estados pasaba a la columna lateral), además de que `items-stretch` estiraba la tarjeta de la izquierda para igualar el alto de la derecha. **La solución no fue reordenar celdas sino dejar de usar grid: una pila vertical (`flex flex-col gap-4`)**, donde el orden del DOM ES el orden visual en todos los anchos y en todos los estados, y cada bloque mide lo que mide su contenido. Regla general: si el conjunto de hijos depende del estado, un grid de posición fija miente; una pila no.

### Fase 1 — Base de datos (tres migraciones, aplicadas y verificadas)

- `20261001100000_delivery_payment_method.sql`: columnas `deliveries.payment_method`, `deliveries.cash_collected_at`, `orders.payment_method`; backfill de Yape; cuatro invariantes: método válido en las dos tablas, `payment_voucher_path` solo con YAPE, y `cash_collected_at` solo con CASH. Las dos últimas **cruzan columnas del mismo registro** y son las que hacen imposible el estado mixto ("cobrado en efectivo con comprobante adjunto").
- `20261001100100_select_delivery_payment.sql`: `select_delivery_payment(uuid, text, text)` — la ruta del comprobante pasó a ser un PARÁMETRO, para que el servidor la derive (canónica, `order_id/voucher.jpg`) en vez de aceptarla del cliente. En la MISMA migración, `confirm_delivery_payment(uuid, text)` se convierte en un envoltorio `language sql` de una línea que delega con `'YAPE'`: la app ya desplegada llamaba a esa firma y con el CHECK nuevo habría fallado en producción entre el `db push` y el despliegue del código.
- `20261001100200_complete_delivery.sql`: `complete_delivery(uuid, boolean default false)` — `delivered_at` + `cash_collected_at` + `status='DELIVERED'` en UNA transacción. Antes eran dos updates independientes y el segundo podía fallar en silencio; con efectivo de por medio, "entregado sin constancia de cobro" deja de ser cosmético y pasa a ser el "no me pagaron" de ambos lados.
- **Verificación contra la base real: 24/24** (`scripts/verify-delivery-payment-phase1.mjs`), por RPC: backfill, las cuatro CHECK (23514), los `errcode` de siempre (42501 ajeno/anon, P0002 inexistente, 23505 doble confirmación, 22000 sin comprobante), el envoltorio que deja YAPE, y las tres ramas de `complete_delivery`.

### Fase 2 — Backend

- `confirmDeliveryPayment(orderId, method)` (Server Action) y `PUT /api/v1/orders/[id]` con `action:'confirm_payment'` aceptando `{ method }`, **con default YAPE si el cuerpo no lo trae**: la suite y los clientes ya desplegados llamaban sin cuerpo, y el default los mantiene funcionando mientras el flujo nuevo llega.
- **Se redirigió también `action:'advance'` de la API al `complete_delivery`**: era el otro camino por el que se podía entregar un pedido CASH sin cobrar. El endurecimiento no sirve si queda una puerta abierta al lado.
- El **override de ADMIN** no exige el flag de cobro: el admin es quien resuelve el caso raro ("el repartidor cobró pero su teléfono se quedó sin batería"), no un repartidor en general.
- **Verificación: 44/44** de la suite E2E existente (la regresión más importante: el flujo por Yape tenía que seguir intacto) y **12/12** de una capa nueva de API (`scripts/verify-payment-api-phase2.mjs`).

### Fase 3 — Layout del detalle del cliente

Pila vertical (ver la lección del grid), `ClientPageContainer` con un tamaño nuevo `medium` (`max-w-2xl`) en vez de `wide`, y el resumen de productos colapsado en un `<details>` nativo **cerrado** cuando hay más de 3: con el pago arriba, una lista larga empujaría la acción pendiente fuera de la primera pantalla en un móvil. El desglose de costos queda siempre visible.

### Fases 4 y 5 — UI del cliente y copy

- `PaymentMethodChoice` (radios nativos `sr-only` + `peer-checked`), `CashPaymentPanel`, `YapePaymentPanel` (extraído del card anterior) y `DeliveryPaymentCard` como orquestador. **El archivo del comprobante vive en el padre**, no en el panel de Yape: alternar métodos y volver tiene que encontrarlo tal como se dejó.
- `YapePaymentPanel` entra con `next/dynamic` (`ssr:false`) y esqueleto: el compresor de imágenes y el panel de Yape no viajan en la carga inicial del detalle (verificado en `page_client-reference-manifest` de `.next`, no en el HTML servido).
- El chip del método y la nota del resumen dependen del método: el texto "El envío se paga directo a tu repartidor por Yape." dejó de ser universal y mostrárselo a quien eligió efectivo es una afirmación falsa sobre su dinero. Con `payment_method` nulo (pedidos legacy) no se muestra ni chip ni nota.

### Fase 6 — Repartidor

- Lista "Mis entregas": chip ámbar **"Cobrar S/ X en efectivo al entregar"** con el monto derivado, y el copy de `AWAITING_PAYMENT` pasa a "esperando que el cliente **elija cómo pagar**" (ya no "confirme el pago": ahora hay dos formas de pagar y una no tiene comprobante que confirmar).
- Detalle: bloque **"Cobro en efectivo"** con el monto grande, la instrucción "Cobra al entregar: comida + envío" y, después de entregar, "Cobrado el {fecha}" — el mismo lugar y el mismo dato en dos momentos. El bloque del comprobante sigue apareciendo solo si hay `payment_voucher_path`.
- `AdvanceStatusButton` recibe el método: con `ON_THE_WAY` + CASH el botón abre el `ConfirmDialog` en vez de ejecutar (ver D6). Para Yape y legacy nada cambia, sin paso extra.
- **El desglose "cobrado por Yape / en efectivo" del dashboard (6.4, opcional en el plan) NO se hizo:** los buckets de los gráficos salen de `aggregateOrders()`, compartido con `/admin` y `/restaurante`, y agregarle una serie por método habría cambiado una primitiva común para una mejora que el propio plan marca como no bloqueante. Queda como candidato, con el select de `deliveries` ya listo para agregarle `payment_method`.

### Fase 7 — Ciclo de vida, limpieza y privacidad

- **CASH no genera ningún archivo**, así que `removeUnconfirmedVoucher` es un no-op en esa rama (y no por casualidad: el efectivo no tiene comprobante que subir). Los tres caminos que devuelven el pedido al pool (cancelar, retirar, expirar) siguen exigiendo `payment_confirmed_at is null`, y elegir método lo escribe: retirarse DESPUÉS de que el cliente eligió no es posible para el repartidor.
- **La anonimización no cambia:** `payment_method` y `cash_collected_at` son datos de la TRANSACCIÓN, no PII, y se conservan igual que el monto y las fechas; los comprobantes se siguen borrando como antes. La limpieza por `removePaymentVouchers` de un pedido CASH intenta borrar una ruta que no existe, y eso no es un error (Storage responde OK).
- **Política de Privacidad:** se agregó el método de pago elegido al punto 2 ("Historial de pedidos… y el método de pago elegido para el envío (Yape o efectivo)") y se actualizó `UPDATED_AT` a la fecha del release, que es a lo que la propia sección 10 se compromete.

### Fase 8 — Accesibilidad, measurement contra los tokens, no estimación

- **Contraste medido**, no estimado: los valores salieron de `node_modules/tailwindcss/theme.css` y `app/globals.css` (oklch), se convirtieron a sRGB con las matrices de CSS Color 4 y se compusieron en sRGB — que es como compone el navegador un `background-color` con alfa. Nada de "a ojo".

  | Qué | Medición | Mínimo |
  |---|---|---|
  | chip "Efectivo al recibir" (amber-900 / amber-100) | 8.17:1 | 4.5 |
  | recordatorio CASH (amber-900 / amber-100 al 60%) | 8.52:1 | 4.5 |
  | bloque "Cobro en efectivo" (amber-900 / amber-50) | 8.77:1 | 4.5 |
  | monto `text-2xl` (amber-900 / amber-50) | 8.77:1 | 3 |
  | chip en oscuro (amber-100 / amber-500 al 15%) | 12.35 a 14.24:1 | 4.5 |
  | texto `foreground` sobre la opción elegida (amber-100 al 60%) | 18.55:1 | 4.5 |

- **Dos fallos REALES encontrados y corregidos (los aporta la medición, no la inspección):**
  1. **El borde del bloque "Cobro en efectivo" no se veía.** Con `amber-300` medía **1.45:1** sobre el blanco de la página, y el fondo del bloque (`amber-50`) mide **1.04:1**: el borde era *lo único* que delimitaba el bloque, así que el dato que el repartidor tiene que leer en la puerta quedaba sin contorno. Ahora `amber-600` (**3.08:1** sobre su propio fondo) y `amber-500/60` en oscuro (**3.74:1**).
  2. **El círculo vacío de los radios era casi invisible.** `black/25` medía **1.83:1** y `white/30` en oscuro **2.70:1**, ambos bajo el 3:1 que 1.4.11 pide para el límite de un control: el usuario tenía que *adivinar* que ahí había algo que se podía elegir. Ahora `black/45` (**3.35:1**) y `white/45` (**4.32:1**). En la misma pasada, el borde de la tarjeta ELEGIDA subió de `amber-500` (2.15:1) a `amber-600` (3.19:1).
- **Lo que NO se tocó, y por qué:** los bordes de las tarjetas CONTENEDORAS (la tarjeta de pago, las tarjetas de opción). 1.4.11 alcanza a los componentes de interfaz y a la información necesaria para entender el contenido; una tarjeta se identifica por su texto (título y subtítulo miden entre 8.2:1 y 18.6:1), y endurecer esos bordes habría sido rehacer el lenguaje visual del panel por un requisito que no aplica. La línea se trazó por criterio, no por comodidad, y queda escrita para poder revisarla.
- **Hallazgo real de teclado: el foco quedaba DETRÁS del header.** `CustomerHeader` (sticky, 61 px) y `PublicHeader` (fixed, 73 px) viven pegados al borde superior y no había `scroll-padding-top`: al tabular hacia un control cercano al borde, el navegador lo desplazaba a la posición 0 del documento y el elemento enfocado quedaba tapado — el foco "desaparecía" justo cuando el usuario lo seguía. Se agregó `scroll-padding-top: 5rem` en `html`.
- **Sin depender del color:** la opción elegida cambia borde + fondo + círculo interior, y el método del resumen es TEXTO ("Efectivo al recibir"), no un punto de color. El chip del repartidor también dice el monto en palabras.
- **Objetivos táctiles:** opciones `min-h-14` (56 px), CTA `h-11` (44 px), `summary` del detalle `<details>` `min-h-10`. `prefers-reduced-motion` ya estaba cubierto por la regla global y no se agregó ninguna animación nueva.

### Fase 9 — QA

- **Suite E2E completa: 64/64 TODO VERDE** (`scripts/e2e-delivery-offer.mjs`, 819 líneas) contra la base remota y un dev server real. Creció de 44 a 64 verificaciones.
- **Casos nuevos (Fase 9.1), todos ejercitados contra la base real:** elección CASH → `ASSIGNED` con el método en `orders` y `deliveries`, snapshot de la tarifa, sin comprobante y con el cobro aún sin registrar; el método llega en la lista del repartidor (`deliveries(*)`) con los montos para calcular cuánto cobrar; la cadena hasta `ON_THE_WAY` no registra cobro; entregar un CASH sin el flag → 400 y el pedido SIGUE en camino; con `{cash_collected:true}` → `DELIVERED` + `cash_collected_at`; `complete_delivery` sobre un pedido ya entregado → 22000; un repartidor ajeno → 403 en la ruta y 42501 en la función; las dos CHECK cruzadas (`cash_collected_at` en un YAPE y `payment_voucher_path` en un CASH) → 23514; el override de ADMIN cierra un CASH sin exigir el flag y **no inventa un cobro**; el envoltorio `confirm_delivery_payment(uuid,text)` sigue dejando YAPE con su comprobante; un pedido YAPE IGNORA el flag; método inválido → 400 "Elige cómo quieres pagar"; sin `method` el default sigue siendo YAPE (por eso pide comprobante); CASH con ruta → 400 "no lleva comprobante"; cliente ajeno → 403 y anon → 42501; doble elección MEZCLADA → 409 sin cambiar el método; carrera CASH vs. retirar la oferta → estado consistente; y ni un pedido cancelado ni uno con la oferta expirada quedan con método.
- **Nota de diseño de la suite:** cada pedido del bloque de efectivo se cierra ANTES de la siguiente oferta, porque la regla "una entrega activa por repartidor" hace fallar cualquier oferta mientras quede una abierta. Cuando una prueba necesita DEJAR un pedido abierto a propósito, la oferta siguiente la hace el otro repartidor. Ese acoplamiento entre verificaciones es lo que produce fallos en cascada difíciles de leer, así que se evita a propósito.
- **La aserción del mensaje de método inválido fue un falso negativo del propio test:** se esperaba "Método de pago inválido" y el borde responde el texto del esquema, "Elige cómo quieres pagar" — deliberadamente, porque el cliente ve una elección entre dos opciones y no un identificador. La primera corrida marcó 1 fallo por eso; corregida la aserción, 64/64.
- **Checklist manual (9.2): NO ejecutado.** Necesita pantalla y dos sesiones (y el pedido explícito del usuario de no abrir pestañas de previsualización), así que queda listado para su validación: layout con 1/3/8 productos en los cuatro estados y en 360/428/768/1280 px; texto extremo (nombre de 80 caracteres y nota de 300 sin espacios) sin scroll horizontal; tiempo real (la oferta llega a la página abierta sin refrescar); efectivo punta a punta; Yape punta a punta (regresión del ciclo anterior); alternar métodos conservando el archivo; modo oscuro y lector de pantalla; pedido legacy sin chip ni errores; admin y restaurante sin cambios.

### Fase 10 — Despliegue, rollback y lo que queda abierto

**Orden de despliegue** (el del plan, con el estado real de cada paso para este repo):

| # | Paso | Estado |
|---|---|---|
| 1 | Fase 3 sola (layout) | Hecha en código; se despliega junto con el resto (es parte del mismo panel). |
| 2 | Migraciones 1.1 → 1.3 (`supabase db push`) | **Aplicadas** y verificadas contra la base remota (24/24 por RPC). |
| 3 | `types/database.ts` en el mismo commit que el código | Actualizado en el mismo árbol de trabajo. |
| 4 | Fases 2, 4, 5, 6 y 7 juntas | Hechas en código; **sin desplegar** (todo está sin commitear en `develop/fjp`). |
| 5 | QA de la Fase 9 con dos sesiones y un celular real | Suite automática en verde; la parte manual (9.2) está pendiente. |
| 6 | Migración de cierre: drop del envoltorio | **NO creada todavía** (ver abajo). |
| 7 | *(Opcional)* endurecer `orders_update_delivery_assigned` | **NO creada todavía** (ver abajo). |

**Por qué las dos migraciones de cierre no están en `supabase/migrations/` todavía.** El plan las condiciona (paso 6: "recién cuando ningún código llama `confirm_delivery_payment(uuid,text)`"; paso 7: "tras validar E2E"), y hoy se cumplen al revés de lo que parece: en ESTE repo ya no queda ningún llamador (solo la suite y un script de verificación), pero **la app desplegada sigue llamándola** hasta que este árbol se despliegue. Un archivo de migración sin aplicar en la carpeta es un peligro real: el próximo `supabase db push` lo aplica, y ese push ocurriría *antes* del despliegue del código — dejando la app en producción sin poder confirmar ningún pago. Por eso quedan acá, listas para pegar en el momento del despliegue:

```sql
-- 20261001100300_drop_confirm_delivery_payment_wrapper.sql
-- Cierra la ventana abierta por 20261001100100. Ningún código de este repo
-- llama ya a la firma de un argumento.
drop function if exists public.confirm_delivery_payment(uuid, text);

-- ROLLBACK (verbatim, por si hiciera falta volver atrás después del paso 6):
-- create or replace function public.confirm_delivery_payment(
--   p_order_id uuid,
--   p_voucher_path text
-- )
-- returns void
-- language sql
-- security definer
-- set search_path = public
-- as $$
--   select public.select_delivery_payment(p_order_id, 'YAPE', p_voucher_path)
-- $$;
-- revoke all on function public.confirm_delivery_payment(uuid, text) from public, anon;
-- grant execute on function public.confirm_delivery_payment(uuid, text) to authenticated;
```

El rollback es corto a propósito y no copia el cuerpo histórico (como sí hizo el drop del ciclo anterior): la lógica ya no vive en esa función sino en `select_delivery_payment`, que NO se borra, así que recrear el envoltorio es una línea que delega en algo que sigue existiendo.

```sql
-- 20261001100310_harden_orders_update_delivery_assigned.sql
-- Pass 7: `complete_delivery()` queda como ÚNICA puerta al estado entregado.
-- Definición vigente copiada de 20260928100200; el único cambio es que
-- 'DELIVERED' sale del `with check`. Un repartidor ya no puede marcar entregado
-- por PATCH directo saltándose la confirmación del cobro.
drop policy if exists "orders_update_delivery_assigned" on public.orders;
create policy "orders_update_delivery_assigned"
on public.orders for update
using (
  public.current_role() = 'DELIVERY'
  and id in (select public.current_delivery_order_ids())
)
with check (
  status in ('AWAITING_PAYMENT', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY')
);
```

Ningún camino legítimo del código lo necesita: el repartidor llega a DELIVERED por `complete_delivery()` (SECURITY DEFINER, no pasa por la policy) y los dos overrides de ADMIN usan `adminClient()` (service role, tampoco). **El motivo de esperar al despliegue es el mismo de siempre: la app hoy desplegada SÍ hace el UPDATE directo.**

**Rollback (10.2):** revertir el código de las Fases 2 a 7 es seguro — las columnas y funciones nuevas quedan sin uso y **el envoltorio mantiene viva la firma vieja**. Lo que NO se revierte es el `drop column payment_method` si ya hay pedidos en efectivo: se perdería quién debía cobrar y quién ya cobró (el mismo criterio que la Fase 1 aplicó al backfill).

**Consecuencia de D1 que hay que decidir fuera de este plan ("quién cobra qué"):** con efectivo el cliente le paga al repartidor la comida **y** el envío, así que por ese pedido el restaurante no recibe nada a través de la plataforma. La app muestra el monto correcto y lo atribuye a quien corresponde; **lo que sigue abierto es la liquidación** (¿el repartidor le entrega la comida al restaurante? ¿PideloYa le paga después?). Es un tema de operación y de negocio, no de código, y por eso está en "fuera de alcance" — pero se documenta acá porque afecta a un tercero que hoy no tiene pantalla donde verlo.

**Nit de copy pendiente (una migración de una línea cuando se toque `complete_delivery`):** su mensaje de rechazo dice "Confirma que cobraste **el envío** en efectivo antes de marcar la entrega", heredado de cuando el efectivo cubría solo el envío. Con D1 el repartidor cobra el pedido completo; el texto debería decir "el pedido". No se corrige ahora para no encadenar una migración de función por un string que la UI ya no muestra en el camino normal (el diálogo pregunta correctamente "¿Cobraste S/ X en efectivo?"); solo aparece si alguien esquiva la UI.

### Verificación final (Fases 6 a 10)

`npm run typecheck` ✅ · `npm run lint`: 8 warnings preexistentes, 0 errores ✅ · `npm run build` ✅ · suite E2E: **64/64 TODO VERDE** ✅ · contraste de los colores nuevos medido ✅ · dev server detenido tras la corrida.

---

## 2026-09-30 — Pagar al recibir con Yape o efectivo y conciliación con el restaurante (Fases 1 a 8)

Plan: `docs/plans/plan-pago-al-recibir-yape-o-efectivo-y-conciliacion-restaurante.md`. Cinco migraciones nuevas, todas aplicadas a la base remota en este orden:

1. `20261002100000_payment_timing_and_collection.sql` — expand: `deliveries.payment_timing/collected_at/collected_method/allows_pay_on_delivery` y `orders.payment_timing/restaurant_paid_at`, con backfill (Yape → UPFRONT, efectivo → ON_DELIVERY) y los CHECK nuevos.
2. `20261002100100_select_delivery_payment_v2.sql` — misma RPC, firma de 4 argumentos (DROP + CREATE: la firma cambia).
3. `20261002100200_complete_delivery_v2.sql` — `complete_delivery(p_order_id, p_cash_collected, p_collected_method)`.
4. `20261002100300_pickup_delivery.sql` — la constancia D6 (`orders.restaurant_paid_at`).
5. `20261002100400_profiles_accepts_pay_on_delivery.sql` (Fase 7) y `20261002100500_payment_incidents.sql` (Fase 8).

### Desviaciones del texto del plan (conscientes, documentadas en la migración)

- **Se REEMPLAZA el CHECK `deliveries_cash_collected_requires_cash_check`** por `deliveries_collected_check`. El plan lo pedía atado a `payment_method = 'CASH'`, pero D4 dice que el medio DECLARADO por el repartidor puede diferir del anunciado; atarlo al anuncio haría imposible registrar el desvío que el propio D4 autoriza. La simplificación del plan ("no hace falta `collected_method`") era incompatible con su propia decisión D4.
- **`complete_delivery` no registra nada en UPFRONT** ni cuando vienen los flags legacy: el primer intento derivaba `collected_at` también para UPFRONT y violaba el CHECK nuevo (`23514`). Se reaplicó con `migration repair --status reverted` + `drop function` + `db push --include-all`.
- **Fase 7.2: `create or replace` y no un archivo aparte.** `offer_delivery` mantiene SU MISMA FIRMA, así que el reemplazo es invisible para la app desplegada; se repitieron los `revoke/grant` para que el archivo sea autosuficiente.

### Fase 7 — el snapshot, no una lectura en vivo

El flag vive en `profiles.accepts_pay_on_delivery` pero **se copia a `deliveries.allows_pay_on_delivery` al ofertar**. El cliente puede tardar en decidir y no puede ver retirarse una promesa que ya tenía delante; y el repartidor tampoco puede quedar obligado por lo que era su perfil ayer. Consecuencia práctica: los reportes de "¿por qué este pedido dice que no acepto pago al recibir?" se contestan mirando la Entrega, no el Perfil.

El repartidor sigue expuesto al cliente que no paga: el interruptor le devuelve la decisión, no elimina el riesgo (límite de adelanto, reputación del cliente y bloqueo tras incidencias quedan fuera de este plan).

### Fase 8 — incidencias: la nota de resolución vive en la auditoría

`payment_incidents` no tiene columna de nota de resolución (el plan no la definía). El admin resuelve con `resolved_at/resolved_by` y **la nota interna viaja en `admin_audit_log.metadata.note`**: la tabla es la bandeja, la bitácora es la auditoría. Si algún día hace falta mostrar la nota en el panel, el dato ya está donde corresponde.

- **Idempotencia real, no solo un chequeo previo:** índice único parcial `(order_id, kind, reported_by) where resolved_at is null`. Sin él, dos toques en el botón de la puerta crean dos filas; la función usa `on conflict (…) where resolved_at is null do nothing` y devuelve la existente. Tras resolver, el mismo hecho puede volver a reportarse (y debe poder).
- **El rol del reportante NO se acepta del cliente:** se resuelve contra el pedido (`customer_id`, `deliveries.delivery_person_id`, `restaurant_members` vía `order_items.restaurant_id`) y cada rol tiene su matriz de tipos (repartidor: los tres del diálogo; restaurante: `RESTAURANT_NOT_PAID`; cliente: `AMOUNT_MISMATCH`/`OTHER`).
- **D8 verificado en la suite:** reportar NO cambia el estado del pedido (el repartidor que no pudo cobrar sigue en `ON_THE_WAY` y puede reintentar).
- **`/admin/pagos` usa `?status=`** (el mismo parámetro de las otras tablas) para reutilizar `AdminTableShell`, `StatusFilterSelect` y el export CSV sin inventar un eje. La paginación es EN MEMORIA: `mismatch` compara dos columnas entre sí y PostgREST no puede filtrar eso, así que la fila se descarta en JS; el tope (`PAYMENT_REVIEW_LIMIT = 200`) se dice en la UI en vez de fingir que la tabla está completa.
- **`ResolveIncidentDialog` en lugar de `ConfirmDialog`:** el contrato de `ConfirmDialog` no acepta campos y la nota es el dato que justifica la resolución.
- **La vista de integridad NO está vacía en la base de pruebas, y está bien:** el override de ADMIN puede cerrar un ON_DELIVERY sin exigir el cobro (limitación conocida y deliberada, ya cubierta por la suite E2E). Esas filas aparecen en el filtro `integrity` exactamente como debe: la vista existe para que el admin VEA el patrón, no para fingir que el caso no ocurre.

### Limpieza de residuo de datos de prueba

`verify-timing-phase1.mjs` quedaba con 1 FAIL por **8 filas imposibles** (`payment_method='YAPE'`, `payment_timing='UPFRONT'` y `cash_collected_at` poblado) creadas por los `UPDATE` crudos que la suite E2E hacía ANTES de que se actualizara su aserción. No se backfillearon (un `collected_at` en UPFRONT viola el CHECK, que es justamente el invariante): se puso `cash_collected_at = null`, que es el estado correcto de un UPFRONT. La suite queda **32/32 TODO VERDE**.

### Verificación (Fases 7 y 8)

`npm run typecheck` ✅ · `npm run lint`: 8 warnings preexistentes, 0 errores ✅ (bajó de 9: el aviso de `hasQr` sin uso se resolvió implementando el aviso "Súbelo en tu perfil", que el plan pedía y faltaba) · `npm run build` ✅ (con `/admin/pagos` y `/api/admin/export` en el árbol) · `scripts/e2e-delivery-offer.mjs`: **64/64 TODO VERDE** ✅ · `scripts/verify-payment-api-phase2.mjs`: **12/12 TODO VERDE** ✅ · `scripts/verify-timing-phase1.mjs`: **32/32 TODO VERDE** (tras la limpieza) ✅ · `scripts/verify-payment-incidents-phase8.mjs` (nuevo): **24/24 TODO VERDE** — snapshot inmutable de Fase 7, rechazo de ON_DELIVERY con snapshot apagado, idempotencia, matriz rol/tipo, nota > 500, anon → `42501`, RLS de lectura (admin ve todo, repartidor solo lo suyo) y D8. El script limpia todo lo que crea y restaura los flags de los repartidores E2E. Las cuatro consultas de `/admin/pagos` (el hint de FK `payment_incidents_reported_by_fkey`, los embeds `deliveries(profiles)` y `orders!inner(...)`) se probaron además contra la API con una sesión ADMIN real: el hint equivocado o el `!inner` mal puesto fallan en runtime aunque el typecheck pase.

### Pendiente antes del despliegue (Fase 12 contract)

`docs/plans/…` Fase 12: drop del envoltorio `confirm_delivery_payment`, endurecer `orders_update_delivery_assigned` quitando DELIVERED y PICKED_UP, y quitar el dual-write de `cash_collected_at`. **Ninguno de esos archivos debe estar en `supabase/migrations/` antes del deploy** (la app desplegada todavía usa las firmas viejas). Las Fases 9 (privacidad/términos), 10 (accesibilidad medida) y 11 (checklist manual) siguen abiertas.

## 2026-09-30 — Pagar al recibir: cierre del plan (Fases 9 a 12)

Cierra el mismo plan (`docs/plans/plan-pago-al-recibir-yape-o-efectivo-y-conciliacion-restaurante.md`). Lo de las Fases 1–8 queda arriba; esta entrada es lo que se decidió en el cierre.

### Fase 9 — textos legales: funcionalmente completos, legalmente pendientes (D10)

- **Privacidad:** los datos del pago al repartidor (método, timing, cobro declarado, constancia al restaurante, incidencias) entran en "Datos que recopilamos" y en la finalidad de "conciliación y resolución de disputas", y se documentan como **parte del registro de la transacción** (5 años, sobrevive a la anonimización porque no identifican por sí solos). También se agregó la finalidad de mostrar al restaurante si el repartidor pagó o quedó debiendo (D6).
- **Términos, nueva sección 6 "Pago del pedido y del envío":** pago de comida vs. envío al repartidor (D1), el adelanto obliga al cliente al total al recibir, el desvío de medio declarado es válido (D4), el toggle es voluntad del repartidor (D7), la incidencia es el canal de reclamo (D8), PideloYa **no procesa ni custodia dinero**, y comprobantes/atestaciones son **declaración de las partes, no verificación bancaria**. La consecuencia de no pagar se redactó como "puede suspenderse la cuenta" (facultad, no obligación automática).
- **D10 sigue abierto por diseño:** quién emite la boleta y si el repartidor es comprador o mandatario no se decide en código. Ambos textos llevan una nota interna de que no sustituyen revisión legal antes de un lanzamiento comercial.

### Fase 10 — accesibilidad: medir, no estimar

- **El foco lima de la marca FALLA el contraste sobre fondos claros** (medido: **1.15:1** sobre blanco, 1.08:1 sobre `amber-100/60`; el umbral de 1.4.11 es 3:1). En vez de cambiar el color de marca global, se agregó la utilidad `focus-halo` en `globals.css` (halo `black/45` = 3.35:1 en claro, `white/60` = 7.06:1 en oscuro) y se aplica con `outline-offset-2` en los tres grupos de radios nuevos (`PaymentMethodChoice`, `CollectMethodChoice`, `PaymentIncidentDialog`) y el checkbox de atestación. Offset 2 y no 1: con 1 px el halo queda tapado por el outline.
- Lo demás midió bien y quedó: chips `amber-900/amber-100` 8.15:1, `emerald-900/emerald-100` 8.57:1, borde de bloque de cobro `amber-600` 3.07:1, radio `black/45` 3.35:1, oscuro todo ≥ 4.49:1. **El foco del checkbox nativo no se puede pintar con `peer`**: se le pone el halo directo (`focus-visible:focus-halo`).
- **Regiones vivas donde el cambio no lo provoca la pantalla que lee:** chip "Cobrar…→Cobrado" en la lista del repartidor y la constancia "Cobrado el…" en el detalle (ambos `role="status" aria-live="polite"`). El `sr-only` huérfano de `PaymentMethodChoice` (duplicaba el copy del panel de abajo) se eliminó; no fue reemplazado por nada.
- **La degradación sin QR ahora existe en los dos lados:** el botón del detalle del repartidor ya no desaparece cuando falta el QR (pasa a "Mostrar mi número de Yape"; sin QR **ni** número, el diálogo lo dice en vez de prometer "el número de abajo"), y el detalle recupera la fila copiable del número propio con el aviso "Súbelo en tu perfil" (hueco de la Fase 3.2 que quedó pendiente del ciclo anterior). QR a 360 px: `aspect-square w-72 max-w-full` en los dos diálogos (con `h-72 w-72` fijos se salía del padding).
- **D1 cerrado:** `YapePaymentPanel` ahora recibe `amount` (comida + envío) y el diálogo del QR dice "transfiere S/ X: comida + envío"; la prop `fee` desapareció (quedaba del ciclo anterior y era el único monto inconsistente que faltaba).

### Fase 11 — la suite E2E creció a 72 checks y casi todo el trabajo fue de coreografía

- Seis pasos nuevos de punta a punta por la API v1 (la misma puerta de la UI): YAPE+ON_DELIVERY sin comprobante → ASSIGNED; guard de entrega sin declaración; cobro declarado Yape vs. anunciado Yape; guards de la elección (voucher en ON_DELIVERY, CASH+UPFRONT); pickup con `restaurant_paid` (D6); Fase 7 por la API con snapshot y restauración del flag.
- **El guard de "una sola oferta o entrega activa" convive mal con suites largas en la MISMA cuenta:** `cash4` queda a propósito esperando elección al final de su grupo y bloquea todas las ofertas siguientes; y dentro del grupo nuevo, dejar `od1` en ASSIGNED mientras se ofertaba `od2` daba el mismo 409. La solución fue de orden, no de permisos: cancelar/entregar cada pedido antes de ofertar el siguiente (y un paso de limpieza de estado al arrancar: ver abajo).
- **Un fixture corrompido por la propia suite es peor que un fallo:** el paso de Fase 7 apagaba `accepts_pay_on_delivery` y restauraba AL FINAL; un `throw` intermedio saltaba fuera y dejaba el flag apagado para TODAS las suites siguientes (fue una corrida con 22 fallos en cascada y el mensaje engañoso de "Este repartidor solo acepta pago por adelantado"). Ahora se restaura ANTES de las aserciones, y existe un script de limpieza que re-encera flags, cancela pedidos E2E vivos y borra entregas sin pago confirmado.
- Resultado: **72/72 TODO VERDE** (dos pasadas limpias consecutivas), sin tocar nada de la app para que pasara.

### Fase 12 — la migración contract vive en docs/, no en migrations/
- `docs/db-contract/20261002100600_drop_legacy_payment_columns.sql`: drop de la firma `complete_delivery(uuid, boolean)`, CHECK viejo idempotente, `drop column cash_collected_at`, firma unificada `(uuid, text)` y endurecimiento de `orders_update_delivery_assigned` (quita DELIVERED del `with check`; PICKED_UP se conserva porque `pickup_delivery()` es SECURITY DEFINER y no atraviesa la policy). Con checklist de requisitos y ROLLBACK verbatim del cuerpo v2, mismo estilo de `20260930100400_drop_legacy_offer_functions.sql`.
- **El acompañante de código se aplicó YA en este ciclo** (no puede esperar al deploy): `advanceOrderStatus` pierde `cashCollected`/`p_cash_collected` y manda `p_collected_method` (default `'CASH'` si no declaran el medio); las dos rutas API pierden el alias `cash_collected`; el select del detalle del repartidor deja de leer `cash_collected_at`; `cashAmountDue` eliminada. **Mientras la base siga en la v2 (3 args), todo sigue funcionando**: la firma `(uuid, text)` no es alcanzable con `(uuid, boolean, text)` posicional… PERO PostgREST manda por NOMBRE, no por posición: los llamadores con `p_cash_collected` en el body fallarían en la base contract. Por eso el orden del plan (código antes que contract) y por eso la suite se mantiene verde hoy.
- La suite E2E ya ejercita el cuerpo nuevo (`{ collected: true, collected_method: 'CASH' }` en vez del alias), de modo que cuando la migración contract se aplique no haya que tocarla.

### Verificación del cierre

`npm run typecheck` ✅ · `npm run lint`: 9 warnings preexistentes (0 errores) ✅ · `e2e-delivery-offer.mjs` **72/72 TODO VERDE** ✅ · `verify-timing-phase1.mjs` **31 PASS + resumen** ✅ · `verify-payment-api-phase2.mjs` **12/12** ✅ · `verify-payment-incidents-phase8.mjs` **24/24** ✅. `npm run build` pendiente de la pasada final.

### Aprendizaje transversal para próximas suites

1. Toda mutación de fixture global (flags de perfil, filas) se restaura ANTES de las aserciones del paso, no después.
2. Un guard de exclusividad ("una sola oferta activa") se trata como recurso que la SUITE administra: liberar antes del siguiente caso.
3. Guardar un script de limpieza de estado junto a las suites: recupera una corrida abortada en minutos.
4. `grep` del contrato tras cada cierre: alias deprecados y columnas dual-write sobreviven al plan si nadie los caza (sobrevivieron dos ciclos).

