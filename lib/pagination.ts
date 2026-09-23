export const PAGE_SIZE = 15

export type PaginationState = {
  page: number
  pageCount: number
  start: number
  end: number
}

export function getPagination(
  total: number,
  pageParam?: string | string[] | undefined
): PaginationState {
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const rawPage = Array.isArray(pageParam) ? pageParam[0] : pageParam
  const parsed = Number.parseInt(rawPage ?? '1', 10)
  const page = Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, pageCount) : 1

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