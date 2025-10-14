import { useState } from 'react';
import { Invoice } from '@/types';
import { formatCompactCurrency } from '@/lib/utils';

interface BucketPieChartsProps {
  invoices: Invoice[];
  selectedBucket: string;
  selectedRegion: 'all' | 'phoenix' | 'las-vegas';
}

const COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#6366F1', // indigo
];

interface CompanyData {
  name: string;
  value: number;
  count: number;
}

interface PieSlice {
  data: CompanyData;
  startAngle: number;
  endAngle: number;
  color: string;
}

function PieChart({ data, size = 200 }: { data: CompanyData[]; size?: number }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const radius = size / 2 - 20;
  const centerX = size / 2;
  const centerY = size / 2;

  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  // Calculate pie slices
  const slices: PieSlice[] = [];
  let currentAngle = -90; // Start at top

  data.forEach((item, index) => {
    const percentage = item.value / total;
    const angle = percentage * 360;
    slices.push({
      data: item,
      startAngle: currentAngle,
      endAngle: currentAngle + angle,
      color: COLORS[index % COLORS.length]
    });
    currentAngle += angle;
  });

  // Convert polar coordinates to cartesian
  const polarToCartesian = (angle: number, r: number) => {
    const angleInRadians = (angle * Math.PI) / 180;
    return {
      x: centerX + r * Math.cos(angleInRadians),
      y: centerY + r * Math.sin(angleInRadians)
    };
  };

  // Create SVG path for pie slice
  const createArc = (slice: PieSlice) => {
    const start = polarToCartesian(slice.startAngle, radius);
    const end = polarToCartesian(slice.endAngle, radius);
    const largeArcFlag = slice.endAngle - slice.startAngle > 180 ? 1 : 0;

    return [
      `M ${centerX} ${centerY}`,
      `L ${start.x} ${start.y}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
      'Z'
    ].join(' ');
  };

  return (
    <div className="relative">
      <svg width={size} height={size} className="mx-auto">
        {slices.map((slice, index) => (
          <g key={index}>
            <path
              d={createArc(slice)}
              fill={slice.color}
              stroke="white"
              strokeWidth="2"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer transition-opacity hover:opacity-80"
            />
          </g>
        ))}
      </svg>
      
      {/* Tooltip */}
      {hoveredIndex !== null && (
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-white p-2 border border-gray-200 rounded-lg shadow-lg z-10 pointer-events-none">
          <p className="font-semibold text-gray-900 text-xs whitespace-nowrap">
            {slices[hoveredIndex].data.name}
          </p>
          <p className="text-xs text-gray-600 whitespace-nowrap">
            {formatCompactCurrency(slices[hoveredIndex].data.value)} ({slices[hoveredIndex].data.count} invoice{slices[hoveredIndex].data.count !== 1 ? 's' : ''})
          </p>
        </div>
      )}
    </div>
  );
}

export default function BucketPieCharts({ invoices, selectedBucket, selectedRegion }: BucketPieChartsProps) {
  const getBucketData = (bucketId: string): CompanyData[] => {
    const companyMap = new Map<string, { value: number; count: number }>();

    // Filter by region first
    const regionFilteredInvoices = invoices.filter(inv => {
      if (selectedRegion === 'phoenix') {
        const phoenixBranches = ['Phx - North', 'Phx - SouthWest', 'Phx - SouthEast', 'Corporate'];
        return phoenixBranches.includes(inv.branchName);
      } else if (selectedRegion === 'las-vegas') {
        return inv.branchName?.toLowerCase().includes('vegas') || inv.branchName?.toLowerCase().includes('las vegas');
      }
      return true; // 'all' region
    });

    regionFilteredInvoices.forEach(inv => {
      let includeInvoice = false;
      let amount = 0;

      if (bucketId === 'all' && inv.amountRemaining > 0) {
        includeInvoice = true;
        amount = inv.amountRemaining;
      } else if (bucketId === '1-30' && inv.aging_1_30 > 0) {
        includeInvoice = true;
        amount = inv.aging_1_30;
      } else if (bucketId === '31-60' && inv.aging_31_60 > 0) {
        includeInvoice = true;
        amount = inv.aging_31_60;
      } else if (bucketId === '61-90' && inv.aging_61_90 > 0) {
        includeInvoice = true;
        amount = inv.aging_61_90;
      } else if (bucketId === '91-120' && inv.aging_91_120 > 0) {
        includeInvoice = true;
        amount = inv.aging_91_120;
      } else if (bucketId === '121+' && inv.aging_121_plus > 0) {
        includeInvoice = true;
        amount = inv.aging_121_plus;
      }

      if (includeInvoice) {
        const existing = companyMap.get(inv.companyName) || { value: 0, count: 0 };
        companyMap.set(inv.companyName, {
          value: existing.value + amount,
          count: existing.count + 1
        });
      }
    });

    const data = Array.from(companyMap.entries())
      .map(([name, stats]) => ({
        name,
        value: stats.value,
        count: stats.count
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 companies

    return data;
  };

  const buckets = [
    { id: 'all', label: 'All Outstanding' },
    { id: '1-30', label: '1-30 Days' },
    { id: '31-60', label: '31-60 Days' },
    { id: '61-90', label: '61-90 Days' },
    { id: '91-120', label: '91-120 Days' },
    { id: '121+', label: '121+ Days' }
  ];

  return (
    <div className="mb-6">
      <div className="grid grid-cols-6 gap-4">
        {buckets.map((bucket) => {
          const data = getBucketData(bucket.id);
          const isSelected = selectedBucket === bucket.id;
          
          if (data.length === 0) {
            return (
              <div key={bucket.id} className={`bg-white rounded-lg border p-4 ${
                isSelected ? 'border-blue-500 shadow-md' : 'border-gray-200'
              }`}>
                <h4 className="text-xs font-medium text-gray-600 mb-2 text-center">{bucket.label}</h4>
                <div className="flex items-center justify-center h-40">
                  <p className="text-xs text-gray-400">No data</p>
                </div>
              </div>
            );
          }

          return (
            <div key={bucket.id} className={`bg-white rounded-lg border p-4 ${
              isSelected ? 'border-blue-500 shadow-md' : 'border-gray-200'
            }`}>
              <h4 className="text-xs font-medium text-gray-600 mb-2 text-center">{bucket.label}</h4>
              
              <PieChart data={data} size={180} />
              
              <div className="mt-3 space-y-1 max-h-24 overflow-y-auto">
                {data.slice(0, 5).map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <div 
                      className="w-2 h-2 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <span className="text-gray-700 truncate flex-1" title={entry.name}>
                      {entry.name}
                    </span>
                    <span className="text-gray-500 font-medium whitespace-nowrap">
                      {formatCompactCurrency(entry.value)}
                    </span>
                  </div>
                ))}
                {data.length > 5 && (
                  <div className="text-xs text-gray-400 text-center pt-1">
                    +{data.length - 5} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}