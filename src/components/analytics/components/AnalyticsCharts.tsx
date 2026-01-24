// ===== FILE: src/components/analytics/components/AnalyticsCharts.tsx =====
// PURPOSE: Container component that renders appropriate chart based on card type
// EXTRACTS: renderChart function logic from lines 595-987 in original AnalyticsPage.tsx

import React from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '../hooks/useCardLayout';
import { AnalyticsData } from '../hooks/useAnalyticsData';
import {
  TOOLTIP_CONFIG,
  AXIS_CONFIG,
  GRID_CONFIG,
  MARGINS,
  LEGEND_CONFIG,
  PIE_CONFIG,
  BAR_CONFIG,
  LINE_CONFIG,
  CHART_COLORS,
  getResponsiveContainerKey,
} from '../utils/chartConfig';
import {
  formatPieTooltip,
  calculateAxisInterval,
  isValidChartData,
  hasValidPieData,
} from '../utils/chartHelpers';
import { DEBUG_ANALYTICS } from '../utils/chartConstants';

interface AnalyticsChartsProps {
  card: Card;
  data: AnalyticsData;
  loading: boolean;
  error: string | null;
  debouncedFilterState: any;
  onMouseDown: (e: React.MouseEvent, cardId: number, mode?: 'move' | 'resize') => void;
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({
  card,
  data,
  loading,
  error,
  debouncedFilterState,
  onMouseDown,
}) => {
  const height = card.h - 50; // for content div height

  if (loading && [1, 2, 3, 4, 8].includes(card.id)) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-slate-200" />
          Loading analytics...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <div className="w-full rounded-lg border border-red-500/40 bg-red-900/20 px-3 py-2 text-center text-xs text-red-200">
          {error}
        </div>
      </div>
    );
  }

  const renderEmptyState = (message = 'No data available') => {
    const isAllTime = !debouncedFilterState?.enabled?.timeframe;
    const fullMessage = isAllTime ? `${message} (all time)` : message;
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-xs">
        {fullMessage}
      </div>
    );
  };

  switch (card.type) {
    case 'network-types':
      if (DEBUG_ANALYTICS) {
        console.info('[analytics] rendering network-types pie:', {
          timeframeEnabled: debouncedFilterState?.enabled?.timeframe,
          dataLength: data.networkTypes?.length,
          data: data.networkTypes,
          containerHeight: height,
          dataIsArray: Array.isArray(data.networkTypes),
          hasValidData:
            data.networkTypes &&
            data.networkTypes.length > 0 &&
            data.networkTypes.some((item) => item.value > 0),
        });
      }
      if (!hasValidPieData(data.networkTypes)) {
        if (DEBUG_ANALYTICS) {
          console.info('Network types data empty, null, or not array:', data.networkTypes);
        }
        return renderEmptyState();
      }
      // Filter out any items with invalid values
      const validNetworkData = data.networkTypes.filter(
        (item) => item && typeof item.value === 'number' && !isNaN(item.value) && item.value > 0
      );
      if (validNetworkData.length === 0) {
        if (DEBUG_ANALYTICS) {
          console.info('No valid network types data after filtering:', data.networkTypes);
        }
        return renderEmptyState();
      }
      return (
        <div className="h-[240px] w-full">
          <ResponsiveContainer
            width="100%"
            height="100%"
            key={`network-types-${validNetworkData.length}-${debouncedFilterState?.enabled?.timeframe ? 'filtered' : 'all'}`}
          >
            <PieChart>
              <Pie
                data={validNetworkData}
                cx="50%"
                cy="45%"
                innerRadius="45%"
                outerRadius="70%"
                paddingAngle={2}
                dataKey="value"
                animationDuration={300}
              >
                {validNetworkData.map((entry, idx) => (
                  <Cell key={`cell-${idx}-${entry.name}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                {...TOOLTIP_CONFIG}
                formatter={(value, name, props) => {
                  const total = validNetworkData.reduce((sum, item) => sum + item.value, 0);
                  return formatPieTooltip(value as number, name as string, total);
                }}
              />
              <Legend {...LEGEND_CONFIG} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    case 'signal':
      if (!isValidChartData(data.signalStrength)) return renderEmptyState();
      return (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.signalStrength} margin={MARGINS.withBottomLabel}>
              <CartesianGrid {...GRID_CONFIG} />
              <XAxis
                dataKey="range"
                tick={AXIS_CONFIG.tick}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={AXIS_CONFIG.tick} />
              <Tooltip {...TOOLTIP_CONFIG} />
              <Bar dataKey="count" fill={CHART_COLORS.signalStrength} {...BAR_CONFIG} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    case 'security':
      if (DEBUG_ANALYTICS) {
        console.info('[analytics] rendering security pie:', {
          timeframeEnabled: debouncedFilterState?.enabled?.timeframe,
          dataLength: data.security?.length,
          data: data.security,
          containerHeight: height,
          dataIsArray: Array.isArray(data.security),
          hasValidData:
            data.security &&
            data.security.length > 0 &&
            data.security.some((item) => item.value > 0),
        });
      }
      if (!hasValidPieData(data.security)) {
        if (DEBUG_ANALYTICS) {
          console.info('Security data empty, null, or not array:', data.security);
        }
        return renderEmptyState();
      }
      // Filter out any items with invalid values
      const validSecurityData = data.security.filter(
        (item) => item && typeof item.value === 'number' && !isNaN(item.value) && item.value > 0
      );
      if (validSecurityData.length === 0) {
        if (DEBUG_ANALYTICS) {
          console.info('No valid security data after filtering:', data.security);
        }
        return renderEmptyState();
      }
      return (
        <div className="h-[240px] w-full">
          <ResponsiveContainer
            width="100%"
            height="100%"
            key={`security-${validSecurityData.length}-${debouncedFilterState?.enabled?.timeframe ? 'filtered' : 'all'}`}
          >
            <PieChart>
              <Pie
                data={validSecurityData}
                cx="50%"
                cy="45%"
                innerRadius="45%"
                outerRadius="70%"
                paddingAngle={2}
                dataKey="value"
                animationDuration={300}
              >
                {validSecurityData.map((entry, idx) => (
                  <Cell key={`sec-cell-${idx}-${entry.name}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                {...TOOLTIP_CONFIG}
                formatter={(value, name, props) => {
                  const total = validSecurityData.reduce((sum, item) => sum + item.value, 0);
                  return formatPieTooltip(value as number, name as string, total);
                }}
              />
              <Legend {...LEGEND_CONFIG} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    case 'temporal': {
      if (!isValidChartData(data.temporal)) return renderEmptyState();
      return (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.temporal} margin={MARGINS.default}>
              <CartesianGrid {...GRID_CONFIG} />
              <XAxis dataKey="hour" tick={AXIS_CONFIG.tick} />
              <YAxis tick={AXIS_CONFIG.tick} />
              <Tooltip {...TOOLTIP_CONFIG} />
              <Bar dataKey="count" fill={CHART_COLORS.temporal} {...BAR_CONFIG} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
    case 'radio-time': {
      if (!isValidChartData(data.radioTime)) return renderEmptyState();
      const interval = calculateAxisInterval(data.radioTime.length);
      return (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.radioTime} margin={MARGINS.withBottomLabel}>
              <CartesianGrid {...GRID_CONFIG} />
              <XAxis dataKey="label" tick={AXIS_CONFIG.tick} interval={interval} />
              <YAxis tick={AXIS_CONFIG.tick} />
              <Tooltip {...TOOLTIP_CONFIG} />
              <Legend {...LEGEND_CONFIG} />
              <Line {...LINE_CONFIG} dataKey="WiFi" stroke={CHART_COLORS.radioTime.WiFi} />
              <Line {...LINE_CONFIG} dataKey="BLE" stroke={CHART_COLORS.radioTime.BLE} />
              <Line {...LINE_CONFIG} dataKey="BT" stroke={CHART_COLORS.radioTime.BT} />
              <Line {...LINE_CONFIG} dataKey="LTE" stroke={CHART_COLORS.radioTime.LTE} />
              <Line {...LINE_CONFIG} dataKey="GSM" stroke={CHART_COLORS.radioTime.GSM} />
              <Line {...LINE_CONFIG} dataKey="NR" stroke={CHART_COLORS.radioTime.NR} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }
    case 'threat-distribution':
      if (!isValidChartData(data.threatDistribution)) return renderEmptyState();
      return (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.threatDistribution} margin={MARGINS.withBottomLabel}>
              <CartesianGrid {...GRID_CONFIG} />
              <XAxis
                dataKey="range"
                tick={AXIS_CONFIG.tick}
                label={{
                  value: 'Threat Score Range',
                  position: 'insideBottom',
                  offset: -10,
                  fill: '#94a3b8',
                  fontSize: 10,
                }}
              />
              <YAxis tick={AXIS_CONFIG.tick} />
              <Tooltip {...TOOLTIP_CONFIG} />
              <Bar dataKey="count" fill={CHART_COLORS.threatDistribution} {...BAR_CONFIG} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    case 'threat-trends': {
      if (!isValidChartData(data.threatTrends)) return renderEmptyState();
      const interval = calculateAxisInterval(data.threatTrends.length);
      return (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.threatTrends} margin={MARGINS.withBottomLabel}>
              <CartesianGrid {...GRID_CONFIG} />
              <XAxis dataKey="label" tick={AXIS_CONFIG.tick} interval={interval} />
              <YAxis
                yAxisId="left"
                tick={AXIS_CONFIG.tick}
                label={{
                  value: 'Avg Threat Score',
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#94a3b8',
                  fontSize: 10,
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={AXIS_CONFIG.tick}
                label={{
                  value: 'Threat Count',
                  angle: 90,
                  position: 'insideRight',
                  fill: '#94a3b8',
                  fontSize: 10,
                }}
              />
              <Tooltip {...TOOLTIP_CONFIG} />
              <Legend {...LEGEND_CONFIG} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="avgScore"
                stroke={CHART_COLORS.threatTrends.avgScore}
                strokeWidth={3}
                name="Avg Score"
                dot={{ fill: CHART_COLORS.threatTrends.avgScore, r: 3 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="criticalCount"
                stroke={CHART_COLORS.threatTrends.criticalCount}
                strokeWidth={2}
                name="Critical (80+)"
                dot={{ fill: CHART_COLORS.threatTrends.criticalCount, r: 2 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="highCount"
                stroke={CHART_COLORS.threatTrends.highCount}
                strokeWidth={2}
                name="High (70-79)"
                dot={{ fill: CHART_COLORS.threatTrends.highCount, r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }
    case 'top-networks':
      if (!isValidChartData(data.topNetworks)) return renderEmptyState();
      return (
        <div className="h-[260px] overflow-y-auto space-y-2">
          {data.topNetworks.map((network, idx) => (
            <div
              key={idx}
              className="p-3 bg-slate-800/30 rounded-lg border border-slate-700/20 flex justify-between items-center hover:bg-slate-800/40 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-300 font-mono truncate">
                  {network.bssid}
                </div>
                <div className="text-xs text-slate-400 mt-0.5 truncate">{network.ssid}</div>
              </div>
              <div className="text-sm font-semibold text-blue-400 ml-3">
                {network.observations.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
};

// ===== END FILE =====
