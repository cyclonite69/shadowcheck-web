export function resolveFetchOffset(
  resetOffset: boolean,
  currentOffset: number,
  offsetOverride?: number
): number {
  if (resetOffset) return 0;
  return offsetOverride ?? currentOffset;
}

export function getNextPageOffset(
  currentOffset: number,
  limit: number,
  total: number,
  loading: boolean
): number | null {
  if (loading) return null;
  if (currentOffset + limit >= total) return null;
  return currentOffset + limit;
}
