// ===== FILE: src/components/analytics/utils/chartHelpers.ts =====
// PURPOSE: Utility functions for chart rendering and data formatting
// EXTRACTS: Helper functions used across multiple charts

// Calculate percentage for pie chart tooltips
export const calculatePercentage = (value: number, total: number): string => {
  return ((value / total) * 100).toFixed(1);
};

// Format tooltip content for pie charts
export const formatPieTooltip = (value: number, name: string, total: number) => {
  const percent = calculatePercentage(value, total);
  return [`${value.toLocaleString()} (${percent}%)`, name];
};

// Calculate optimal interval for x-axis labels
export const calculateAxisInterval = (dataLength: number, maxLabels: number = 8): number => {
  return Math.max(1, Math.floor(dataLength / maxLabels));
};

// Check if data is valid for rendering
export const isValidChartData = (data: any[]): boolean => {
  return data && Array.isArray(data) && data.length > 0;
};

// Check if pie chart data has valid values
export const hasValidPieData = (data: any[]): boolean => {
  return isValidChartData(data) && data.some((item) => item.value > 0);
};

// Format large numbers with commas
export const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

// Generate responsive container key for forcing re-renders
export const getChartKey = (dataLength: number, filterState: any): string => {
  const isFiltered = filterState?.enabled?.timeframe;
  return `${dataLength}-${isFiltered ? 'filtered' : 'all'}`;
};

// ===== END FILE =====
