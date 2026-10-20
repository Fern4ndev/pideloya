<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md - PideloYa

## Visión general

Este proyecto es una plataforma de delivery y pedidos para Abancay, Apurímac, construida con Next.js 16 en App Router, TypeScript, Tailwind CSS v4, Supabase y shadcn/ui. El código debe seguir la arquitectura ya existente y priorizar cambios pequeños, consistentes y reutilizables.

## Stack principal

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Supabase (Auth + PostgreSQL + Storage)
- ImageKit para imágenes
- Zustand para estado del carrito
- Zod para validación
- pnpm como gestor de paquetes

## Comandos de desarrollo

```bash
pnpm install
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm typecheck
```

## Estructura clave del repositorio

```text
app/              # Rutas y layouts de Next.js (App Router)
components/       # UI reutilizable y componentes feature-oriented
lib/              # Lógica de negocio, utilidades, validaciones, hooks, actions
types/            # Tipos TypeScript compartidos
supabase/         # Configuración, migraciones y seed
public/           # Assets estáticos
scripts/          # Scripts de verificación y utilidades
```

## Convenciones importantes para agentes

1. Mantener el patrón actual del proyecto.
   - Preferir componentes y estructuras ya existentes en `components/` y `lib/`.
   - Reusar utilidades antes de duplicar lógica.

2. Evitar cambios amplios o reescrituras innecesarias.
   - Hacer cambios mínimos, específicos y alineados con el problema que se está corrigiendo.
   - No refactorizar áreas no relacionadas.

3. Respetar la arquitectura de Next.js.
   - Usar Server Components por defecto.
   - Solo añadir `use client` si es estrictamente necesario para interactividad.
   - Mantener los server actions, data fetching y acceso a Supabase en `lib/` o en rutas API apropiadas.

4. Mantener consistencia de estilos.
   - Usar Tailwind y componentes existentes de shadcn/ui cuando haya patrones válidos.
   - Preferir clases y tokens ya usados por el diseño del proyecto antes de crear estilos nuevos.

5. Seguridad y validación.
   - Validar inputs con Zod o validadores ya existentes cuando corresponda.
   - No introducir lógica que bypassée controles de acceso o autenticación.
   - Mantener compatibilidad con Supabase y con los tipos del proyecto.

6. Nombres y documentación.
   - Mantener nombres claros y descriptivos, en español cuando el dominio lo requiera.
   - Documentar cambios complejos cuando no sean evidentes por el código.

## Rutas principales

- `app/(public)` para páginas públicas y landing
- `app/(auth)` para autenticación
- `app/admin` para administración
- `app/cliente` para el panel de clientes
- `app/restaurante` para restaurante
- `app/repartidor` para repartidores
- `app/api` para endpoints y callbacks

## Herramientas y plantillas

- `components.json` define la configuración de shadcn/ui
- `eslint.config.mjs` define la configuración de lint
- `tsconfig.json` define las reglas de TypeScript
- `proxy.ts` y la lógica de rutas deben respetar los permisos y guardas del sistema

## Validación antes de cerrar cambios

Antes de concluir una tarea, ejecutar la verificación mínima que aplique:

```bash
pnpm lint
pnpm typecheck
```

Si el cambio afecta solo una parte y se puede probar de manera directa, preferir una comprobación específica y puntual. No se debe reportar trabajo como completado sin evidencia de verificación.

## Reglas para agentes de IA

- No inventar features ni comportamientos no presentes en el proyecto.
- No introducir dependencias nuevas sin necesidad justificada.
- No cambiar archivos generados o configuraciones globales salvo que el trabajo lo requiera explícitamente.
- Si se modifica una parte del sistema, revisar el impacto inmediato en rutas, componentes y tipos relacionados.
- Priorizar soluciones que sigan el estilo del código existente y los patrones del negocio.

## Nota final

La intención de este archivo es orientar a agentes y asistentes de código para que trabajen en armonía con la estructura real del repositorio, sin romper la lógica de negocio ni los patrones de Next.js, Supabase y UI ya establecidos.
