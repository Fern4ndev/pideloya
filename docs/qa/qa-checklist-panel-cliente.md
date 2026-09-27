# QA — Rediseño visual del panel de cliente

Fuente: `docs/plans/plan-mejora-ui-panel-cliente.md` (fases 0 a 9).
Alcance: `/cliente` (home, carta de restaurante, carrito, pedidos, direcciones, perfil, favoritos) y los componentes que consume.
Skills aplicadas: `ui-ux-pro-max` y `vercel-react-best-practices` (`.agents/skills/`).

---

## 1. Verificación automática (ya ejecutada)

| Comprobación | Resultado |
|---|---|
| `pnpm run typecheck` | limpio |
| `npx eslint` sobre los 22 archivos tocados | sin salida |
| `pnpm run build` | OK, todas las rutas compilan |
| Tokens CSS emitidos | `shadow-client-card`, `shadow-client-card-hover`, `shadow-client-floating`, `ease-client` — verificado dentro de `.next/static/chunks/*.css`, con el valor correcto |
| Animaciones emitidas | `animate-add-pulse`, `animate-clock-tick`, `animate-ping`, `animate-stat-in` |
| Valores arbitrarios (se pierden en silencio si están mal escritos) | `[mask-image:linear-gradient(…86%…)]`, `h-[calc(100%-0.75rem)]`, `left-[11px]`, `ring-offset-black/10` — los cuatro emiten CSS real |
| Alcance del diff | `git diff --numstat` sin ruido de fin de línea; ningún archivo fuera de `app/cliente`, `app/globals.css` y `components/` |

**Lo que NO se ejecutó: el QA visual.** Requiere una sesión de cliente contra la base real (`app/cliente/layout.tsx` redirige si el rol no es `CUSTOMER`). Todo lo de la sección 3 queda pendiente de correr en un navegador; los casos están escritos para ejecutarse tal cual.

---

## 2. Hallazgos — contraste de texto pequeño (pre-existentes, NO corregidos)

Son anteriores a este plan y quedan **fuera de su alcance**: el plan acota la Fase 8 a los puntos de riesgo **nuevos**. Se documentan porque la Fase 8 pide explícitamente verificar todo texto sobre `brand-500`/`coral`/`lime`.

| Elemento | Archivo | Ratio aprox. | Corrección sugerida |
|---|---|---|---|
| Subtítulo del hero (`text-white/85` sobre gradiente brand-500→violet) | `ClienteHomeClient.tsx` | ~2.6:1 | Subir a `text-white` (3.6:1) y/o oscurecer el gradiente. El titular (`text-2xl font-bold`) sí cumple: texto grande requiere 3:1 |
| Badge del carrito del header (`bg-coral` + blanco, 10px) | `CustomerHeader.tsx` | 3.3:1 | Texto `#0C0C0E` sobre coral (5.7:1) |
| Badge de `food_type` (`bg-brand-500` + blanco, 12px) | `RestaurantMenuView.tsx` | 3.6:1 | `bg-brand-700` (5.2:1), como el resto del panel |
| Iconos `text-brand-600` sobre `bg-brand-500/10` | varios | ~3.4:1 | **Cumplen** el 3:1 de elementos no textuales; no requieren cambio |

**Sí corregidos en esta ronda** (misma causa, archivos que ya estaban en alcance): `text-xs text-brand-600` → `brand-700` en `AddressCard`, `AddressViewDialog`, los tres textos del carrito y el hover del título de `RestaurantCard`; `text-green-600` → `text-green-700` en el "Guardado." de `ProfileForm`.

Otros hallazgos, también fuera de alcance y **no corregidos**:

- **`app/cliente/loading.tsx` renderiza su propio header skeleton** mientras el layout ya monta el `CustomerHeader` real, así que durante la carga se ven dos headers. Es pre-existente; el plan sólo pedía alinear el radio del skeleton (hecho).
- **`env(safe-area-inset-bottom)` no aplica hoy:** el proyecto no declara `viewport-fit=cover` en ningún layout, así que la variable resolvería `0`. La barra flotante del carrito y el total sticky usan 16px fijos. Si se habilita `viewport-fit=cover` en `app/layout.tsx`, revisar ambos offsets.
- **Aviso dashed dentro del checkout** (`CartClient`, "No tienes una dirección guardada"): se dejó como aviso compacto a propósito — `EmptyState` es un bloque centrado de `py-14` y rompería el flujo del carrito. No es un estado vacío de página.

---

## 3. Casos manuales por fase

### Fase 0 — tokens

- **F0.1** Ninguna página fuera de `/cliente` cambia: comparar `/admin`, `/restaurante` y `/repartidor` (una pantalla cada uno) contra el deploy anterior.
- **F0.2** Los tokens son aditivos: `shadow-sm/md/lg/xl` de Tailwind siguen intactos en la landing pública.

### Fase 1 — header

- **F1.1** Scroll de 10px en cualquier pantalla de `/cliente`: el header gana sombra y el fondo se opaca; al volver arriba vuelve al estado plano. **La altura no cambia** (medirla antes y después: no debe haber layout shift).
- **F1.2** Recargar la página estando scrolleado: el header aparece ya elevado (el snapshot del servidor es `false` y React corrige tras hidratar, sin parpadeo ni warning de hidratación en consola).
- **F1.3** El pill activo se ve igual en `/cliente/pedidos` y en `/cliente/direcciones` (gradiente + sombra del panel) y su ícono crece.
- **F1.4** Agregar un producto: el badge del carrito pulsa. Agregar otro: vuelve a pulsar (la `key` cambia con el número).
- **F1.5** Enfocar el buscador (clic y tab): la lupa se pone naranja y aparece el ring. Igual en el buscador de móvil.
- **F1.6** Drawer en <1024px: entrada de 300ms con la curva del panel, overlay con blur de 2px, `Escape` y clic afuera cierran.
- **F1.7** Con "Reducir movimiento" activo, el drawer cambia de estado sin animación.

### Fase 2 — home

- **F2.1** Cargar `/cliente` antes de las 12:00 → "Buenos días"; 12:00-18:59 → "Buenas tardes"; 19:00+ → "Buenas noches". El subtítulo conserva "¿Qué se te antoja hoy?".
- **F2.2** Chips de categoría: ~40px de alto, `active:scale-95` al tocar, chip activo con la sombra del panel.
- **F2.3** Restaurante cerrado: velo blanco sobre la imagen y el badge "Cerrado" sigue legible.
- **F2.4** "Ver menú" visible **sin hover** (emular touch o usar un celular) y con contraste correcto.
- **F2.5** Agregar un plato popular: chip lima "Agregado ✓" sobre la foto, el precio **no** desaparece, el `+` pulsa y el chip no bloquea el botón.
- **F2.6** El carrusel de populares muestra el degradado en el borde derecho y sigue respondiendo al swipe.

### Fase 3 — carta

- **F3.1** Restaurante **con** logo: banner con el logo desenfocado y velo de marca. **Sin** logo: gradiente de marca (probar los dos casos).
- **F3.2** Stepper del producto: un solo grupo con fondo propio, botones de 40×40, `−` deshabilitado en 1.
- **F3.3** Entre categorías consecutivas aparece el separador degradado; la sección "Otros" también lo lleva cuando hay categorías antes.
- **F3.4** Banner de cerrado: el reloj hace el tic; con "Reducir movimiento" no anima.

### Fase 4 — carrito

- **F4.1** Carrito vacío: no hay barra. Al agregar el primer producto entra deslizándose; al vaciarlo sale deslizándose (no desaparece de golpe).
- **F4.2** En `/cliente/carrito` la barra no se renderiza y **no deja un elemento enfocable invisible**: tabular desde el final de la página no debe alcanzar nada del carrito flotante.
- **F4.3** Total sticky: scrollear la lista mantiene total + botón pegados abajo; al llegar al final no tapan el último ítem ni el campo de notas.
- **F4.4** Negocio cerrado: banner ámbar con el reloj del tic y botón deshabilitado.
- **F4.5** Pedido confirmado: check en acento lima con entrada `fade-up`.
- **F4.6** Stepper y papelera del carrito: 40×40 de área táctil, con `aria-label` (leer con un lector de pantalla: "Quitar una unidad de X", "Quitar X del carrito").

### Fase 5 — pedidos

- **F5.1** Timeline con rail: tramos recorridos en naranja, pendientes en gris; el rail **no corta** los círculos y llega hasta el borde del siguiente.
- **F5.2** El paso actual (no sólo los completados) muestra anillo + halo pulsante.
- **F5.3** Pedido `CANCELLED`: sigue mostrando sólo el texto de cancelado (esa rama no se tocó).
- **F5.4** Chips de filtro: contador visible, activo con la sombra del panel, 40px de alto, `aria-pressed` correcto.
- **F5.5** Banner "N pedidos buscando repartidor" con el mismo reloj; desaparece cuando un repartidor acepta (realtime).
- **F5.6** Miniatura apilada: cada imagen con sombra propia.
- **F5.7** Detalle del pedido: total en tarjeta con precio grande; dirección y notas con la misma sombra del panel.

### Fase 6 — direcciones y perfil

- **F6.1** `/cliente/direcciones` sin dirección: `EmptyState` con el botón dentro; con dirección: card con la sombra nueva.
- **F6.2** Formulario de dirección: la etiqueta "Toca para ubicar" se ve sobre el mapa y desaparece al primer toque; **no reaparece** al abrir la edición de una dirección existente.
- **F6.3** "Usar mi ubicación": el ícono gira y el botón dice "Ubicando…"; al negar el permiso, el botón vuelve y aparece el error.
- **F6.4** `/cliente/perfil`: avatar con la inicial, nombre y correo arriba del formulario. Cambiar el nombre y guardar → la inicial se actualiza.
- **F6.5** **Regresión:** `/restaurante/perfil`, `/repartidor/perfil` y el perfil de admin **no** muestran el avatar nuevo (la prop no se les pasa) y conservan su separador.

### Fase 7 — transversal

- **F7.1** `/cliente/favoritos` muestra el estado vacío en vez del `<h1>` suelto.
- **F7.2** Skeleton de carga: el radio de las tarjetas coincide con las tarjetas reales de la home.
- **F7.3** Ya no quedan bloques `border-dashed` a mano en `/cliente` salvo el aviso compacto del checkout (excepción documentada en la sección 2).

---

## 4. Accesibilidad (fase 8)

- **A1 Contraste de los tres puntos nuevos:** chip lima (≈15:1), velo de "cerrado" (el badge tiene fondo propio opaco, no lo afecta) y banner con logo desenfocado (no lleva texto encima). Los tres pasan.
- **A2 Foco visible:** tabular de principio a fin en la lista de la home: todos los controles muestran el outline lima. No se agregó `outline-none` en ningún control nuevo; en el CSS emitido la regla `:focus-visible` de `globals.css` vive **fuera** de `@layer`, así que gana incluso a las utilidades que apagan el outline.
- **A3 Objetivo táctil 40×40:** chips de categoría y de filtros (`py-2.5` = 40px), steppers de la carta y del carrito (`h-10 w-10`), botones de ícono del header (`h-10 w-10`). Verificar con el inspector en 375px.
- **A4 `prefers-reduced-motion`:** activarlo en el SO y revisar las dos pantallas con más animación (carrito y timeline). Todas las animaciones nuevas son CSS (`animation`/`transition`), cubiertas por la regla global; ninguna depende de cambios de `display`, así que no debe quedar ningún salto brusco.
- **A5 Breakpoints:** 375px, 428px, 768px y 1024px en las ocho pantallas. El foco es móvil; en 375px revisar especialmente las filas del carrito (stepper + papelera) y el total sticky con el teclado abierto.

---

## 5. Regresión y despliegue (fase 9)

- **R1** `git diff --stat`: ningún cambio en `lib/`, `types/`, `supabase/` ni en Server Actions. Este plan es **100% visual**; si algo de eso aparece, revertir esa parte.
- **R2** Nada fuera de `/cliente`: `/admin`, `/restaurante` y `/repartidor` no deben cambiar salvo el detalle ya conocido de `ProfileForm` (dos tokens de color: `green-700` en "Guardado." y `brand-700` en la etiqueta de dirección, ambos por contraste).
- **R3** No hay migraciones, ni variables de entorno, ni cambios de datos: el release es sólo de UI.

**Orden recomendado:** un solo release visual (la Fase 0 sola primero no aporta nada visible y las fases 1-6 ya están juntas). Dentro del release: Fase 0 → 7 → 1-6, tal como quedó implementado. Sin pasos de base de datos, el rollback es un revert del commit.
