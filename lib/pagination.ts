export const PAGE_SIZE = 15

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

export function buildPageItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1)
  }

  const items: PageItem[] = [1]

  if (page > 3) items.push('ellipsis')

  const start = Math.max(2, page - 1)
  const end = Math.min(pageCount - 1, page + 1)
  for (let p = start; p <= end; p++) items.push(p)

  if (page < pageCount - 2) items.push('ellipsis')
  items.push(pageCount)

  return items
}