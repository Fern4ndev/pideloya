# Checklist manual de QA — Perfil de repartidor: foto, QR de Yape y seguridad (Fases 1–7)

Ejecutar antes de cada release que toque estas rutas: `app/repartidor/perfil/page.tsx`, `components/features/profile/*`, `components/ui/password-input.tsx`, `components/features/restaurants/ImageUploader.tsx`, `lib/actions/profile.ts`, `lib/admin/anonymize-profile.ts`, `components/features/admin/Delivery*.tsx`, `app/admin/repartidores/page.tsx`, `app/(public)/privacidad/page.tsx`, `supabase/migrations/20260928000000_profiles_delivery_media.sql`.

**Entorno:** `supabase start` + app en dev, o un proyecto de staging. Necesitas sesión de **REPARTIDOR**, de **ADMIN** y de **CLIENTE**, más acceso al **dashboard de ImageKit** (o a su API `files`) para comprobar que los archivos se borran de verdad. Marca cada caso solo si ves el resultado esperado en la UI **y** en la base.

> **Prerrequisito bloqueante.** La migración `20260928000000_profiles_delivery_media.sql` debe estar aplicada. Sin ella, `/repartidor/perfil` no carga (`column does not exist`) y la anonimización de cuentas con historial desde `/admin/usuarios` falla. Si algún caso falla con "column does not exist", no estás ante un bug de la UI: falta aplicar la migración.

---

## Preparación de datos de prueba

- [ ] **P1.** Repartidor **R1** activo y aprobado, sin foto ni QR cargados. Repartidor **R2** con una entrega entregada (fila en `deliveries` con `delivered_at`) y con foto **y** QR cargados. Repartidor **R3** con un valor de vehículo raro a propósito (`update profiles set vehicle_type = 'Cuatrimoto' where id = '<uuid>'`). Cliente **C1**. Un restaurante **X** con logo y al menos un producto con imagen (para los casos de regresión).
- [ ] **P2.** Anota en una nota los `fileId` de las imágenes de X (`restaurants.logo_file_id`, `products.image_file_id`) para poder confirmar después que no se tocaron.

## Fase 1 — Modelo de datos

- [ ] **F1.1** Las 4 columnas existen y son nullable: `select column_name, is_nullable from information_schema.columns where table_name = 'profiles' and column_name like '%avatar%' or column_name like 'yape%';`
- [ ] **F1.2 (seguridad — comprobar, no asumir).** Con la sesión de **R1**, intentar que R1 se cambie a sí mismo el rol. Desde DevTools → Network → *Copy as cURL* de cualquier petición a `/rest/v1/profiles` de R1 sirve; el objetivo es este PATCH:
  ```bash
  curl -X PATCH "$SUPABASE_URL/rest/v1/profiles?id=eq.<uuid de R1>" \
    -H "apikey: <anon key>" -H "Authorization: Bearer <access_token de R1>" \
    -H "Content-Type: application/json" -d '{"role":"ADMIN"}'
  ```
  Debe responder **403 / permission denied**. Repetir con `{"is_active":true}`. **Si en cambio responde 200 y R1 queda con `role = 'ADMIN'`, es un hallazgo crítico** (cualquier usuario podría promoverse a admin): ver la nota al final de este documento. No es un fallo de este plan, pero es lo primero que hay que resolver si aparece.

## Fase 2 — Componente de subida compartido (`ImageUploader`)

- [ ] **F2.1 (regresión)** En `/restaurante/negocio`, el logo sigue siendo un **cuadrado redondeado** (`rounded-2xl`), no un círculo, y se ve exactamente igual que antes. Lo mismo para la foto de un producto en su formulario.
- [ ] **F2.2 (regresión)** En logo/producto, el botón "Quitar" sigue apareciendo **solo al pasar el mouse**; no está visible permanentemente.
- [ ] **F2.3** En la foto de perfil (círculo), el botón "Quitar" se ve **completo** (no recortado por el borde). Verifícalo en las tres anchuras: móvil (375px), tablet y escritorio.
- [ ] **F2.4** En un **celular real o con emulación táctil** (DevTools → dispositivo, sin puntero fino), el botón "Quitar" de la foto de perfil está **visible sin hover** y se puede tocar.
- [ ] **F2.5** En escritorio, el botón "Quitar" de la foto de perfil aparece al pasar el mouse, y también al llegar con **Tab** desde el teclado.
- [ ] **F2.6** Arrastrar una imagen fuera del recuadro (no soltarla) no rompe nada y el estado de arrastre vuelve a la normalidad.

## Fase 3 — Server Actions de avatar y QR

- [ ] **F3.1 Primera subida.** Subir la foto de perfil de R1. Se ve el preview circular, toast "Foto de perfil actualizada". En `profiles`, `avatar_url` y `avatar_file_id` de R1 quedan poblados.
- [ ] **F3.2 Reemplazo sin huérfanos.** Anotar el `avatar_file_id` anterior, subir otra foto. En `profiles` el `avatar_file_id` cambió **y el archivo anterior ya no existe en ImageKit** (buscarlo por su fileId en el dashboard).
- [ ] **F3.3 Quitar la foto.** `avatar_url` y `avatar_file_id` quedan en `NULL`, el archivo desaparece de ImageKit, el recuadro vuelve a "Subir foto" y aparece el toast "Foto de perfil eliminada".
- [ ] **F3.4 QR — los mismos tres casos.** Repetir F3.1, F3.2 y F3.3 para el QR de Yape (`yape_qr_url` / `yape_qr_file_id`), verificando el borrado del archivo anterior en ImageKit.
- [ ] **F3.5 El QR no se recorta.** Subir una **foto rectangular** del QR (por ejemplo una captura de pantalla con márgenes). El preview debe mostrar la imagen **completa** con fondo alrededor (no recortada al centro) y el QR debe seguir siendo escaneable desde la pantalla.
- [ ] **F3.6 Guarda de rol (el caso de seguridad más importante).** Con la sesión de R1, subir un QR y capturar la petición POST de la Server Action (DevTools → Network → *Copy as cURL*). Cambiar la cookie de sesión por la de **C1** (cliente) y re-ejecutar el cURL. Resultado esperado: la respuesta contiene el error **"Solo los repartidores pueden subir un QR de Yape"** y el `yape_qr_url` de C1 sigue en `NULL`. Si C1 logra guardar el QR, es un bug crítico.
- [ ] **F3.7 Payload inválido.** Re-ejecutar el cURL de F3.6 con R1 pero reemplazando la `url` por `javascript:alert(1)` (y por una cadena vacía): la acción debe rechazar con "URL de imagen inválida" y **no** escribir nada en `profiles`.
- [ ] **F3.8 Sin sesión.** Repetir el cURL eliminando la cookie de sesión: la respuesta debe ser "No autenticado" y no debe escribir nada.

## Fase 4 — Componentes de UI

- [ ] **F4.1 Mostrar/ocultar contraseña.** En "Seguridad", el ícono de ojo alterna entre texto visible y oculto **en los dos campos** de forma independiente.
- [ ] **F4.2 Teclado y accesibilidad.** Con **Tab** se llega al botón de mostrar/ocultar (no está fuera del orden de tabulación) y se ve el outline de foco. El `aria-label` cambia entre "Mostrar contraseña" y "Ocultar contraseña" (inspeccionar con el inspector).
- [ ] **F4.3 Validaciones.** Menos de 8 caracteres → "La contraseña debe tener al menos 8 caracteres". Contraseñas distintas → "Las contraseñas no coinciden". Ambas se ven junto a los campos (`role="alert"`). Con datos válidos, la contraseña cambia, el formulario se limpia y aparece "Contraseña actualizada.".
- [ ] **F4.4 El preview no miente si falla el guardado.** En staging/local, inducir un fallo en el guardado **sin romper la carga de la página** (no sirve renombrar la columna: la página la selecciona). Con un trigger temporal:
  ```sql
  create or replace function public.qa_fail_avatar() returns trigger language plpgsql as $$
  begin
    if new.avatar_url is distinct from old.avatar_url then
      raise exception 'QA: fallo inducido';
    end if;
    return new;
  end $$;
  create trigger qa_fail_avatar before update on public.profiles
    for each row execute function public.qa_fail_avatar();
  ```
  Subir una foto: ImageKit la acepta, el guardado en la base falla, y se debe ver (a) el toast de error y (b) el recuadro de vuelta en la foto **anterior**, no en la nueva. **Restaurar siempre al terminar** (si se queda, bloquea las subidas reales):
  ```sql
  drop trigger qa_fail_avatar on public.profiles;
  drop function public.qa_fail_avatar();
  ```
- [ ] **F4.5 Errores de red.** DevTools → Network → *Offline* y luego intentar subir una foto: se ve el error dentro del uploader (junto al campo) y el preview vuelve al valor previo. No queda una foto "fantasma" en pantalla.

## Fase 5 — Página del perfil (el pedido central)

- [ ] **F5.1** `/repartidor/perfil` muestra **cuatro tarjetas** con título e ícono: Foto de perfil, Datos personales, Cobro por Yape, Seguridad. El cambio de contraseña **ya no** está al final del formulario de datos personales.
- [ ] **F5.2 Mobile (375px).** Ninguna tarjeta genera scroll horizontal; el uploader circular se ve bien recortado y el texto de ayuda no se desborda.
- [ ] **F5.3 Cargas independientes.** Con la red frenada (DevTools → *Slow 3G*), iniciar la subida del avatar y, mientras avanza, iniciar la del QR: la segunda no espera a la primera y cada una tiene su propia barra de progreso.
- [ ] **F5.4 Orden de foco lógico.** Recorriendo con **Tab**: foto de perfil → nombre → celular → documento (deshabilitado, se salta) → vehículo → QR de Yape → contraseña → botón de actualizar contraseña.
- [ ] **F5.5 Persistencia real.** Tras subir foto y QR, recargar con F5 y con navegación dura: siguen mostrándose. Abrir el perfil en otro dispositivo con la misma cuenta: también.
- [ ] **F5.6 Regresión de los otros roles (crítico).** Abrir `/cliente/perfil`, `/restaurante/perfil` y `/admin/perfil`: el formulario de contraseña sigue **dentro** del formulario de datos personales, separado por una línea (`border-t`), y no aparece ninguna tarjeta nueva ni el círculo de avatar. El espaciado del bloque de contraseña no cambió.

## Fase 6 — Ciclo de vida de las imágenes (Ley 29733)

- [ ] **F6.1 Anonimización completa.** Con la sesión de ADMIN, "eliminar" (Desactivar y anonimizar) la cuenta de **R2**, que tiene entregas y foto + QR cargados. Verificar:
  - [ ] `profiles` de R2: `avatar_url`, `avatar_file_id`, `yape_qr_url`, `yape_qr_file_id` en `NULL`, junto con `full_name`, `phone`, `email`, `document_*`; `is_active = false`; `anonymized_at` poblado.
  - [ ] **Ambos archivos ya no existen en ImageKit** (antes de este cambio quedaban accesibles para siempre por su URL pública — es el caso más importante de esta fase).
  - [ ] R2 no puede iniciar sesión (ban permanente) y su historial de entregas sigue intacto.
- [ ] **F6.2 Idempotencia.** Reintentar la eliminación de R2 (o llamar dos veces al flujo): no debe reescribirse `anonymized_at` ni romper nada.
- [ ] **F6.3 Cuenta sin imágenes.** Eliminar una cuenta con historial que **no** tenía foto ni QR: el flujo termina igual (no falla por archivos inexistentes).
- [ ] **F6.4 Panel de admin.** En `/admin/repartidores` la tabla muestra la **miniatura** del avatar junto al nombre; R2 (anonimizado) muestra su inicial, no una imagen rota. En el diálogo de edición de un repartidor con foto, la foto se ve en grande y **en modo solo lectura**.
- [ ] **F6.5 Privacidad de la credencial de cobro.** El **QR de Yape no** aparece en ningún lugar del panel de admin (ni en la tabla, ni en el diálogo, ni en el CSV de `/api/admin/export`). Es una credencial de pago: mínimo privilegio.
- [ ] **F6.6 URL rota.** Poner a mano un `avatar_url` que no resuelva (`https://ik.imagekit.io/no-existe.jpg`) y cargar `/admin/repartidores`: se ve la **inicial** del repartidor, no un ícono de imagen rota.
- [ ] **F6.7 Privacidad.** `/privacidad`: la sección 2 incluye la viñeta de **imágenes** (foto de perfil y QR de Yape, opcional, solo repartidores); la sección 6 dice explícitamente que las imágenes se eliminan del proveedor de almacenamiento; y la fecha de actualización coincide con la del release.
- [ ] **F6.8 No se rompió lo anterior.** Eliminar el restaurante X (caso de la Fase 4 del plan de eliminación de cuentas): su logo y las imágenes de sus productos se siguen borrando de ImageKit (comportamiento previo intacto).

## Fase 7 — Vehículo editable

- [ ] **F7.1** En "Datos personales" aparece el selector **Vehículo** con Moto, Bicicleta, Auto y A pie. Al elegir otro valor y guardar, `profiles.vehicle_type` cambia y el toast de guardado aparece.
- [ ] **F7.2 Valor no estándar.** Con **R3** (`vehicle_type = 'Cuatrimoto'`): el selector **muestra "Cuatrimoto"** (como opción extra), no un campo vacío. Guardar un cambio de **teléfono** sin tocar el vehículo debe **conservar** "Cuatrimoto" (el caso que evita el borrado silencioso).
- [ ] **F7.3** El selector no permite escribir texto libre: solo se elige entre las opciones.
- [ ] **F7.4** Un repartidor sin vehículo definido ve el placeholder "Selecciona tu vehículo".

## Cierre

- [ ] **C1.** `pnpm run typecheck` sin errores. `pnpm run lint` sin errores **nuevos** en los archivos del plan (el proyecto arrastra errores previos ajenos a este cambio: comparar contra la línea base, no contra cero).
- [ ] **C2.** Migración `20260928000000_profiles_delivery_media.sql` aplicada en el entorno y confirmada con F1.1. Es idempotente (`add column if not exists`), puede re-ejecutarse.
- [ ] **C3.** Sin huérfanos: tras la sesión de QA, no quedan archivos en `/repartidores/**` de ImageKit que no correspondan a un `avatar_file_id` o `yape_qr_file_id` vivo en `profiles`. Revisar `select count(*) from profiles where avatar_url is null and avatar_file_id is not null` → debe ser 0 (misma comprobación para `yape_qr_*`).
- [ ] **C4.** Ninguna cuenta anonimizada conserva `avatar_url` o `yape_qr_url`: `select count(*) from profiles where anonymized_at is not null and (avatar_url is not null or yape_qr_url is not null)` → debe ser 0.
- [ ] **C5.** `/repartidor/perfil` carga sin errores en consola del navegador ni en el log del servidor.

---

## Orden de despliegue (Fase 9)

El orden no es negociable en los dos primeros pasos: el código nuevo **escribe y lee** columnas que no existen hasta que se aplica la migración.

| # | Paso | Por qué en este orden |
|---|---|---|
| 1 | **Aplicar la migración** `20260928000000_profiles_delivery_media.sql` (`supabase db push`) | Aditiva, sin backfill y sin bloqueos. Si se despliega código antes, `/repartidor/perfil` falla y la anonimización de cuentas con historial se rompe. |
| 2 | **Verificar las columnas** (caso F1.1) | Confirmar antes de desplegar código, no después. |
| 3 | **Desplegar el paquete completo de código** (`types/database.ts` + fases 2 a 7) | `types/database.ts` debe viajar en el **mismo** despliegue que la migración (los tipos ya declaran las columnas). |
| 4 | **Ejecutar este checklist** (F2.x → F7.x) | La verificación es manual y necesita las tres sesiones. |
| 5 | **Cierre C1–C5** | C4 es la comprobación de cumplimiento: ninguna cuenta anonimizada puede conservar foto ni QR. |

**Lo que NO se puede separar:** las fases 5 y 6 tienen que ir en el **mismo release**. Si se desplegara la subida de fotos sin la limpieza en la anonimización, cualquier cuenta de repartidor anonimizada en ese intervalo quedaría con su foto (y su QR de pago) públicamente accesibles por su URL de ImageKit, sin forma de recuperar el `fileId` para limpiarlas después: el `fileId` se habría puesto en `NULL` sin haber borrado el archivo. Ese es el único punto de este plan con daño irreversible.

**Rollback.** El código se puede revertir al commit anterior sin tocar la base: las 4 columnas se quedan, nullable y sin uso, y no afectan a nada más. **No** revertir la migración (`drop column`) si ya se han subido fotos: se perderían las referencias a los archivos de ImageKit y esos archivos quedarían huérfanos e irrecuperables desde la app.

**Después del despliegue.** Actualizar `PROJECT-DOC.md`: su tabla de migraciones y sus listados de componentes están desactualizados desde antes de este cambio (arrastra varias migraciones sin documentar), así que conviene ponerlos al día de una vez en lugar de añadir solo la entrada nueva.

---

## Nota de seguridad — privilegios a nivel de columna

La migración `20260830062645_profile_column_security.sql` intenta impedir que un usuario se cambie su propio `role` o `is_active` con `revoke update (role, is_active) on public.profiles from authenticated`. **Ese revoke solo surte efecto si el privilegio de `authenticated` sobre la tabla es a nivel de columna.**

Según la [documentación de Supabase](https://supabase.com/docs/guides/database/postgres/column-level-security): "You can have both types of privileges on the same table. If you have both, and you revoke the column-level privilege, **the table-level privilege will still be in effect**", y el privilegio por defecto es a nivel de tabla (`GRANT ALL ON ALL TABLES`). Si este proyecto tiene el grant por defecto, el revoke es un **no-op**: la RLS `profiles_update_own` permite a cualquier usuario editar su propia fila, y nada le impediría poner `role = 'ADMIN'`. Lo mismo aplica al `revoke update (email)` de `20260923130000_profiles_email.sql`.

El caso **F1.2** es la comprobación definitiva y no se pudo ejecutar al escribir este checklist (requiere una sesión de usuario real contra la base). Si falla, la forma correcta de cerrarlo es revocar el privilegio de tabla y concederlo columna por columna — solo las que la aplicación escribe con la sesión del usuario:

```sql
revoke update on table public.profiles from authenticated;
grant update (
  full_name, phone, document_type, document_number, vehicle_type,
  avatar_url, avatar_file_id, yape_qr_url, yape_qr_file_id
) on table public.profiles to authenticated;
```

(No incluir `email`, `role`, `is_active` ni `anonymized_at`: esas las escriben las Server Actions de admin con `service_role`, que no pasa por estos privilegios.)
