import { z } from "zod";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

const pageNumberSchema = z
  .string()
  .regex(/^\d+$/, "Must be a positive integer");

export const paginationQuerySchema = z.object({
  page: pageNumberSchema.optional(),
  page_size: pageNumberSchema.optional(),
});

export const paginationMetaSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export type ParsedPagination = {
  page: number | null;
  pageSize: number;
};

export function parsePagination(query: PaginationQuery): ParsedPagination {
  if (!query.page) {
    return { page: null, pageSize: DEFAULT_PAGE_SIZE };
  }

  const page = Math.max(1, Number(query.page));
  const requested = query.page_size
    ? Number(query.page_size)
    : DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requested));

  return { page, pageSize };
}

export function buildPaginationMeta(
  total: number,
  page: number | null,
  pageSize: number,
): PaginationMeta {
  if (page === null) {
    return { page: 1, pageSize: total, total, totalPages: 1 };
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return { page, pageSize, total, totalPages };
}
