// Simple pagination helpers
export function paginate(items, pageIndex, pageSize) {
  const start = pageIndex * pageSize;
  const end = start + pageSize;
  return {
    items: items.slice(start, end),
    pageIndex,
    pageSize,
    totalItems: items.length,
    totalPages: Math.ceil(items.length / pageSize),
    hasNextPage: end < items.length,
    hasPrevPage: pageIndex > 0,
  };
}
