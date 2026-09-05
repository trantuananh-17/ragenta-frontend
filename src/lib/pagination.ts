import { z, type ZodType } from "zod";

/**
 * Both backends answer their admin lists with the same offset-paged envelope:
 * `{ items, total, limit, offset }`. One factory here means a feature declares
 * only the row it actually renders.
 *
 * The one exception is the content catalogue, which pages by number because its
 * public search box does — see `pagedSchema` below.
 */
export function pageSchema<T extends ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
  });
}

export function pagedSchema<T extends ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    pagination: z.object({
      total: z.number(),
      page: z.number(),
      totalPages: z.number(),
      limit: z.number(),
    }),
  });
}

/** URL pages are 1-based; the API takes an offset. This is the only conversion. */
export function toOffset(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

export function totalPages(total: number, limit: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, limit)));
}
