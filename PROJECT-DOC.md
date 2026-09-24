# PideloYa - Documentación Completa del Proyecto

## Resumen General

**PideloYa** es una plataforma de pedidos y delivery de comida para Abancay, Apurímac.

| Aspecto | Detalle |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Lenguaje** | TypeScript |
| **Estilos** | Tailwind CSS v4 + shadcn/ui |
| **Base de Datos** | Supabase (PostgreSQL) |
| **Imágenes** | ImageKit |
| **Estado** | Zustand (carrito) |
| **Validación** | Zod |
| **Paquete** | pnpm |

---

## Estructura de Directorios

```
pideloyaa/
├── .agents/                  # Skills de agentes
├── .freebuff/                # Project ID Freebuff
├── app/                      # Rutas Next.js (App Router)
├── components/               # Componentes React
├── lib/                      # Lógica de negocio, API, hooks, validaciones
├── node_modules/             # Dependencias
├── public/                   # Archivos estáticos
├── supabase/                 # Configuración y migraciones de Supabase
├── types/                    # Definiciones de tipos TypeScript
├── proxy.ts                  # Middleware de autenticación/rutas
├── next.config.ts            # Configuración de Next.js
├── package.json              # Dependencias del proyecto
├── tsconfig.json             # Configuración TypeScript
├── postcss.config.mjs        # Configuración PostCSS
├── eslint.config.mjs         # Configuración ESLint
├── components.json           # Configuración shadcn/ui
└── pnpm-workspace.yaml       # Configuración pnpm
```

---

## Archivos de Configuración Raíz

| Archivo | Descripción |
|---|---|
| `package.json` | Dependencias y scripts del proyecto (`dev`, `build`, `start`, `lint`, `typecheck`) |
| `pnpm-lock.yaml` | Lockfile de pnpm |
| `pnpm-workspace.yaml` | Configuración de workspace pnpm |
| `tsconfig.json` | Configuración de TypeScript |
| `next.config.ts` | Configuración de Next.js |
| `postcss.config.mjs` | Configuración de PostCSS (Tailwind v4) |
| `eslint.config.mjs` | Configuración de ESLint |
| `components.json` | Configuración de shadcn/ui (estilo base-rhea, neutral) |
| `proxy.ts` | Middleware de autenticación y control de acceso por roles |
| `.env` | Variables de entorno (Supabase, ImageKit) |
| `.env.example` | Plantilla de variables de entorno |
| `.gitignore` | Archivos ignorados por Git |
| `AGENTS.md` | Reglas para agentes Next.js |
| `CLAUDE.md` | Instrucciones para Claude |
| `next-env.d.ts` | Tipos generados por Next.js |
| `skills-lock.json` | Lock de skills instalados |

---

## app/ — Rutas y Páginas

### Layouts Raíz

| Archivo | Función |
|---|---|
| `app/layout.tsx` | Layout raíz de la aplicación |
| `app/globals.css` | Estilos globales (Tailwind) |
| `app/not-found.tsx` | Página 404 |

### (auth)/ — Autenticación

| Ruta | Archivo | Descripción |
|---|---|---|
| `/login` | `app/(auth)/login/page.tsx` | Página de login |
| `/login/admin` | `app/(auth)/login/admin/page.tsx` | Login de administrador |
| `/login/equipo` | `app/(auth)/login/equipo/page.tsx` | Login de equipo |
| `/registro` | `app/(auth)/registro/page.tsx` | Registro de usuarios |
| — | `app/(auth)/layout.tsx` | Layout de autenticación |

### (public)/ — Páginas Públicas

| Ruta | Archivo | Descripción |
|---|---|---|
| `/` | `app/(public)/page.tsx` | Landing page |
| `/buscar` | `app/(public)/buscar/page.tsx` | Búsqueda de restaurantes/productos |
| `/privacidad` | `app/(public)/privacidad/page.tsx` | Política de privacidad |
| `/terminos` | `app/(public)/terminos/page.tsx` | Términos y condiciones |
| `/productos/[id]` | `app/(public)/productos/[id]/page.tsx` | Detalle de producto |
| `/restaurantes` | `app/(public)/restaurantes/page.tsx` | Listado de restaurantes |
| `/restaurantes/[slug]` | `app/(public)/restaurantes/[slug]/page.tsx` | Perfil de restaurante |
| — | `app/(public)/layout.tsx` | Layout público |

### admin/ — Panel de Administración

| Ruta | Archivo | Descripción |
|---|---|---|
| `/admin` | `app/admin/page.tsx` | Dashboard principal |
| `/admin/categorias` | `app/admin/categorias/page.tsx` | Gestión de categorías |
| `/admin/configuracion` | `app/admin/configuracion/page.tsx` | Configuración general |
| `/admin/pedidos` | `app/admin/pedidos/page.tsx` | Gestión de pedidos |
| `/admin/perfil` | `app/admin/perfil/page.tsx` | Perfil de admin |
| `/admin/productos` | `app/admin/productos/page.tsx` | Gestión de productos |
| `/admin/repartidores` | `app/admin/repartidores/page.tsx` | Gestión de repartidores |
| `/admin/reportes` | `app/admin/reportes/page.tsx` | Reportes y estadísticas |
| `/admin/restaurantes` | `app/admin/restaurantes/page.tsx` | Gestión de restaurantes |
| `/admin/usuarios` | `app/admin/usuarios/page.tsx` | Gestión de usuarios |
| — | `app/admin/layout.tsx` | Layout del admin |
| — | `app/admin/loading.tsx` | Estado de carga del admin |

### cliente/ — Panel del Cliente

| Ruta | Archivo | Descripción |
|---|---|---|
| `/cliente` | `app/cliente/page.tsx` | Dashboard del cliente |
| `/cliente/carrito` | `app/cliente/carrito/page.tsx` | Carrito de compras |
| `/cliente/direcciones` | `app/cliente/direcciones/page.tsx` | Gestión de direcciones |
| `/cliente/favoritos` | `app/cliente/favoritos/page.tsx` | Restaurantes favoritos |
| `/cliente/pedidos` | `app/cliente/pedidos/page.tsx` | Historial de pedidos |
| `/cliente/pedidos/[id]` | `app/cliente/pedidos/[id]/page.tsx` | Detalle de pedido |
| `/cliente/perfil` | `app/cliente/perfil/page.tsx` | Perfil del cliente |
| `/cliente/restaurantes/[slug]` | `app/cliente/restaurantes/[slug]/page.tsx` | Perfil de restaurante (cliente) |
| — | `app/cliente/layout.tsx` | Layout del cliente |
| — | `app/cliente/loading.tsx` | Estado de carga del cliente |

### restaurante/ — Panel del Restaurante

| Ruta | Archivo | Descripción |
|---|---|---|
| `/restaurante` | `app/restaurante/page.tsx` | Dashboard del restaurante |
| `/restaurante/categorias` | `app/restaurante/categorias/page.tsx` | Gestión de categorías propias |
| `/restaurante/horarios` | `app/restaurante/horarios/page.tsx` | Horarios de atención |
| `/restaurante/negocio` | `app/restaurante/negocio/page.tsx` | Info del negocio |
| `/restaurante/perfil` | `app/restaurante/perfil/page.tsx` | Perfil del restaurante |
| `/restaurante/productos` | `app/restaurante/productos/page.tsx` | Listado de productos |
| `/restaurante/productos/nuevo` | `app/restaurante/productos/nuevo/page.tsx` | Crear producto |
| — | `app/restaurante/layout.tsx` | Layout del restaurante |
| — | `app/restaurante/loading.tsx` | Estado de carga |

### repartidor/ — Panel del Repartidor

| Ruta | Archivo | Descripción |
|---|---|---|
| `/repartidor` | `app/repartidor/page.tsx` | Dashboard del repartidor |
| `/repartidor/disponibles` | `app/repartidor/disponibles/page.tsx` | Pedidos disponibles |
| `/repartidor/historial` | `app/repartidor/historial/page.tsx` | Historial de entregas |
| `/repartidor/pedidos` | `app/repartidor/pedidos/page.tsx` | Pedidos asignados |
| `/repartidor/pedidos/[id]` | `app/repartidor/pedidos/[id]/page.tsx` | Detalle de entrega |
| `/repartidor/perfil` | `app/repartidor/perfil/page.tsx` | Perfil del repartidor |
| `/repartidor/ubicacion` | `app/repartidor/ubicacion/page.tsx` | Ubicación/gps |
| — | `app/repartidor/layout.tsx` | Layout del repartidor |
| — | `app/repartidor/loading.tsx` | Estado de carga |

### api/ — API REST (v1)

| Recurso | Rutas | Método |
|---|---|---|
| **Auth** | `app/api/auth/callback/route.ts` | GET (callback de Supabase) |
| **Upload** | `app/api/upload/route.ts` | POST (subida de imágenes) |
| **Addresses** | `app/api/v1/addresses/route.ts` | GET, POST |
| | `app/api/v1/addresses/[id]/route.ts` | GET, PUT, DELETE |
| **Categories** | `app/api/v1/categories/route.ts` | GET, POST |
| | `app/api/v1/categories/[id]/route.ts` | GET, PUT, DELETE |
| **Deliveries** | `app/api/v1/deliveries/route.ts` | GET, POST |
| | `app/api/v1/deliveries/[orderId]/accept/route.ts` | POST |
| | `app/api/v1/deliveries/[orderId]/advance/route.ts` | POST |
| **Orders** | `app/api/v1/orders/route.ts` | GET, POST |
| | `app/api/v1/orders/[id]/route.ts` | GET, PUT, DELETE |
| **Products** | `app/api/v1/products/route.ts` | GET, POST |
| | `app/api/v1/products/[id]/route.ts` | GET, PUT, DELETE |
| **Profiles** | `app/api/v1/profiles/route.ts` | GET, POST |
| | `app/api/v1/profiles/[id]/route.ts` | GET, PUT, DELETE |
| **Restaurants** | `app/api/v1/restaurants/route.ts` | GET, POST |
| | `app/api/v1/restaurants/[id]/route.ts` | GET, PUT, DELETE |

### Otras Rutas

| Ruta | Archivo | Descripción |
|---|---|---|
| `/establecer-contrasena` | `app/establecer-contrasena/page.tsx` | Establecer contraseña (post registro) |

---

## components/ — Componentes React

### features/ — Componentes por Módulo

#### addresses/ — Direcciones
| Componente | Descripción |
|---|---|
| `AddressCard.tsx` | Tarjeta de dirección |
| `AddressForm.tsx` | Formulario de dirección |
| `AddressFormDialog.tsx` | Diálogo de formulario de dirección |
| `AddressMapPicker.tsx` | Selector de ubicación en mapa |
| `AddressViewDialog.tsx` | Diálogo de vista de dirección |
| `DeleteAddressDialog.tsx` | Diálogo eliminar dirección |

#### admin/ — Administración
| Componente | Descripción |
|---|---|
| `AdminDashboardCharts.tsx` | Gráficos Ventas y Entregas con filtros |
| `ConfirmDialog.tsx` | Diálogo de confirmación |
| `CustomerTable.tsx` | Tabla de usuarios/clientes del admin |
| `DashboardCards.tsx` | Tarjetas del dashboard admin |
| `DeliveryRowActions.tsx` | Acciones de fila de repartidor |
| `EditDeliveryDialog.tsx` | Diálogo editar repartidor |
| `EditRestaurantDialog.tsx` | Diálogo editar restaurante |
| `RecentOrdersTable.tsx` | Tabla de pedidos recientes |
| `RestaurantRowActions.tsx` | Acciones de fila de restaurante |
| `RestaurantTable.tsx` | Tabla de restaurantes |
| `RowActions.tsx` | Acciones genéricas de fila (Edit/Delete opcionales) |
| `UserRowActions.tsx` | Acciones de fila de usuario (ver/eliminar) |
| `ViewUserDialog.tsx` | Diálogo de inspección de usuario |

#### auth/ — Autenticación
| Componente | Descripción |
|---|---|
| `PasswordLoginForm.tsx` | Formulario de login con contraseña |
| `SetPasswordForm.tsx` | Formulario para establecer contraseña |

#### cart/ — Carrito
| Componente | Descripción |
|---|---|
| `CartBar.tsx` | Barra del carrito |
| `CartClient.tsx` | Componente del carrito (cliente) |

#### categories/ — Categorías
| Componente | Descripción |
|---|---|
| `CategoryManager.tsx` | Gestor de categorías |

#### dashboard/ — Dashboard
| Componente | Descripción |
|---|---|
| `StatCard.tsx` | Tarjeta de estadística |

#### deliveries/ — Delivery
| Componente | Descripción |
|---|---|
| `AcceptOrderButton.tsx` | Botón aceptar pedido |
| `AdvanceStatusButton.tsx` | Botón avanzar estado |
| `AvailableOrdersClient.tsx` | Lista de pedidos disponibles |
| `DeliveryDashboardCards.tsx` | Tarjetas dashboard repartidor |
| `DeliveryDetailsDialog.tsx` | Diálogo de detalles de entrega |
| `DeliveryHistoryTable.tsx` | Tabla de historial de entregas |
| `DeliveryOrderCard.tsx` | Tarjeta de pedido para repartidor |
| `DeliveryOrdersClient.tsx` | Lista de pedidos asignados |

#### home/ — Landing Page
| Componente | Descripción |
|---|---|
| `Features.tsx` | Sección de características |
| `HeroSection.tsx` | Sección hero |
| `HowItWorks.tsx` | Cómo funciona |
| `PublicFooter.tsx` | Footer público |
| `SearchBar.tsx` | Barra de búsqueda |

#### legal/ — Legal
| Componente | Descripción |
|---|---|
| `LegalDocumentLayout.tsx` | Layout de documentos legales |

#### orders/ — Pedidos
| Componente | Descripción |
|---|---|
| `CancelOrderButton.tsx` | Botón cancelar pedido |
| `OrderDetailsDialog.tsx` | Diálogo de detalles del pedido |
| `OrdersListClient.tsx` | Lista de pedidos del cliente |
| `OrderStatusBadge.tsx` | Badge de estado de pedido |
| `OrderStatusSection.tsx` | Sección de estado del pedido |
| `OrderStatusTimeline.tsx` | Línea de tiempo del pedido |

#### products/ — Productos
| Componente | Descripción |
|---|---|
| `FeaturedProductCard.tsx` | Tarjeta de producto destacado |
| `ProductEditDialog.tsx` | Diálogo editar producto |
| `ProductForm.tsx` | Formulario de producto |
| `ProductOrderCard.tsx` | Tarjeta de producto para pedido |
| `ProductRowActions.tsx` | Acciones de fila de producto |

#### profile/ — Perfil
| Componente | Descripción |
|---|---|
| `ProfileForm.tsx` | Formulario de perfil |

#### registration/ — Registro
| Componente | Descripción |
|---|---|
| `DeliveryRegisterForm.tsx` | Formulario registro repartidor |
| `JoinSection.tsx` | Sección "Únete" |
| `RegistrationForms.tsx` | Contenedor de formularios de registro |
| `RestaurantRegisterForm.tsx` | Formulario registro restaurante |
| `shared/*` | Campos y helpers compartidos del formulario |

#### restaurants/ — Restaurantes
| Componente | Descripción |
|---|---|
| `BusinessInfoForm.tsx` | Formulario info del negocio |
| `BusinessStatusSwitch.tsx` | Interruptor abierto/cerrado |
| `DailySalesChart.tsx` | Gráfico de ventas por día del dashboard |
| `ImageUploader.tsx` | Subidor de imágenes |
| `LogoUploader.tsx` | Subidor de logo |
| `RestaurantCard.tsx` | Tarjeta de restaurante |
| `RestaurantDashboardCards.tsx` | Tarjetas dashboard restaurante |
| `RestaurantDashboardCharts.tsx` | Gráficos del dashboard restaurante |
| `RestaurantHoursForm.tsx` | Formulario de horarios |
| `RestaurantInfoForm.tsx` | Formulario info del restaurante |
| `RestaurantMenuView.tsx` | Vista de menú del restaurante |
| `RestaurantOpenBanner.tsx` | Banner abierto/cerrado |
| `RestaurantOrdersTable.tsx` | Tabla de pedidos del módulo Pedidos |
| `TopProductsChart.tsx` | Gráfico de productos más vendidos |

#### cliente-home/ — Home del cliente
| Componente | Descripción |
|---|---|
| `ClienteHomeClient.tsx` | Contenido del home del cliente |

### layout/ — Componentes de Layout

| Componente | Descripción |
|---|---|
| `AdminSidebar.tsx` | Sidebar del admin |
| `CustomerHeader.tsx` | Header del cliente |
| `DeliverySidebar.tsx` | Sidebar del repartidor |
| `PageContainer.tsx` | Contenedor de página |
| `PageHeader.tsx` | Encabezado de página |
| `PublicHeader.tsx` | Header público |
| `RestaurantSidebar.tsx` | Sidebar del restaurante |
| `Sidebar.tsx` | Sidebar genérico |
| `SidebarBrand.tsx` | Brand del sidebar |

### shared/ — Componentes Compartidos

| Componente | Descripción |
|---|---|
| `Logo.tsx` | Logo de la aplicación |

### Raíz de components/

| Componente | Descripción |
|---|---|
| `LogoLoop.tsx` | Carrusel de logos animado |

### ui/ — Componentes UI (shadcn/ui)

| Componente | Descripción |
|---|---|
| `alert-dialog.tsx` | Diálogo de alerta |
| `ambient-glow.tsx` | Efecto de brillo ambiental |
| `avatar.tsx` | Avatar |
| `badge.tsx` | Badge/etiqueta |
| `button.tsx` | Botón |
| `card.tsx` | Tarjeta |
| `carousel.tsx` | Carrusel |
| `chart.tsx` | Gráfico |
| `checkbox.tsx` | Checkbox |
| `dialog.tsx` | Diálogo/modal |
| `dropdown-menu.tsx` | Menú desplegable |
| `input.tsx` | Input de texto |
| `label.tsx` | Label |
| `pagination.tsx` | Paginación |
| `scroll-stack.tsx` | Stack con scroll |
| `select.tsx` | Select/dropdown |
| `skeleton.tsx` | Skeleton loader |
| `switch.tsx` | Interruptor |
| `table.tsx` | Tabla |
| `table-pagination.tsx` | Paginación de tablas server-side |
| `tabs.tsx` | Tabs |
| `textarea.tsx` | Textarea |

---

## lib/ — Lógica de Negocio

### Archivos Raíz

| Archivo | Descripción |
|---|---|
| `lib/utils.ts` | Utilidades generales (cn, formateo, etc.) |
| `lib/imagekit-server.ts` | Configuración de ImageKit server-side |
| `lib/pagination.ts` | Helper de paginación server-side |
| `lib/dates.ts` | Utilidades de fechas |

### actions/ — Server Actions

| Archivo | Descripción |
|---|---|
| `lib/actions/addresses.ts` | CRUD de direcciones |
| `lib/actions/admin.ts` | Acciones de administración (aprobar, eliminar, revalidate) |
| `lib/actions/auth.ts` | Acciones de autenticación |
| `lib/actions/categories.ts` | CRUD de categorías |
| `lib/actions/deliveries.ts` | Gestión de entregas |
| `lib/actions/imagekit.ts` | Upload/gestión de imágenes |
| `lib/actions/orders.ts` | CRUD de pedidos |
| `lib/actions/products.ts` | CRUD de productos |
| `lib/actions/profile.ts` | Gestión de perfil |
| `lib/actions/registration.ts` | Registro de usuarios |
| `lib/actions/restaurant-hours.ts` | Gestión de horarios |
| `lib/actions/restaurants.ts` | CRUD de restaurantes |

### admin/ — Helpers de administración

| Archivo | Descripción |
|---|---|
| `lib/admin/remove-restaurant.ts` | Borrado híbrido de restaurante (soft/hard) |

### restaurants/ — Lógica de restaurante

| Archivo | Descripción |
|---|---|
| `lib/restaurants/is-open.ts` | ¿Está abierto el restaurante ahora? |

### api/ — Capa de API

| Archivo | Descripción |
|---|---|
| `lib/api/auth.ts` | Helpers de autenticación API |
| `lib/api/response.ts` | Formateo de respuestas API |

### db/ — Base de Datos

| Archivo | Descripción |
|---|---|
| `lib/db/client.ts` | Cliente Supabase (browser) |
| `lib/db/server.ts` | Cliente Supabase (server-side) |

### hooks/ — Custom Hooks

| Archivo | Descripción |
|---|---|
| `lib/hooks/use-cart.ts` | Hook del carrito (Zustand) |
| `lib/hooks/use-search.ts` | Hook de búsqueda |
| `lib/hooks/use-restaurant-open.ts` | Estado abierto/cerrado del restaurante |
| `lib/hooks/use-realtime-invalidate.ts` | Realtime + revalidación |

### constants/ — Constantes

| Archivo | Descripción |
|---|---|
| `lib/constants/order-status.ts` | Estados de pedido y transiciones |

### validations/ — Schemas Zod

| Archivo | Descripción |
|---|---|
| `lib/validations/address.ts` | Validación de direcciones |
| `lib/validations/category.ts` | Validación de categorías |
| `lib/validations/order.ts` | Validación de pedidos |
| `lib/validations/product.ts` | Validación de productos |
| `lib/validations/profile.ts` | Validación de perfil |
| `lib/validations/registration.ts` | Validación de registro |
| `lib/validations/restaurant.ts` | Validación de restaurantes |

### Directorios

| Directorio | Estado |
|---|---|
| `lib/auth/` | Vacío |
| `lib/theme/` | Vacío |
| `lib/admin/` | Helper de borrado de restaurante |
| `lib/restaurants/` | Helper is-open |

---

## types/ — Definiciones TypeScript

| Archivo | Descripción |
|---|---|
| `types/auth.ts` | Tipos de autenticación |
| `types/database.ts` | Tipos de la base de datos |
| `types/delivery.ts` | Tipos de delivery |
| `types/order.ts` | Tipos de pedidos |
| `types/product.ts` | Tipos de productos |
| `types/restaurant.ts` | Tipos de restaurantes |
| `types/user.ts` | Tipos de usuarios |

---

## public/ — Archivos Estáticos

| Directorio | Contenido |
|---|---|
| `public/icons/` | `logo-pideloya.svg`, `logo-pideloya-dark.svg` |
| `public/images/` | Vacío |
| `public/logos/` | Vacío |
| `public/videos/` | `landing.mp4` |

---

## supabase/ — Base de Datos

### Archivos de Configuración

| Archivo | Descripción |
|---|---|
| `supabase/config.toml` | Configuración de Supabase CLI |
| `supabase/seed.sql` | Datos iniciales de prueba |

### Migraciones (25 archivos)

| Migración | Descripción |
|---|---|
| `20260823171850_create_core_tables.sql` | Tablas principales (users, profiles, restaurants, products, orders, etc.) |
| `20260823172245_rls_policies.sql` | Políticas de Row Level Security |
| `20260823172902_handle_new_user.sql` | Trigger para nuevo usuario |
| `20260824023441_restaurant_members_categories_rls.sql` | RLS para miembros de restaurante y categorías |
| `20260824203727_registration_fields.sql` | Campos de registro |
| `20260828044635_fix_orders_deliveries_rls_recursion.sql` | Fix recursión RLS orders/deliveries |
| `20260828045436_order_items_rls.sql` | RLS para order_items |
| `20260829162152_order_items_product_name.sql` | Snapshot de nombre de producto en order_items |
| `20260830060015_orders_customer_cancel_rls.sql` | RLS cancelación de cliente |
| `20260830062645_profile_column_security.sql` | Seguridad a nivel de columna en profiles |
| `20260911000000_fix_cascade_delete_user.sql` | Fix cascade delete de usuario |
| `20260911100000_restaurant_hours.sql` | Tabla de horarios de restaurante |
| `20260912000000_fix_rls_products_categories.sql` | Fix RLS productos/categorías |
| `20260912132932_imagekit_file_ids.sql` | IDs de archivos ImageKit |
| `20260912135915_restaurant_logos_storage.sql` | Storage de logos de restaurante |
| `20260920201230_products_categories_customer_visibility.sql` | Visibilidad cliente en productos/categorías |
| `20260920231812_addresses_one_per_customer.sql` | Una dirección por cliente |
| `20260922103915_enable_realtime_orders.sql` | Realtime en orders |
| `20260922160419_order_items_image_url.sql` | Snapshot de imagen en order_items |
| `20260923000000_order_items_restaurant_name.sql` | Snapshot de nombre de restaurante en order_items |
| `20260923100000_deliveries_person_set_null.sql` | `deliveries.delivery_person_id` → SET NULL |
| `20260923120000_backfill_order_items_snapshots.sql` | Backfill de snapshots en order_items |
| `20260923130000_profiles_email.sql` | Columna `email` en profiles + sync Auth |
| `20260923130100_orders_customer_set_null.sql` | `orders.customer_id` / `addresses.customer_id` → SET NULL |
| `20260924000000_restaurant_is_open.sql` | `restaurants.is_open` (toggle abierto/cerrado) |

---

## proxy.ts — Middleware de Autenticación

Controla el acceso a las rutas protegidas según el rol del usuario:

| Prefijo de ruta | Rol requerido |
|---|---|
| `/admin` | ADMIN |
| `/cliente` | CUSTOMER |
| `/restaurante` | RESTAURANT |
| `/repartidor` | DELIVERY |

Redirige a `/login` si el usuario no está autenticado o no tiene el rol adecuado.

---

## Resumen de Estadísticas

| Categoría | Cantidad |
|---|---|
| Archivos de configuración raíz | 15 |
| Rutas en `app/` | ~46 archivos |
| Componentes (`components/`) | 90+ total (features + layout + shared + ui) |
| Server Actions (`lib/actions/`) | 12 |
| Módulos en `lib/` | 30+ archivos |
| Migraciones Supabase | 25 |
| Definiciones de tipos | 7 |
| Roles de usuario | 4 (Cliente, Restaurante, Repartidor, Admin) |

---

## Arquitectura por Roles

```
┌─────────────────────────────────────────────────┐
│                    USUARIO                      |
├─────────┬──────────┬───────────┬────────────────┤
│ Cliente │ Restaurante │ Repartidor │ Admin      │
├─────────┼──────────┼───────────┼────────────────┤
│ /cliente│ /restaurante│ /repartidor│ /admin     │
│ carrito │ productos │ disponibles│ pedidos      │
│ pedidos │ categorías│ historial  │ usuarios     │
│ direcciones│ horarios│ pedidos   │ restaurantes │
│ favoritos│ negocio  │ perfil    │ reportes      │
│ perfil  │ perfil   │ ubicación │ config         │
└─────────┴──────────┴───────────┴────────────────┘
```

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16, React, TypeScript |
| Estilos | Tailwind CSS v4, shadcn/ui |
| Estado | Zustand (carrito) |
| Validación | Zod |
| Backend | Next.js Server Actions + API Routes |
| Base de datos | Supabase (PostgreSQL) |
| Autenticación | Supabase Auth |
| Imágenes | ImageKit |
| Paquete | pnpm |
| Linting | ESLint 9 + typecheck (`tsc --noEmit`) |
