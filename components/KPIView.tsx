import { useState } from 'react';
import { MonthlySnapshot } from '@/types';
import { formatCurrency, formatCompactCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown, Download } from 'lucide-react';

interface KPIViewProps {
  snapshots: MonthlySnapshot[];
  selectedRegion: 'all' | 'phoenix' | 'las-vegas';
  onCreateSnapshot: () => Promise<boolean>;
}

// Helper function to format date without timezone conversion
function formatLocalDate(dateString: string, options: Intl.DateTimeFormatOptions): string {
  // Parse the date string (YYYY-MM-DD) manually to avoid timezone issues
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', options);
}

export default function KPIView({ snapshots, selectedRegion, onCreateSnapshot }: KPIViewProps) {
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);

  // Filter snapshots by region
  const regionSnapshots = snapshots
    .filter(s => s.region === selectedRegion)
    .sort((a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime());

  const handleCreateSnapshot = async () => {
    setIsCreatingSnapshot(true);
    const success = await onCreateSnapshot();
    setIsCreatingSnapshot(false);
    
    if (success) {
      alert('Snapshot created successfully!');
    }
  };

  // Calculate month-over-month changes
  const getMonthOverMonthChange = (current: number, previous: number) => {
    if (!previous) return null;
    const change = ((current - previous) / previous) * 100;
    return change;
  };

  // Trend Line Chart Component
  const TrendChart = () => {
    if (regionSnapshots.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          No snapshot data available. Create your first snapshot to begin tracking.
        </div>
      );
    }

    const chartData = [...regionSnapshots].reverse().slice(-12); // Last 12 months
    const chartWidth = 1000;
    const chartHeight = 400;
    const padding = { top: 20, right: 50, bottom: 60, left: 80 };
    const plotWidth = chartWidth - padding.left - padding.right;
    const plotHeight = chartHeight - padding.top - padding.bottom;

    // Find max value for scaling
    const maxValue = Math.max(
      ...chartData.map(s => s.total_outstanding),
      1 // Ensure at least 1 to avoid division by zero
    );

    // Calculate points for total outstanding line
    const points = chartData.map((snapshot, index) => {
      // Handle single data point case
      const x = chartData.length === 1 
        ? padding.left + plotWidth / 2 
        : padding.left + (index / (chartData.length - 1)) * plotWidth;
      const y = padding.top + plotHeight - (snapshot.total_outstanding / maxValue) * plotHeight;
      return { x, y, value: snapshot.total_outstanding, date: snapshot.snapshot_date };
    });

    // Create line path
    const linePath = points.map((p, i) => 
      i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
    ).join(' ');

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Total Outstanding - Trend</h3>
        <svg width={chartWidth} height={chartHeight}>
          {/* Y-axis */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={chartHeight - padding.bottom}
            stroke="#9CA3AF"
            strokeWidth="2"
          />
          
          {/* Y-axis labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = padding.top + plotHeight - ratio * plotHeight;
            const value = maxValue * ratio;
            return (
              <g key={i}>
                <line
                  x1={padding.left - 5}
                  y1={y}
                  x2={padding.left}
                  y2={y}
                  stroke="#9CA3AF"
                  strokeWidth="2"
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="text-xs fill-gray-600"
                >
                  {formatCompactCurrency(value)}
                </text>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={chartWidth - padding.right}
                  y2={y}
                  stroke="#E5E7EB"
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />
              </g>
            );
          })}

          {/* X-axis */}
          <line
            x1={padding.left}
            y1={chartHeight - padding.bottom}
            x2={chartWidth - padding.right}
            y2={chartHeight - padding.bottom}
            stroke="#9CA3AF"
            strokeWidth="2"
          />

          {/* X-axis labels */}
          {points.map((point, i) => (
            <g key={i}>
              <line
                x1={point.x}
                y1={chartHeight - padding.bottom}
                x2={point.x}
                y2={chartHeight - padding.bottom + 5}
                stroke="#9CA3AF"
                strokeWidth="2"
              />
              <text
                x={point.x}
                y={chartHeight - padding.bottom + 20}
                textAnchor="middle"
                className="text-xs fill-gray-600"
              >
                {formatLocalDate(point.date, { month: 'short', year: '2-digit' })}
              </text>
            </g>
          ))}

          {/* Line (only draw if more than 1 point) */}
          {points.length > 1 && (
            <path
              d={linePath}
              fill="none"
              stroke="#3B82F6"
              strokeWidth="3"
            />
          )}

          {/* Data points */}
          {points.map((point, i) => (
            <circle
              key={i}
              cx={point.x}
              cy={point.y}
              r="5"
              fill="#3B82F6"
              stroke="white"
              strokeWidth="2"
              className="cursor-pointer hover:r-7"
            />
          ))}
        </svg>
      </div>
    );
  };

  // Aging Buckets Stacked Area Chart
  const AgingTrendChart = () => {
    if (regionSnapshots.length === 0) return null;

    const chartData = [...regionSnapshots].reverse().slice(-12);
    
    // Need at least 2 points for stacked area chart
    if (chartData.length < 2) {
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Aging Buckets - Trend</h3>
          <div className="text-center py-12 text-gray-500">
            Need at least 2 snapshots to show aging trends. Create another snapshot to see the trend.
          </div>
        </div>
      );
    }

    const chartWidth = 1000;
    const chartHeight = 400;
    const padding = { top: 20, right: 50, bottom: 60, left: 80 };
    const plotWidth = chartWidth - padding.left - padding.right;
    const plotHeight = chartHeight - padding.top - padding.bottom;

    const categories = [
      { key: 'aging_1_30', label: '1-30', color: '#3B82F6' },
      { key: 'aging_31_60', label: '31-60', color: '#10B981' },
      { key: 'aging_61_90', label: '61-90', color: '#F59E0B' },
      { key: 'aging_91_120', label: '91-120', color: '#EF4444' },
      { key: 'aging_121_plus', label: '121+', color: '#8B5CF6' }
    ];

    const maxValue = Math.max(
      ...chartData.map(s => s.total_outstanding),
      1 // Ensure at least 1 to avoid division by zero
    );

    // Build stacked areas
    const layers = categories.map(cat => {
      return chartData.map((snapshot, index) => {
        const x = padding.left + (index / (chartData.length - 1)) * plotWidth;
        return {
          x,
          value: snapshot[cat.key as keyof MonthlySnapshot] as number
        };
      });
    });

    // Calculate cumulative heights for stacking
    const stackedLayers = layers.map((layer, layerIndex) => {
      return layer.map((point, pointIndex) => {
        let cumulativeBelow = 0;
        for (let i = 0; i < layerIndex; i++) {
          cumulativeBelow += layers[i][pointIndex].value;
        }
        const y0 = padding.top + plotHeight - (cumulativeBelow / maxValue) * plotHeight;
        const y1 = padding.top + plotHeight - ((cumulativeBelow + point.value) / maxValue) * plotHeight;
        return { ...point, y0, y1 };
      });
    });

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Aging Buckets - Trend</h3>
        <svg width={chartWidth} height={chartHeight}>
          {/* Y-axis */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={chartHeight - padding.bottom}
            stroke="#9CA3AF"
            strokeWidth="2"
          />
          
          {/* Y-axis labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = padding.top + plotHeight - ratio * plotHeight;
            const value = maxValue * ratio;
            return (
              <g key={i}>
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="text-xs fill-gray-600"
                >
                  {formatCompactCurrency(value)}
                </text>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={chartWidth - padding.right}
                  y2={y}
                  stroke="#E5E7EB"
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />
              </g>
            );
          })}

          {/* X-axis */}
          <line
            x1={padding.left}
            y1={chartHeight - padding.bottom}
            x2={chartWidth - padding.right}
            y2={chartHeight - padding.bottom}
            stroke="#9CA3AF"
            strokeWidth="2"
          />

          {/* X-axis labels */}
          {stackedLayers[0].map((point, i) => (
            <g key={i}>
              <text
                x={point.x}
                y={chartHeight - padding.bottom + 20}
                textAnchor="middle"
                className="text-xs fill-gray-600"
              >
                {formatLocalDate(chartData[i].snapshot_date, { month: 'short', year: '2-digit' })}
              </text>
            </g>
          ))}

          {/* Stacked areas */}
          {stackedLayers.map((layer, layerIndex) => {
            let path = '';
            
            // Top line (going right)
            layer.forEach((point, idx) => {
              if (idx === 0) {
                path += `M ${point.x} ${point.y1}`;
              } else {
                path += ` L ${point.x} ${point.y1}`;
              }
            });
            
            // Bottom line (going left)
            for (let i = layer.length - 1; i >= 0; i--) {
              path += ` L ${layer[i].x} ${layer[i].y0}`;
            }
            
            path += ' Z';

            return (
              <path
                key={layerIndex}
                d={path}
                fill={categories[layerIndex].color}
                opacity={0.7}
                stroke="white"
                strokeWidth="1"
              />
            );
          })}
        </svg>

        {/* Legend */}
        <div className="mt-4 flex gap-6 justify-center">
          {categories.map(cat => (
            <div key={cat.key} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: cat.color, opacity: 0.7 }} />
              <span className="text-xs text-gray-700">{cat.label} Days</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Create Snapshot Button */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Monthly KPI Snapshots</h2>
          <p className="text-sm text-gray-600">Track AR performance over time</p>
        </div>
        <button
          onClick={handleCreateSnapshot}
          disabled={isCreatingSnapshot}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {isCreatingSnapshot ? 'Creating...' : 'Create Snapshot'}
        </button>
      </div>

      {/* Summary Cards - Latest vs Previous Month */}
      {regionSnapshots.length >= 2 && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Outstanding', key: 'total_outstanding' },
            { label: 'Invoice Count', key: 'invoice_count' },
            { label: '121+ Days', key: 'aging_121_plus' },
            { label: '91-120 Days', key: 'aging_91_120' }
          ].map(metric => {
            const current = regionSnapshots[0][metric.key as keyof MonthlySnapshot] as number;
            const previous = regionSnapshots[1][metric.key as keyof MonthlySnapshot] as number;
            const change = getMonthOverMonthChange(current, previous);
            const isPositive = change !== null && change > 0;
            const isNegative = change !== null && change < 0;

            return (
              <div key={metric.key} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-sm text-gray-600 mb-1">{metric.label}</div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {metric.key === 'invoice_count' 
                    ? current.toLocaleString()
                    : formatCompactCurrency(current)
                  }
                </div>
                {change !== null && (
                  <div className={`flex items-center gap-1 text-sm ${
                    isPositive ? 'text-red-600' : isNegative ? 'text-green-600' : 'text-gray-600'
                  }`}>
                    {isPositive ? <TrendingUp className="w-4 h-4" /> : isNegative ? <TrendingDown className="w-4 h-4" /> : null}
                    <span>{Math.abs(change).toFixed(1)}% vs last month</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Charts */}
      <TrendChart />
      <AgingTrendChart />

      {/* Historical Data Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Historical Snapshots</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Total</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Count</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">1-30</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">31-60</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">61-90</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">91-120</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">121+</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {regionSnapshots.map((snapshot) => (
                <tr key={snapshot.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                    {formatLocalDate(snapshot.snapshot_date, { 
                      month: 'long', 
                      day: 'numeric',
                      year: 'numeric' 
                    })}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                    {formatCurrency(snapshot.total_outstanding)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">
                    {snapshot.invoice_count}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">
                    {formatCurrency(snapshot.aging_1_30)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">
                    {formatCurrency(snapshot.aging_31_60)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">
                    {formatCurrency(snapshot.aging_61_90)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">
                    {formatCurrency(snapshot.aging_91_120)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">
                    {formatCurrency(snapshot.aging_121_plus)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}