import type { Page } from '@/api/types';

/** The API caps a page at 200; asking for more is rejected. */
const MAX_PAGE_SIZE = 200;

/** Stops a mistyped filter from pulling an unbounded table into the browser. */
const MAX_RECORDS = 10_000;

/**
 * Walks every page of a list endpoint and returns the whole set.
 *
 * Two screens genuinely need all matching rows rather than the visible page:
 * the report builder, which exports what the user filtered, and the period
 * filter, which the API does not yet support (BACKLOG B1) and is therefore
 * applied here. The first page decides how many more are needed, and the rest
 * are fetched together instead of one after another.
 */
export async function fetchAll<T, P extends object>(
  list: (params: P & { page: number; size: number }) => Promise<Page<T>>,
  params: P,
): Promise<{ items: T[]; total: number; truncated: boolean }> {
  const first = await list({ ...params, page: 1, size: MAX_PAGE_SIZE });
  const wanted = Math.min(first.total, MAX_RECORDS);
  const pages = Math.min(first.pages, Math.ceil(wanted / MAX_PAGE_SIZE));

  if (pages <= 1) {
    return { items: first.items, total: first.total, truncated: first.total > wanted };
  }

  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, index) =>
      list({ ...params, page: index + 2, size: MAX_PAGE_SIZE }),
    ),
  );

  return {
    items: [first, ...rest].flatMap((page) => page.items),
    total: first.total,
    truncated: first.total > wanted,
  };
}
