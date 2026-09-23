import type { MouseEvent } from 'react'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { buildPageItems } from '@/lib/pagination'
import { cn } from '@/lib/utils'

type ClientMode = {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  basePath?: string
}

type ServerMode = {
  page: number
  pageCount: number
  basePath: string
  onPageChange?: never
}

export type TablePaginationProps = ClientMode | ServerMode

function disabledClassName(hidden: boolean) {
  return cn(hidden && 'pointer-events-none opacity-50')
}

export function TablePagination({
  page,
  pageCount,
  basePath,
  onPageChange,
}: TablePaginationProps) {
  if (pageCount <= 1) return null

  const items = buildPageItems(page, pageCount)

  const isOutOfRange = (target: number) => target < 1 || target > pageCount

  const linkProps = (target: number, href: string) => ({
    href: onPageChange ? '#' : href,
    'aria-disabled': isOutOfRange(target) || undefined,
    className: disabledClassName(isOutOfRange(target)),
    onClick: onPageChange
      ? (e: MouseEvent<HTMLAnchorElement>) => {
          e.preventDefault()
          if (!isOutOfRange(target)) onPageChange(target)
        }
      : undefined,
  })

  return (
    <Pagination className="mt-4">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            {...linkProps(page - 1, basePath ? `${basePath}?page=${page - 1}` : '#')}
            text="Anterior"
          />
        </PaginationItem>

        {items.map((item) =>
          item === 'ellipsis' ? (
            <PaginationItem key={`ellipsis-${page}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink
                {...linkProps(item, basePath ? `${basePath}?page=${item}` : '#')}
                isActive={item === page}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          )
        )}

        <PaginationItem>
          <PaginationNext
            {...linkProps(page + 1, basePath ? `${basePath}?page=${page + 1}` : '#')}
            text="Siguiente"
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}