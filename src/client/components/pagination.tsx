import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/client/components/ui/pagination"

type PaginationControlsProps = {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

type PageItem =
  | { type: "page"; page: number }
  | { type: "ellipsis"; key: string }

function buildPageItems(page: number, totalPages: number): PageItem[] {
  const windowPages = [page - 1, page, page + 1].filter(
    (value) => value >= 1 && value <= totalPages
  )
  const pages = [...new Set([1, ...windowPages, totalPages])].sort(
    (a, b) => a - b
  )

  const items: PageItem[] = []
  let previous = 0
  for (const value of pages) {
    if (previous > 0 && value - previous > 1) {
      items.push({ type: "ellipsis", key: `gap-${previous}` })
    }
    items.push({ type: "page", page: value })
    previous = value
  }
  return items
}

export function PaginationControls({
  page,
  totalPages,
  onPageChange,
  className,
}: PaginationControlsProps) {
  if (totalPages <= 1) {
    return null
  }

  const items = buildPageItems(page, totalPages)

  return (
    <Pagination className={className}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          />
        </PaginationItem>

        {items.map((item) =>
          item.type === "ellipsis" ? (
            <PaginationItem key={item.key}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item.page}>
              <PaginationLink
                isActive={item.page === page}
                aria-label={`Go to page ${item.page}`}
                onClick={() => onPageChange(item.page)}
              >
                {item.page}
              </PaginationLink>
            </PaginationItem>
          )
        )}

        <PaginationItem>
          <PaginationNext
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
