const THREAT_LEVEL_MAP: Record<string, string> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
  none: 'NONE',
};

export function mapThreatCategoriesToDbLevels(threatCategories: string[]): string[] {
  return Array.from(
    new Set(
      threatCategories
        .flatMap((category) => {
          const mapped = THREAT_LEVEL_MAP[category] || category.toUpperCase();
          if (mapped === 'MEDIUM' || mapped === 'MED') {
            return ['MEDIUM', 'MED'];
          }
          return [mapped];
        })
        .filter(Boolean)
    )
  );
}
