// Display helpers shared across pages.

export function capitalizeFirst(value: string): string {
  const trimmed = value.trim();
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : trimmed;
}

export function formatConditions(conditions?: string[] | null, fallback = 'N/A'): string {
  const formatted = (conditions || []).map(capitalizeFirst).filter(Boolean);
  return formatted.length ? formatted.join(', ') : fallback;
}
