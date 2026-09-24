# PideloYa

Plataforma de pedidos y delivery para Abancay, Apurimac.

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase (Auth + PostgreSQL + Storage)

## Desarrollo

```bash
pnpm install
pnpm dev
```

## Scripts

```bash
pnpm dev         # servidor de desarrollo
pnpm build       # build de producción
pnpm start       # servir el build
pnpm lint        # ESLint
pnpm typecheck   # TypeScript (tsc --noEmit)
```

## Variables de entorno

Copiar `.env.example` a `.env` y completar los valores de Supabase e ImageKit.
