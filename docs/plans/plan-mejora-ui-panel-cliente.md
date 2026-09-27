# Plan de Implementación — Rediseño Visual del Panel de Cliente (PideloYa)

**Proyecto:** PideloYa
**Alcance:** Únicamente la zona `/cliente` (home, carta de restaurante, carrito, pedidos, direcciones, perfil, favoritos) y los componentes que consume (`components/features/cliente-home`, `components/features/cart`, `components/features/orders`, `components/features/addresses`, `components/features/products`, `components/features/profile`, `components/layout/CustomerHeader.tsx`). No toca `/admin`, `/restaurante`, `/repartidor` ni la landing pública — esos ya tienen su propio lenguaje visual (dark, lime/coral/violet) definido en `design-system/pideloya/MASTER.md`.
**Autor del diagnóstico:** revisión de diseño estilo Apple/Vercel sobre el código real del panel de cliente.
**Principio rector:** cero archivos nuevos salvo que sea estrictamente necesario. Este plan está pensado para ejecutarse casi en su totalidad **editando archivos que ya existen**; cualquier archivo nuevo que aparezca está marcado explícitamente y justificado como excepción, nunca como preferencia estética.

> **Nota sobre las skills solicitadas:** se pidió aplicar `ui-ux-pro-max` y `vercel-react-best-practices` desde `C:\Users\ferna\.agents\skills`. Esa ruta vive en tu máquina local; el entorno donde yo ejecuto es un sandbox aislado sin acceso a tu filesystem, así que no pude leer esos `SKILL.md` directamente (mismo caso ya documentado en `docs/plans/plan-pulido-paneles-restaurante-delivery.md`, línea de nota al inicio). Este plan aplica los mismos principios que ese tipo de skills normalmente encapsula — un acento de color por función, jerarquía tipográfica clara, tokens de diseño reutilizables en vez de valores mágicos repetidos, estados vacíos/carga tratados como parte del diseño (no como afterthought), accesibilidad (contraste, foco visible, `prefers-reduced-motion`), y evitar abstracciones prematuras — y los cito en cada fase para que puedas verificarlos contra tus skills si difieren.

---

## Diagnóstico (contexto, sin cambios de código)

Revisando el código real de `/cliente` hoy:

1. **El panel de cliente ya tiene buenas semillas** (glass cards con `backdrop-blur-xl`, gradientes `from-brand-400 to-brand-600`, `rounded-3xl`, animación de carrito con `translate`/`shadow`), pero están aplicadas de forma **inconsistente**: algunos componentes usan `rounded-3xl` + glass (`AddressCard`, `CartClient`, `ClienteHomeClient`), otros usan `rounded-xl` plano sin blur ni sombra (`ProductOrderCard`, `OrderDetailsDialog`), y el header (`CustomerHeader`) mezcla ambos lenguajes en la misma pantalla.
2. **La paleta vive solo en `brand-*` (naranja)** más `coral` puntual en `CartBar`. Comparado con la landing pública, que ya definió una paleta con propósito claro (`lime` = interactivo/CTA, `coral` = acento secundario, `violet` = atmósfera), el panel de cliente no tiene esa disciplina: el naranja se usa para CTA, para acentos, para badges y para hover, todo a la vez — sin jerarquía.
3. **No hay tokens de sombra/espaciado propios del panel de cliente** — cada componente inventa su propia sombra (`shadow-sm`, `shadow-lg`, `shadow-brand-500/30`, `shadow-xl`) y su propio radio (`rounded-xl`, `rounded-2xl`, `rounded-3xl`) sin una escala documentada, a diferencia de `design-system/pideloya/MASTER.md`, que sí define `--shadow-sm/md/lg/xl` y una escala de espaciado (pero para la landing, no para el panel de cliente).
4. **Estados vacíos y de carga están resueltos de tres formas distintas**: bloques `border-dashed` hechos a mano (`AddressesPage`, `OrdersListClient`, `ClienteHomeClient`), el componente estándar `EmptyState` (usado en `admin`/`restaurante`/`repartidor` pero **no** en `cliente`), y ausencia total de skeleton en varias vistas (`CartClient`, `ProfileForm`).
5. **Micro-interacciones existen pero son mínimas**: `justAdded` con `setTimeout` (`FeaturedProductCard`, `ProductOrderCard`) sin transición de entrada/salida; el carrito flotante (`CartBar`) aparece/desaparece sin animación; el timeline de pedido (`OrderStatusTimeline`) es funcional pero visualmente plano (círculos sólidos sin conexión progresiva).
6. **No hay soporte de dark mode en el panel de cliente** (sí existe en `components/ui/*` vía `dark:` y en la landing), lo cual es una inconsistencia de plataforma pero **queda fuera de alcance de este plan** salvo que se decida explícitamente en la Fase 0 (ver nota ahí).

La conclusión de diseño (Fase 0) no es "cambiar todo a dark con lime" — el panel de cliente de una app de delivery se beneficia de un fondo claro (más apetito visual para fotos de comida, mejor legibilidad de precios/cantidades a plena luz del día, patrón ya validado por Rappi/Uber Eats/DoorDash). La propuesta es **elevar y unificar** el lenguaje visual claro que ya existe: tokens de sombra/radio propios, una paleta con roles claros (naranja = marca/CTA primario, un acento cálido secundario para "en curso"/tracking, y el `coral`/`lime` ya definidos en la landing reservados para momentos puntuales de deleite), y aplicar esa disciplina de forma pareja en las ocho páginas del panel.

---

## Índice de fases

| Fase | Nombre | Prioridad | Tipo |
|---|---|---|---|
| 0 | Fundamentos: tokens de diseño del panel de cliente | Alta | Base (bloquea el resto) |
| 1 | Header y navegación (`CustomerHeader`) | Alta | UI |
| 2 | Home / descubrimiento (`ClienteHomeClient`, tarjetas, carrusel) | Alta | UI |
| 3 | Carta de restaurante y tarjeta de producto | Alta | UI |
| 4 | Carrito y checkout | Alta | UI + micro-interacción |
| 5 | Pedidos: lista, detalle y timeline de estado | Media-Alta | UI |
| 6 | Direcciones y perfil | Media | UI |
| 7 | Micro-interacciones, motion y estados vacíos/carga | Media | Pulido transversal |
| 8 | Accesibilidad y responsive | Alta (no negociable) | QA |
| 9 | QA final, checklist de regresión y orden de despliegue | Obligatoria | QA |

Orden recomendado de ejecución: **0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9**. La Fase 0 bloquea a todas las demás porque define los tokens que las Fases 1-6 consumen; las Fases 1-6 son independientes entre sí y paralelizables si hay más de un desarrollador; la Fase 7 conviene hacerla al final porque pule lo que ya quedó construido, no lo que falta construir.

---

## Fase 0 — Fundamentos: tokens de diseño del panel de cliente

**Objetivo:** que exista una única fuente de verdad para sombras, radios, y roles de color del panel de cliente, en vez de valores repetidos y ligeramente distintos en cada componente.

**Por qué:** exactamente el mismo problema que ya resolvió `design-system/pideloya/MASTER.md` para la landing (`--shadow-sm/md/lg/xl`, paleta con roles). El panel de cliente nunca tuvo su propia pasada de fundamentos — cada componente se construyó de forma aislada. Sin esta fase, las Fases 1-6 volverían a improvisar valores.

**Archivo a modificar (el único cambio de "infraestructura" de todo el plan):** `app/globals.css` — se **añaden** tokens nuevos dentro de los bloques `:root`/`@theme inline` ya existentes; no se toca nada de lo que ya usan `/admin`, `/restaurante`, `/repartidor` ni la landing.

### 0.1 — Paleta con roles claros para `/cliente`

Se reutilizan los tokens de marca que ya existen (`--brand-50…700`, `--lime`, `--coral`, `--violet`) — **no se inventan colores nuevos** — pero se documenta y refuerza su rol dentro del panel de cliente:

| Rol | Token | Uso |
|---|---|---|
| CTA primario / marca | `--brand-500` / `--brand-600` (gradiente) | Botón de acción principal, precio destacado, badge de "en camino" |
| Acento de deleite (puntual) | `--lime` | Micro-confirmaciones: "Agregado ✓", check de pedido confirmado, indicador de disponibilidad — nunca fondo de sección completa |
| Atención / estado especial | `--coral` | Badges de "Cerrado", alertas suaves (ya se usa así en `RestaurantCard`) — se mantiene, se generaliza a otros badges de estado negativo |
| Atmósfera (fondos, glows) | `--violet` en opacidades bajas | Fondos de sección con gradiente sutil (ya presente en `HeroSection`/`ClienteHomeClient`), nunca en texto ni CTA |

### 0.2 — Escala de sombra y radio propia del panel

Agregar a `app/globals.css`, dentro de `@theme inline` (mismo patrón que `--shadow-sm/md/lg/xl` de la landing, pero con nombre distinto para no chocar):

```css
:root {
  /* Sombra "glass" del panel de cliente: más suave y cálida que el shadow-sm/lg genérico de shadcn */
  --client-shadow-card: 0 1px 2px rgba(15, 15, 15, 0.03), 0 8px 24px -12px rgba(234, 88, 12, 0.12);
  --client-shadow-card-hover: 0 4px 10px rgba(15, 15, 15, 0.04), 0 16px 36px -14px rgba(234, 88, 12, 0.18);
  --client-shadow-floating: 0 8px 30px -6px rgba(0, 0, 0, 0.18);
}

@theme inline {
  --shadow-client-card: var(--client-shadow-card);
  --shadow-client-card-hover: var(--client-shadow-card-hover);
  --shadow-client-floating: var(--client-shadow-floating);
}
```

Radio: se estandariza en **`rounded-3xl` para tarjetas de contenido** (restaurante, producto, dirección, pedido) y **`rounded-2xl` para controles internos** (botones dentro de tarjeta, chips, inputs) — hoy ya es la tendencia dominante en el código, esta fase solo la hace explícita y corrige las excepciones (`ProductOrderCard`, `OrderDetailsDialog`, que usan `rounded-xl`/`rounded-lg`).

### 0.3 — Motion tokens

```css
@theme inline {
  --ease-client: cubic-bezier(0.16, 1, 0.3, 1); /* misma curva que .animate-fade-up ya usa */
  --duration-client-fast: 150ms;
  --duration-client-base: 220ms;
  --duration-client-slow: 400ms;
}
```

Se documenta como convención (no requiere utilidades Tailwind nuevas): transiciones de hover/tap usan `duration-150`, entradas de tarjetas/listas usan `duration-300` con `ease-[cubic-bezier(0.16,1,0.3,1)]` (la misma curva que ya usa `.animate-fade-up`), y el carrito flotante / diálogos usan `duration-200`.

### 0.4 — Decisión sobre dark mode (explícita, para que quede escrita)

**Fuera de alcance de este ciclo.** El panel de cliente permanece en modo claro. Los componentes `ui/*` ya traen soporte `dark:` de shadcn, así que no se rompe nada si se activa en el futuro — pero esta ronda de pulido no invierte tiempo en QA de dark mode para `/cliente`, para no diluir el foco. Se deja como ítem de backlog, igual que la Fase 9 del plan de mejora del panel admin dejó pendiente la migración de flags a enum.

### 0.5 — Checklist de aceptación de la Fase 0

- [ ] `app/globals.css` compila sin romper Tailwind v4 (`pnpm run build`).
- [ ] Los tokens nuevos no colisionan con nombres existentes (`--shadow-sm/md/lg/xl` de la landing quedan intactos).
- [ ] Ninguna página fuera de `/cliente` cambia visualmente (los tokens nuevos son aditivos, nadie más los consume todavía).

---

## Fase 1 — Header y navegación (`CustomerHeader.tsx`)

**Objetivo:** que el header se sienta como la "barra de comando" premium del panel — con jerarquía clara entre logo, búsqueda, navegación y cuenta — en vez de una fila de elementos con distinto lenguaje visual cada uno.

**Archivo a modificar:** `components/layout/CustomerHeader.tsx` (único archivo de esta fase).

### Tareas

1. **Header con elevación dinámica al hacer scroll.** Hoy es `sticky` con `bg-white/70 backdrop-blur-xl` fijo. Agregar un listener de scroll ligero (`useState` + `useEffect` con `passive: true`, patrón ya usado en el proyecto en otros componentes cliente) que añade `shadow-client-floating` y sube la opacidad del blur (`bg-white/90`) solo después de superar ~8px de scroll — el header "aterriza" en vez de tener siempre el mismo peso visual encima del hero.
2. **Pill de navegación con estado activo más rico.** Hoy el activo es `bg-brand-500 text-white shadow-sm`. Cambiar a un gradiente sutil (`bg-gradient-to-r from-brand-500 to-brand-600`) + `shadow-client-card` consistente con el resto del panel, y el ícono con una transición de escala al activarse (`scale-110` en el ícono activo, `transition-transform duration-150`).
3. **Badge del carrito con micro-animación de "pulso" al cambiar `itemCount`.** Usar una key basada en `itemCount` sobre el `<span>` del badge para forzar un re-mount + clase `animate-stat-in` (ya definida en `globals.css`, reutilizable sin crear nada nuevo) cada vez que el número cambia — el cliente ve confirmación visual inmediata de que el producto entró al carrito, no solo un número que cambia en silencio.
4. **Buscador con foco más claro.** Al enfocar el input (desktop y mobile), agregar `ring-2 ring-brand-500/15` + elevar el ícono de lupa a `text-brand-500` — hoy el estado de foco es casi invisible (`focus:border-brand-500`, apenas perceptible sobre `bg-black/[0.03]`).
5. **Avatar con anillo de marca sutil.** El `AvatarFallback` ya usa gradiente de marca; agregar `ring-2 ring-white ring-offset-2 ring-offset-transparent` para que se despegue del fondo del header cuando está sobre contenido con imagen detrás (scroll de home con banners).
6. **Drawer móvil: entrada más suave.** El `<aside>` ya anima con `translate-x-full → translate-x-0`; subir la duración de `duration-200` a `duration-300` con la curva `ease-client` para que no se sienta "cortado" en dispositivos de gama media, y agregar un `backdrop-blur-sm` progresivo al overlay (`bg-black/50` → considerar `bg-black/40 backdrop-blur-[2px]`) para que el panel lateral se perciba como una capa flotante, no un simple overlay oscuro.

### Checklist de aceptación

- [ ] El header no cambia de altura al aplicar la sombra de scroll (evita layout shift).
- [ ] El pill activo se ve consistente en las dos rutas de `NAV_LINKS` (`/cliente/pedidos`, `/cliente/direcciones`).
- [ ] El badge del carrito anima solo cuando el número cambia, no en cada render.
- [ ] El drawer móvil respeta `prefers-reduced-motion` (las transiciones CSS ya están cubiertas por la regla global en `app/globals.css`, verificar que no se rompe).

---

## Fase 2 — Home / descubrimiento (`ClienteHomeClient.tsx`, `RestaurantCard.tsx`, `FeaturedProductCard.tsx`, `SearchBar.tsx`)

**Objetivo:** que la home se sienta "editorial" (como el feed curado de una app premium de delivery) y no una lista plana de tarjetas — usando exactamente los mismos datos que ya trae `app/cliente/page.tsx`, sin pedir nada nuevo al backend.

**Archivos a modificar:** `components/features/cliente-home/ClienteHomeClient.tsx`, `components/features/restaurants/RestaurantCard.tsx`, `components/features/products/FeaturedProductCard.tsx`. (`SearchBar.tsx` es de la zona pública, no de `/cliente` — no se toca; el buscador del panel vive en `CustomerHeader`, ya cubierto en la Fase 1.)

### Tareas

1. **Hero de bienvenida con saludo contextual.** Hoy el hero es un bloque de texto fijo ("¿Qué se te antoja hoy?"). Agregar un saludo dependiente de la hora del día calculado **en el servidor** (`app/cliente/page.tsx` ya es un Server Component — pasar `greeting` como prop calculado con la hora de Lima, mismo patrón que `limaDayKey`/`dayParts` en `lib/dates.ts`, para evitar el hydration mismatch que el proyecto ya aprendió a evitar en otros lados): "Buenos días", "Buenas tardes", "Buenas noches" + el `¿Qué se te antoja hoy?` como subtítulo. Esto es contenido dinámico legítimo (no decoración), consistente con el resto del proyecto (`RestaurantDashboardCards` ya calcula fecha en servidor por la misma razón).
2. **Categorías (`food_type`) con chips más táctiles.** Hoy son `rounded-full` con `border` + color plano en activo. Agregar `shadow-client-card` en el chip activo y una transición de "settle" al cambiar de categoría (`transition-all duration-150`), más un pequeño `scale-95` en `:active` para feedback táctil en móvil (patrón Apple: todo control interactivo confirma el toque, no solo el hover de desktop).
3. **`RestaurantCard`: profundidad y jerarquía.**
   - Reemplazar `shadow-sm ring-1 ring-black/5` por `shadow-client-card` (hover: `shadow-client-card-hover`) — mismo look, pero desde el token centralizado de la Fase 0.
   - El badge "Cerrado" (`coral`, ya correcto semánticamente) se mantiene; agregar un velo sutil (`bg-white/40` sobre la imagen) cuando `isOpen === false`, para que la tarjeta completa comunique "no disponible ahora" de un vistazo, no solo el badge en la esquina.
   - El texto "Ver menú" que aparece en hover (`opacity-0` → `opacity-100`) se mantiene para desktop; en touch devices (sin hover real) esto nunca se ve — agregarlo también de forma permanente pero sutil en la esquina para mobile (`opacity-60` por defecto, `opacity-100` en hover/focus), así el affordance "esto es clickeable y lleva a un menú" no depende exclusivamente de hover.
4. **`FeaturedProductCard`: confirmación de "agregado" más rica.** Hoy: `justAdded` con `setTimeout(1200ms)` que muestra texto "Agregado ✓" reemplazando el precio. Cambio:
   - El botón `+` circular, al agregar, hace un pulso breve (`scale-125` → `scale-100`, `duration-150`) en vez de quedar estático — feedback inmediato en el punto exacto donde el usuario tocó.
   - El "Agregado ✓" pasa a ser un chip flotante temporal (`absolute`, `bg-lime text-[#0C0C0E]`, con `animate-fade-up` ya existente) sobre la imagen, no un reemplazo del precio — así el precio nunca desaparece de la vista (hoy technically se pierde información por 1.2s).
5. **Carrusel de logos (`LogoLoop`) y de platos populares: indicadores de scroll.** El carrusel horizontal de "Platos populares" no tiene ninguna señal de que hay más contenido a la derecha. Agregar un fade-out sutil al borde derecho del contenedor (`mask-image` ya se usa en otras partes del proyecto — reutilizar el mismo patrón que `HeroSection`/`JoinSection` con `[mask-image:linear-gradient(...)]`) para insinuar continuidad sin agregar flechas de navegación (mantiene el gesto nativo de swipe, más apropiado para mobile-first).

### Checklist de aceptación

- [ ] El saludo horario se calcula en el servidor, sin `Date.now()` dentro del client component (misma regla `react-hooks/purity` que ya aplica el proyecto — ver nota en el plan de pulido de paneles, Fase 3.4).
- [ ] Las categorías siguen siendo accesibles por teclado (`aria-pressed` ya presente, no se rompe).
- [ ] El velo de "cerrado" no reduce el contraste del badge "Cerrado" por debajo de 4.5:1.
- [ ] El chip "Agregado ✓" no bloquea el botón `+` mientras está visible (pointer-events correctos).

---

## Fase 3 — Carta de restaurante y tarjeta de producto (`RestaurantMenuView.tsx`, `ProductOrderCard.tsx`, `RestaurantOpenBanner.tsx`)

**Objetivo:** que la pantalla donde el cliente realmente decide qué comprar sea la más cuidada de todo el panel — es, en términos de producto, la pantalla de mayor conversión.

**Archivos a modificar:** `components/features/restaurants/RestaurantMenuView.tsx`, `components/features/products/ProductOrderCard.tsx`, `components/features/restaurants/RestaurantOpenBanner.tsx`.

### Tareas

1. **Header del restaurante: el banner de gradiente deja de ser decorativo puro.** Hoy es un bloque `h-28`/`h-36` con gradiente `from-brand-500 via-brand-600 to-violet` sin relación con el restaurante. Cambio mínimo y de alto impacto: si `restaurant.logo_url` existe, usar el logo como fondo desenfocado (`blur-2xl scale-110`, con overlay de gradiente de marca encima al 70% para mantener legibilidad) en vez de un gradiente genérico — técnica ya validada en apps de delivery premium ("ambient cover"), y no requiere ningún dato nuevo del backend (el logo ya se trae).
2. **Tarjeta flotante de info: jerarquía tipográfica.** El nombre del restaurante (`text-xl font-semibold`) y la descripción compiten visualmente con los badges. Reordenar con más aire: `food_type` como badge de marca (ya correcto), dirección con ícono ya presente, pero aumentar el `line-height` de la descripción y limitar a `line-clamp-2` con un tono de gris más suave (`text-muted-foreground/90`) para que no compita con el nombre.
3. **Banner "Cerrado" (`RestaurantOpenBanner`) con más carácter.** Hoy es una fila ámbar plana. Mantener el color semántico (ámbar = advertencia, correcto), pero agregar un ícono de reloj con leve animación de "tic" (rotación de 2-3° oscilante, `duration-slow`, respetando `prefers-reduced-motion`) — comunica "esto es temporal, vuelve luego" sin ser intrusivo.
4. **`ProductOrderCard`: pasa de `rounded-xl border` plano a la tarjeta glass estándar del panel.** Cambio concreto:
   - `rounded-xl border p-3` → `rounded-3xl shadow-client-card p-3.5` (sin `border`, siguiendo el patrón ya usado en `AddressCard`/`ProductOrderCard` de la carta pública vs. la de `/cliente`, que hoy son inconsistentes entre sí).
   - Imagen del producto: agregar un ligero `hover:scale-105` (`overflow-hidden` ya está en el contenedor) — societal cue de "esto es interactivo/apetecible".
   - El stepper de cantidad (`− / cantidad / +`) pasa de dos `Button variant="outline"` sueltos a un grupo unificado (`inline-flex rounded-full bg-muted/60 p-1`, mismo patrón que ya usa el stepper de cantidad implícito en otros paneles) — hoy se ven como dos botones sueltos con un número en medio, no como un control cohesivo.
   - Botón "Agregar": mismo tratamiento de confirmación que la Fase 2 (chip flotante `lime` en vez de reemplazar el texto del botón).
5. **Secciones por categoría con separación más clara.** Los títulos de categoría (`text-sm font-semibold uppercase tracking-wide`) quedan bien, pero agregar un pequeño separador con degradado (`.section-divider`, ya definido en `LegalDocumentLayout.tsx` — **reutilizar la clase existente**, no crear una nueva) entre categorías consecutivas, para que la carta se lea como secciones, no como una lista continua.

### Checklist de aceptación

- [ ] El fondo desenfocado del logo no rompe cuando `logo_url` es `null` (fallback al gradiente de marca actual, sin condicionales frágiles).
- [ ] El contraste del texto sobre el banner de logo desenfocado + overlay sigue cumpliendo 4.5:1 (el overlay de gradiente de marca ya es opaco al 70%, verificar con las fotos reales más oscuras/claras que suban los restaurantes).
- [ ] El stepper de cantidad sigue funcionando igual con `disabled` cuando el restaurante está cerrado (no se toca la lógica, solo el estilo).
- [ ] `RestaurantOpenBanner` no anima cuando `prefers-reduced-motion: reduce` está activo.

---

## Fase 4 — Carrito y checkout (`CartBar.tsx`, `CartClient.tsx`)

**Objetivo:** que el momento de "voy a pagar" se sienta seguro, claro y con feedback constante — es la pantalla donde más ansiedad de UX hay en cualquier app de delivery (¿me van a cobrar de más? ¿está bien mi dirección? ¿el negocio sigue abierto?).

**Archivos a modificar:** `components/features/cart/CartBar.tsx`, `components/features/cart/CartClient.tsx`.

### Tareas

1. **`CartBar` (barra flotante): entrada/salida animada.** Hoy aparece/desaparece de golpe (`itemCount === 0 ? null`). Envolver el contenido en una transición basada en clases condicionales (`translate-y-0 opacity-100` vs. estado inicial `translate-y-4 opacity-0` con `transition-all duration-300 ease-client`), usando el patrón ya existente en el proyecto de animar por clases (no requiere una librería de animación nueva — el proyecto no usa Framer Motion y no hace falta introducirla para esto).
2. **`CartBar`: jerarquía de precio.** El total ya está en un chip `bg-white/20` a la derecha — subir su peso (`text-base font-bold` en vez de `text-sm font-semibold`) para que sea lo primero que el ojo capta, consistente con el principio "el precio es la decisión, resáltalo" que ya aplica bien `DailySalesChart`/`RestaurantCard` en otros paneles.
3. **`CartClient`: tarjetas de línea de pedido con la misma tarjeta glass estándar.** Ya usa `rounded-2xl border border-black/5 bg-white/70 shadow-sm backdrop-blur-xl` — subir a `rounded-3xl shadow-client-card` para alinear con el token de la Fase 0 (cambio de una clase, sin tocar lógica).
4. **Banner de "negocio cerrado" dentro del carrito: reforzar la urgencia sin alarmar.** Ya existe (`ClockIcon` + texto ámbar). Mantener el tono (no es un error, es información), pero mover el CTA de confirmar pedido a un estado visualmente "atenuado" (`opacity-60` + `cursor-not-allowed`, ya lo hace vía `disabled`) y agregar el mismo ícono de reloj con el tic sutil de la Fase 3 para que ambos banners (carta y carrito) se sientan como el mismo componente conceptual — hoy son dos implementaciones de texto ámbar ligeramente distintas.
5. **Resumen de total: convertirlo en tarjeta "sticky" en desktop / mobile.** Hoy el bloque de total (`flex items-center justify-between rounded-2xl bg-brand-500/5 px-4 py-3.5`) vive al final del flujo de scroll. En viewports altos (desktop, tablet en horizontal) fijarlo (`sticky bottom-4` dentro de su contenedor, con `shadow-client-floating`) junto al botón de confirmar, para que el cliente nunca pierda de vista "cuánto voy a pagar" mientras revisa dirección/notas — patrón estándar de cualquier checkout premium (Apple Pay sheet, Shopify checkout).
6. **Pantalla de éxito (post-pedido): más celebratoria, sin exagerar.** Hoy: ícono de check verde en círculo + texto. Cambiar el color del ícono de `green-500`/`green-600` (fuera de la paleta de marca) a `lime` sobre fondo `bg-lime/15 text-[#0C0C0E]` — coherencia de marca (el "momento de éxito" usa el mismo acento de deleite que el resto del panel, en vez de un verde genérico de sistema operativo que no pertenece a la identidad de PideloYa) — y agregar una entrada `animate-fade-up` al ícono.

### Checklist de aceptación

- [ ] El total sticky no tapa contenido en pantallas pequeñas (verificar en 375px con teclado abierto por el `Textarea` de notas — usar `env(safe-area-inset-bottom)` si hace falta, mismo patrón que ya usan los layouts publicados).
- [ ] `CartBar` sigue sin renderizar en `/cliente/carrito` (lógica intacta, `pathname === '/cliente/carrito'`).
- [ ] El cambio de verde→lime en la pantalla de éxito no reduce el contraste del ícono sobre su fondo.
- [ ] Ninguna animación nueva introduce layout shift medible (verificar con DevTools "Layout Shift Regions").

---

## Fase 5 — Pedidos: lista, detalle y timeline de estado

**Objetivo:** que el seguimiento del pedido (la razón #1 por la que un cliente vuelve a abrir la app después de pagar) comunique progreso de forma clara e inequívoca, no solo con texto.

**Archivos a modificar:** `components/features/orders/OrdersListClient.tsx`, `components/features/orders/OrderStatusTimeline.tsx`, `components/features/orders/OrderStatusBadge.tsx`, `app/cliente/pedidos/[id]/page.tsx`.

### Tareas

1. **`OrderStatusTimeline`: de círculos sueltos a línea de progreso conectada.** Hoy cada paso es un círculo (`bg-foreground` si `done`, `bg-muted` si no) sin conexión visual entre ellos más que el `space-y-3` vertical. Cambio: agregar una línea vertical conectora entre círculos consecutivos (un `<span>` absoluto de 2px de ancho entre cada `li`, coloreado `bg-brand-500` en el tramo ya completado y `bg-muted` en el pendiente) — el patrón de "rail" de progreso que cualquier app de tracking usa (Uber, Amazon). Es un cambio puramente de CSS/marcado, no toca la lógica de `currentIndex`.
2. **El paso "actual" (no solo los completados) se distingue con un pulso sutil.** Hoy `done = index <= currentIndex` trata igual a "ya completado" y "en curso ahora mismo". Agregar una clase adicional cuando `index === currentIndex` (el paso activo): un anillo animado alrededor del círculo (`ring-2 ring-brand-500/40 animate-pulse`, con `prefers-reduced-motion` respetado por la regla global) — comunica "esto está pasando ahora" de forma distinta a "esto ya pasó".
3. **`OrdersListClient`: chips de filtro con contador ya existente, mejorar el estado activo.** Ya tiene contador (`counts.active`, etc.) dentro del chip — subir el chip activo a `shadow-client-card` (token de la Fase 0) en vez de `shadow-sm shadow-brand-500/30`, consistente con el resto del panel.
4. **Banner "N pedidos buscando repartidor": reforzar con el mismo ícono de reloj/tic de las Fases 3-4** en vez de `SearchIcon`, para que las tres superficies (carta cerrada, carrito cerrado, pedido pendiente) usen el mismo lenguaje visual de "esperando" — hoy usan tres íconos distintos (`ClockIcon`, `ClockIcon`, `SearchIcon`) para transmitir conceptualmente lo mismo.
5. **Tarjetas de pedido en la lista: la miniatura apilada de productos gana profundidad.** Hoy `-space-x-2.5` con `ring-2 ring-white`. Agregar una sombra sutil por imagen (`shadow-sm`) para que se perciba como fotos físicas apiladas, no como recortes planos superpuestos.
6. **Página de detalle de pedido (`app/cliente/pedidos/[id]/page.tsx`): jerarquía de la fecha/hora vs. el timeline.** Hoy el título es "Pedido del {fecha}" seguido de la hora en una línea aparte, y luego el timeline en una tarjeta separada. Mantener la estructura (no requiere Server Component nuevo), pero:
   - El total del pedido pasa de una fila de texto (`flex justify-between rounded-2xl bg-brand-500/5`) a una tarjeta con más peso visual (`shadow-client-card`, precio en `text-xl font-bold text-brand-700`) — es el dato que el cliente probablemente vino a verificar.
   - Las tarjetas de dirección y notas (hoy dos bloques casi idénticos con distinto ícono) ganan el mismo `shadow-client-card` para unificarse con el resto de tarjetas del panel.

### Checklist de aceptación

- [ ] El rail de progreso del timeline no se rompe cuando el pedido está `CANCELLED` (ese caso ya tiene su propio return temprano en `OrderStatusTimeline`, no se toca esa rama).
- [ ] El anillo de pulso del paso activo respeta `prefers-reduced-motion`.
- [ ] Los chips de filtro siguen siendo `aria-pressed` correctos (no se toca la lógica, solo el estilo del activo).
- [ ] El realtime existente (`OrderStatusSection`, canal `postgres_changes` sobre `orders`) sigue disparando el re-render del timeline sin cambios — esta fase es 100% visual, cero cambios de datos.

---

## Fase 6 — Direcciones y perfil

**Objetivo:** que las pantallas "administrativas" del panel (menos frecuentadas, pero igual de importantes cuando se necesitan) no se sientan como un formulario de backoffice suelto dentro de una app de consumidor.

**Archivos a modificar:** `app/cliente/direcciones/page.tsx`, `components/features/addresses/AddressCard.tsx`, `components/features/addresses/AddressForm.tsx`, `components/features/profile/ProfileForm.tsx`.

### Tareas

1. **`AddressCard`: ya usa el lenguaje glass correcto (`rounded-3xl`, `backdrop-blur-xl`, gradiente en el ícono) — solo alinear su sombra al token nuevo (`shadow-client-card` en vez de `shadow-sm`).** Es el componente mejor logrado hoy de todo el panel; sirve de referencia para el resto de tarjetas en esta misma fase.
2. **`AddressForm`: el mapa (`AddressMapPicker`) gana un marco más integrado.** Hoy: `overflow-hidden rounded-2xl ring-1 ring-black/5`. Subir a `rounded-3xl` para consistencia, y agregar una pequeña etiqueta flotante sobre el mapa ("Toca para ubicar", `absolute top-2 left-2`, chip `bg-white/90 backdrop-blur text-xs`) que desaparece después del primer toque — hoy esa instrucción solo vive como texto plano debajo del mapa (`<p className="text-xs text-muted-foreground">`), fácil de pasar por alto.
3. **Botón "Usar mi ubicación": feedback de carga.** Hoy no muestra ningún estado mientras `navigator.geolocation.getCurrentPosition` resuelve (puede tardar 1-3s en exteriores). Agregar un estado `isLocating` con el ícono `LocateFixedIcon` girando (`animate-spin`) durante la espera — mismo patrón que ya usan los botones de "Guardando…" en el resto del proyecto (`disabled` + ícono/texto de carga).
4. **`ProfileForm`: el campo de email deshabilitado se distingue mejor de los editables.** Hoy usa el mismo `Input disabled`, que ya tiene `opacity-50` de shadcn — suficiente, no requiere cambio adicional; se documenta como verificado, no como tarea.
5. **`ProfileForm`: agregar un avatar de solo lectura consistente con el header.** Hoy el formulario no muestra ningún avatar, solo campos de texto — se siente desconectado de la identidad visual del resto del panel (donde el avatar con inicial + gradiente de marca es un elemento reconocible en el header). Agregar, arriba del formulario, el mismo `Avatar`/`AvatarFallback` con gradiente de marca (`size="lg"`) mostrando la inicial del nombre actual — sin funcionalidad de subida de foto (fuera de alcance), solo como ancla visual de "esta es tu cuenta".

### Checklist de aceptación

- [ ] El formulario de dirección sigue funcionando igual (validación, envío) — cambios puramente de clases y un estado de carga adicional en el botón de geolocalización.
- [ ] El avatar de solo lectura en `ProfileForm` no requiere ninguna columna nueva en `profiles` (usa `fullName` ya disponible en `initialData`).
- [ ] La etiqueta flotante sobre el mapa desaparece correctamente tras el primer `onChange` de coordenadas y no reaparece al reabrir el diálogo de edición.

---

## Fase 7 — Micro-interacciones, motion y estados vacíos/carga (transversal)

**Objetivo:** unificar lo que las Fases 1-6 dejaron construido pieza por pieza, y cerrar los huecos de estados vacíos/carga que hoy están resueltos de tres formas distintas dentro de `/cliente`.

**Archivos a modificar:** `app/cliente/favoritos/page.tsx`, `app/cliente/direcciones/page.tsx` (bloque de estado vacío), `components/features/orders/OrdersListClient.tsx` (estados vacíos), `components/features/cliente-home/ClienteHomeClient.tsx` (estado vacío de resultados filtrados), `app/cliente/loading.tsx`.

### Tareas

1. **Adoptar el componente `EmptyState` ya existente (`components/ui/empty-state.tsx`) en `/cliente`.** Hoy `/admin`, `/restaurante` y `/repartidor` lo usan consistentemente; `/cliente` reconstruye el mismo bloque a mano en cada página (`AddressesPage`, `OrdersListClient`, `ClienteHomeClient`, `CartClient`). Reemplazar esos bloques `border-dashed` hechos a mano por `<EmptyState icon={...} title={...} description={...} />`, pasando `className` para conservar el `rounded-3xl`/gradiente de ícono donde ya existía (el componente acepta `className` y `icon` opcional, así que no pierde el carácter visual que ya tenían, solo deja de estar triplicado). **Esto no es un archivo nuevo** — el componente ya existe, solo faltaba adoptarlo en esta zona.
2. **`app/cliente/favoritos/page.tsx` hoy es un placeholder (`<h1>Favoritos</h1>`) sin ningún estado.** Dado que la funcionalidad de favoritos aún no está implementada (no hay tabla ni acción para ello — confirmado revisando `lib/actions/*` y el esquema), esta fase se limita a darle un estado vacío coherente con el resto del panel usando `EmptyState` ("Aún no tienes favoritos" / "Marca tus restaurantes preferidos para encontrarlos más rápido") en vez de dejarlo como un `<h1>` suelto — mejora perceptible sin implementar la feature completa, que queda fuera de alcance de este plan de diseño.
3. **`app/cliente/loading.tsx`: alinear el skeleton con las nuevas proporciones de tarjeta.** Hoy usa `rounded-xl` para las tarjetas skeleton (`h-48 bg-muted rounded-xl`) — subir a `rounded-3xl` para que el salto entre "esqueleto" y "contenido real" (una vez cargado) sea imperceptible, en vez de que el usuario vea un cambio de forma cuando el contenido real aparece.
4. **Documentar (como comentario en `globals.css`, no como archivo nuevo) la convención de motion de la Fase 0.3** junto a los tokens ya agregados, para que futuras piezas del panel de cliente reutilicen las mismas duraciones/curvas en vez de reinventarlas.

### Checklist de aceptación

- [ ] Ningún estado vacío de `/cliente` queda con el bloque `border-dashed` manual antiguo tras esta fase.
- [ ] `EmptyState` sigue sin requerir props obligatorias nuevas (se usa tal cual ya existe, solo se le pasan distintos `icon`/`title`/`description` por pantalla).
- [ ] El skeleton de `app/cliente/loading.tsx` coincide en radio con las tarjetas reales de `ClienteHomeClient` tras la Fase 2.

---

## Fase 8 — Accesibilidad y responsive (no negociable)

**Objetivo:** que todo el pulido visual de las Fases 1-7 no comprometa contraste, foco de teclado, tamaño de objetivo táctil ni el compromiso ya existente del proyecto con `prefers-reduced-motion`.

**No introduce archivos ni componentes nuevos** — es una pasada de verificación y ajustes puntuales sobre lo ya modificado.

### Tareas

1. **Contraste:** verificar con la paleta ya existente (no se introducen colores nuevos) que todo texto sobre `brand-500`/`coral`/`lime` cumple 4.5:1 — puntos de riesgo nuevos de este plan: el overlay de logo desenfocado (Fase 3.1), el velo sobre restaurantes cerrados (Fase 2.3), el badge flotante `lime` (Fases 2.4/3.4).
2. **Foco visible:** el proyecto ya centraliza el foco en `:focus-visible { outline: 2px solid var(--lime) }` (global, `app/globals.css`) — confirmar que ningún componente nuevo de esta ronda (chips, botón de geolocalización, avatar en perfil) lo sobreescribe accidentalmente con `outline-none` sin un reemplazo equivalente.
3. **Tamaño de objetivo táctil:** los steppers de cantidad, chips de categoría y botones de icono deben mantener mínimo 40×40px de área táctil real (aunque el elemento visual sea más pequeño, vía padding) — verificar especialmente el nuevo grupo de stepper unificado de la Fase 3.4.
4. **`prefers-reduced-motion`:** todas las animaciones nuevas de este plan (pulso del badge de carrito, tic del reloj, anillo del paso activo del timeline, entrada/salida de `CartBar`) deben quedar cubiertas por la regla global ya existente en `app/globals.css` (`@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; ... } }`) — si alguna usa `transition` de un valor no-animable (ej. cambio de `display`), verificar manualmente que no genere un salto brusco desagradable incluso con motion reducido.
5. **Breakpoints:** verificar 375px (móvil pequeño), 768px (tablet) y 1024px+ (desktop) en las ocho pantallas tocadas — el panel de cliente es predominantemente mobile-first (`max-w-5xl` centrado), así que el foco principal es 375-428px, con desktop como caso secundario ya centrado y con buen aire.

### Checklist de aceptación

- [ ] Ningún cambio de esta ronda reduce contraste por debajo de 4.5:1 en texto sobre fondo de color.
- [ ] El anillo de `:focus-visible` sigue apareciendo en todos los controles interactivos nuevos.
- [ ] Los steppers y chips mantienen ≥40×40px de objetivo táctil.
- [ ] Con "Reducir movimiento" activado en el SO, ninguna pantalla del panel de cliente muestra una animación de más de 0.01ms de duración.

---

## Fase 9 — QA final, checklist de regresión y orden de despliegue

### 9.1 — Orden de despliegue recomendado

1. **Fase 0 primero, sola, en su propio commit/PR.** Es aditiva y de bajísimo riesgo (solo agrega tokens a `globals.css`) — mergeable de inmediato tras `pnpm run build`.
2. **Fases 1-6 pueden ir en paralelo** (son archivos distintos, sin dependencias cruzadas entre sí más que consumir los tokens de la Fase 0) — recomendado agruparlas en un solo release visual para que el cliente no vea el panel "a medio rediseñar" entre fases.
3. **Fase 7 al final del bloque visual**, porque depende de que las Fases 1-6 ya hayan definido las formas/tamaños de tarjeta que el skeleton de carga debe imitar.
4. **Fase 8 corre en paralelo a todo lo anterior** como criterio de aceptación de cada PR, no como un paso separado al final — cada Fase 1-7 debe pasar su propio checklist de accesibilidad antes de mergear.

### 9.2 — Checklist de regresión completo

- [ ] `pnpm run typecheck` sin errores nuevos.
- [ ] `pnpm run lint` sin errores/warnings nuevos en los archivos tocados.
- [ ] `pnpm run build` exitoso.
- [ ] Ninguna Server Action ni query a Supabase fue modificada — este plan es 100% visual; si algún cambio tocó lógica de datos, revertir esa parte y dejarla fuera de este ciclo.
- [ ] Home (`/cliente`): saludo horario correcto, categorías, carrusel de populares, tarjetas de restaurante con velo de "cerrado" cuando aplica.
- [ ] Carta de restaurante (`/cliente/restaurantes/[slug]`): banner con logo desenfocado (o fallback si no hay logo), banner de cerrado, tarjetas de producto con stepper unificado.
- [ ] Carrito (`/cliente/carrito`): `CartBar` anima entrada/salida en el resto del panel, total sticky en checkout, pantalla de éxito con acento `lime`.
- [ ] Pedidos (`/cliente/pedidos`, `/cliente/pedidos/[id]`): timeline con rail conectado y paso activo distinguido, filtros con contador y estado activo consistente.
- [ ] Direcciones (`/cliente/direcciones`) y Perfil (`/cliente/perfil`): tarjetas alineadas al token de sombra, geolocalización con estado de carga, avatar de solo lectura en perfil.
- [ ] Favoritos (`/cliente/favoritos`): estado vacío coherente en vez de placeholder plano.
- [ ] Verificación manual en mobile real o emulado (375px/428px) de las ocho pantallas — es donde vive la mayoría de los clientes reales de una app de delivery.
- [ ] Verificación con "Reducir movimiento" activado en al menos dos de las pantallas con animación nueva (carrito, timeline).

---

## Resumen de archivos

### Archivos modificados (todos los cambios de este plan — cero archivos nuevos)

- `app/globals.css` — Fase 0 (tokens de sombra/motion), Fase 7 (comentario de convención).
- `components/layout/CustomerHeader.tsx` — Fase 1.
- `components/features/cliente-home/ClienteHomeClient.tsx` — Fase 2, Fase 7 (estado vacío).
- `components/features/restaurants/RestaurantCard.tsx` — Fase 2.
- `components/features/products/FeaturedProductCard.tsx` — Fase 2.
- `components/features/restaurants/RestaurantMenuView.tsx` — Fase 3.
- `components/features/products/ProductOrderCard.tsx` — Fase 3.
- `components/features/restaurants/RestaurantOpenBanner.tsx` — Fase 3.
- `components/features/cart/CartBar.tsx` — Fase 4.
- `components/features/cart/CartClient.tsx` — Fase 4.
- `components/features/orders/OrderStatusTimeline.tsx` — Fase 5.
- `components/features/orders/OrdersListClient.tsx` — Fase 5, Fase 7 (estado vacío).
- `app/cliente/pedidos/[id]/page.tsx` — Fase 5.
- `components/features/addresses/AddressCard.tsx` — Fase 6.
- `components/features/addresses/AddressForm.tsx` — Fase 6.
- `components/features/profile/ProfileForm.tsx` — Fase 6.
- `app/cliente/direcciones/page.tsx` — Fase 7 (estado vacío).
- `app/cliente/favoritos/page.tsx` — Fase 7 (estado vacío).
- `app/cliente/loading.tsx` — Fase 7 (radio de skeleton).

### Archivos nuevos

Ninguno. Todo componente reutilizado en este plan (`EmptyState`, `.animate-stat-in`, `.section-divider`) ya existe en el repositorio.

Ningún otro archivo del proyecto necesita tocarse para cumplir lo pedido — en particular, `/admin`, `/restaurante`, `/repartidor`, la landing pública y toda la capa de datos (Server Actions, RLS, `types/database.ts`) quedan fuera de alcance y sin cambios.
