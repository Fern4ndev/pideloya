export const PAGE_SIZE = 10

export type PaginationState = {
  page: number
  pageCount: number
  start: number
  end: number
}

/**
 * Parsea el parámetro de página de la URL sin conocer el total.
 * Útil para derivar el offset de una query ANTES de tener el count
 * (permite lanzar count y data en paralelo con Promise.all).
 */
export function parsePage(pageParam?: string | string[] | undefined): number {
  const rawPage = Array.isArray(pageParam) ? pageParam[0] : pageParam
  const parsed = Number.parseInt(rawPage ?? '1', 10)
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1
}

export function getPagination(
  total: number,
  pageParam?: string | string[] | undefined
): PaginationState {
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(parsePage(pageParam), pageCount)

  const start = (page - 1) * PAGE_SIZE
  const end = Math.min(page * PAGE_SIZE, total)

  return { page, pageCount, start, end }
}

export type PageItem = number | 'ellipsis'

/**
 * Ventana de paginación con ANCHO ESTABLE: máximo 4 números, sea cual sea
 * el total de páginas (antes crecía hasta 7 números + 2 ellipsis y el control
 * se ensanchaba con los datos).
 *
 *   pageCount <= 4  → todos: 1 2 3 4
 *   resto           → {primera, última, actual, un vecinto hacia el interior
 *                      (la mitad en la que está la página)} con '…' en cada
 *                      hueco de ≥1 página oculta:
 *     p=1, N=10 → 1 2 … 10        p=5, N=10 → 1 … 5 6 … 10
 *     p=9, N=10 → 1 … 8 9 10      p=3, N=6  → 1 … 3 4 … 6
 */
export function buildPageItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 4) {
    return Array.from({ length: pageCount }, (_, i) => i + 1)
  }

  const neighbor = page <= pageCount / 2 ? page + 1 : page - 1
  const numbers = [...new Set([1, pageCount, page, neighbor])]
    .filter((n) => n >= 1 && n <= pageCount)
    .sort((a, b) => a - b)

  const items: PageItem[] = []
  for (const [index, n] of numbers.entries()) {
    if (index > 0 && n - numbers[index - 1] > 1) items.push('ellipsis')
    items.push(n)
  }
  return items
}