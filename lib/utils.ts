import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const INTERNAL_PATH_FALLBACK = "/cliente"

/**
 * Valida un parámetro `next` de redirección (open redirect): SOLO rutas
 * internas, absolutas y de un solo slash inicial. Rechaza `//evil.com`
 * (protocol-relative → navegador sale del dominio), `https://evil.com`,
 * `/\\evil.com` (los navegadores normalizan la barra invertida a slash) y
 * rutas de protocolo tipo `javascript:`. Todo lo demás cae al fallback.
 */
export function safeInternalPath(
  next: string | null | undefined,
  fallback: string = INTERNAL_PATH_FALLBACK
): string {
  if (!next) return fallback
  if (!next.startsWith("/")) return fallback
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback
  return next
}
