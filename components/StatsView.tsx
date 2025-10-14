import { useState } from 'react';
import { Invoice } from '@/types';
import { formatCurrency, formatCompactCurrency } from '@/lib/utils';
import { Ghost } from 'lucide-react';

interface StatsViewProps {
  invoices: Invoice[];
  selectedRegion: 'all' | 'phoenix' | 'las-vegas';
}

interface CompanyStats {
  company: string;
  total: number;
  count: number;
  aging_1_30: number;
  aging_31_60: number;
  aging_61_90: number;
  aging_91_120: number;
  aging_121_plus: number;
  count_1_30: number;
  count_31_60: number;
  count_61_90: number;
  count_91_120: number;
  count_121_plus: number;
  hasGhosting: boolean;
}

export default function StatsView({ invoices, selectedRegion }: StatsViewProps) {
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [selectedProperty, setSelectedProperty] = useState('all');
  const [selectedGhosting, setSelectedGhosting] = useState<'all' | 'ghosting' | 'not-ghosting'>('all');

  // Filter by region first
  const regionFilteredInvoices = invoices.filter(inv => {
    if (selectedRegion === 'phoenix') {
      const phoenixBranches = ['Phx - North', 'Phx - SouthWest', 'Phx - SouthEast', 'Corporate'];
      return phoenixBranches.includes(inv.branchName);
    } else if (selectedRegion === 'las-vegas') {
      return inv.branchName?.toLowerCase().includes('vegas') || inv.branchName?.toLowerCase().includes('las vegas');
    }
    return true;
  });

  // Generate filter options from region-filtered invoices
  const companies = ['all', ...new Set(regionFilteredInvoices.map(inv => inv.companyName).filter(Boolean))].sort((a, b) => {
    if (a === 'all') return -1;
    if (b === 'all') return 1;
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b);
  });

  const properties = ['all', ...new Set(regionFilteredInvoices.map(inv => inv.propertyName).filter(Boolean))].sort((a, b) => {
    if (a === 'all') return -1;
    if (b === 'all') return 1;
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b);
  });

  // Apply additional filters
  const filteredInvoices = regionFilteredInvoices.filter(inv => {
    if (selectedCompany !== 'all' && inv.companyName !== selectedCompany) return false;
    if (selectedProperty !== 'all' && inv.propertyName !== selectedProperty) return false;
    if (selectedGhosting === 'ghosting' && !inv.isGhosting) return false;
    if (selectedGhosting === 'not-ghosting' && inv.isGhosting) return false;
    return true;
  });

  // Calculate company stats
  const companyStatsMap = new Map<string, CompanyStats>();
  
  filteredInvoices.forEach(inv => {
    const existing = companyStatsMap.get(inv.companyName) || {
      company: inv.companyName,
      total: 0,
      count: 0,
      aging_1_30: 0,
      aging_31_60: 0,
      aging_61_90: 0,
      aging_91_120: 0,
      aging_121_plus: 0,
      count_1_30: 0,
      count_31_60: 0,
      count_61_90: 0,
      count_91_120: 0,
      count_121_plus: 0,
      hasGhosting: false
    };

    existing.total += inv.amountRemaining;
    existing.count += 1;
    existing.aging_1_30 += inv.aging_1_30;
    existing.aging_31_60 += inv.aging_31_60;
    existing.aging_61_90 += inv.aging_61_90;
    existing.aging_91_120 += inv.aging_91_120;
    existing.aging_121_plus += inv.aging_121_plus;
    
    // Track counts per aging bucket
    if (inv.aging_1_30 > 0) existing.count_1_30 += 1;
    if (inv.aging_31_60 > 0) existing.count_31_60 += 1;
    if (inv.aging_61_90 > 0) existing.count_61_90 += 1;
    if (inv.aging_91_120 > 0) existing.count_91_120 += 1;
    if (inv.aging_121_plus > 0) existing.count_121_plus += 1;
    
    // If any invoice for this company is ghosting, mark the company as having ghosting
    if (inv.isGhosting) {
      existing.hasGhosting = true;
    }

    companyStatsMap.set(inv.companyName, existing);
  });

  const companyStats = Array.from(companyStatsMap.values());
  
  // Sort by total dollars (highest to lowest)
  const statsByDollars = [...companyStats].sort((a, b) => b.total - a.total);
  
  // Sort by invoice count (highest to lowest)
  const statsByQuantity = [...companyStats].sort((a, b) => b.count - a.count);

  // Calculate aging bucket totals
  const agingTotals = {
    total: 0,
    aging_1_30: 0,
    aging_31_60: 0,
    aging_61_90: 0,
    aging_91_120: 0,
    aging_121_plus: 0
  };

  filteredInvoices.forEach(inv => {
    agingTotals.total += inv.amountRemaining;
    agingTotals.aging_1_30 += inv.aging_1_30;
    agingTotals.aging_31_60 += inv.aging_31_60;
    agingTotals.aging_61_90 += inv.aging_61_90;
    agingTotals.aging_91_120 += inv.aging_91_120;
    agingTotals.aging_121_plus += inv.aging_121_plus;
  });

  // Horizontal flow chart component
  const FlowChart = () => {
    const [hoveredSegment, setHoveredSegment] = useState<{ company: string; value: number; x: number; y: number } | null>(null);
    
    // Get top companies by total outstanding
    const topCompanies = [...companyStats]
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    
    const otherCompanies = [...companyStats]
      .sort((a, b) => b.total - a.total)
      .slice(10);
    
    // Calculate "Other" totals
    const otherTotals = {
      aging_1_30: otherCompanies.reduce((sum, c) => sum + c.aging_1_30, 0),
      aging_31_60: otherCompanies.reduce((sum, c) => sum + c.aging_31_60, 0),
      aging_61_90: otherCompanies.reduce((sum, c) => sum + c.aging_61_90, 0),
      aging_91_120: otherCompanies.reduce((sum, c) => sum + c.aging_91_120, 0),
      aging_121_plus: otherCompanies.reduce((sum, c) => sum + c.aging_121_plus, 0)
    };
    
    const categories = [
      { key: 'aging_1_30', label: '1-30 Days' },
      { key: 'aging_31_60', label: '31-60 Days' },
      { key: 'aging_61_90', label: '61-90 Days' },
      { key: 'aging_91_120', label: '91-120 Days' },
      { key: 'aging_121_plus', label: '121+ Days' }
    ];
    
    const colors = [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
      '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1', '#9CA3AF'
    ];
    
    const chartWidth = 1000;
    const chartHeight = 400;
    const leftMargin = 100;
    const rightMargin = 50;
    const maxHeight = 300;
    const topMargin = 20;
    
    // Find max value for scaling
    const maxValue = Math.max(
      agingTotals.aging_1_30,
      agingTotals.aging_31_60,
      agingTotals.aging_61_90,
      agingTotals.aging_91_120,
      agingTotals.aging_121_plus
    );
    
    // Calculate x positions for each category
    const chartContentWidth = chartWidth - leftMargin - rightMargin;
    const xStep = chartContentWidth / (categories.length - 1);
    
    // Build data structure for each company across all categories
    const companyLayers: { company: string; color: string; points: { x: number; y0: number; y1: number; value: number }[] }[] = [];
    
    // Add "Other" as first layer (bottom)
    const otherPoints = categories.map((cat, index) => {
      const x = leftMargin + index * xStep;
      const value = otherTotals[cat.key as keyof typeof otherTotals];
      const height = (value / maxValue) * maxHeight;
      return { x, y0: topMargin + maxHeight, y1: topMargin + maxHeight - height, value };
    });
    companyLayers.push({ company: 'Other', color: colors[10], points: otherPoints });
    
    // Add each company as a layer
    [...topCompanies].reverse().forEach((company) => {
      const actualIndex = topCompanies.length - 1 - topCompanies.reverse().indexOf(company);
      topCompanies.reverse(); // reverse back
      const points = categories.map((cat, catIndex) => {
        const x = leftMargin + catIndex * xStep;
        const value = company[cat.key as keyof typeof company] as number;
        const height = (value / maxValue) * maxHeight;
        
        // Get the y1 from previous layer
        const prevY = companyLayers[companyLayers.length - 1].points[catIndex].y1;
        return { x, y0: prevY, y1: prevY - height, value };
      });
      companyLayers.push({ company: company.company, color: colors[actualIndex], points });
    });
    
    // Y-axis tick values
    const yAxisTicks = [0, maxValue * 0.25, maxValue * 0.5, maxValue * 0.75, maxValue];
    
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Company Distribution Across Aging Categories</h3>
        <div className="overflow-x-auto relative">
          <svg width={chartWidth} height={chartHeight} className="mx-auto">
            {/* Y-axis */}
            <line 
              x1={leftMargin} 
              y1={topMargin} 
              x2={leftMargin} 
              y2={topMargin + maxHeight} 
              stroke="#9CA3AF" 
              strokeWidth="2"
            />
            
            {/* Y-axis ticks and labels */}
            {yAxisTicks.map((tick, index) => {
              const y = topMargin + maxHeight - (tick / maxValue) * maxHeight;
              return (
                <g key={index}>
                  <line 
                    x1={leftMargin - 5} 
                    y1={y} 
                    x2={leftMargin} 
                    y2={y} 
                    stroke="#9CA3AF" 
                    strokeWidth="2"
                  />
                  <text
                    x={leftMargin - 10}
                    y={y + 4}
                    textAnchor="end"
                    className="text-xs fill-gray-600"
                    style={{ fontSize: '11px' }}
                  >
                    {formatCompactCurrency(tick)}
                  </text>
                  {/* Grid line */}
                  <line 
                    x1={leftMargin} 
                    y1={y} 
                    x2={chartWidth - rightMargin} 
                    y2={y} 
                    stroke="#E5E7EB" 
                    strokeWidth="1"
                    strokeDasharray="4,4"
                  />
                </g>
              );
            })}
            
            {/* Draw area layers */}
            {companyLayers.map((layer, layerIndex) => {
              // Create path for this layer
              let path = '';
              
              // Top line (going right)
              layer.points.forEach((point, idx) => {
                if (idx === 0) {
                  path += `M ${point.x} ${point.y1}`;
                } else {
                  path += ` L ${point.x} ${point.y1}`;
                }
              });
              
              // Bottom line (going left)
              for (let i = layer.points.length - 1; i >= 0; i--) {
                path += ` L ${layer.points[i].x} ${layer.points[i].y0}`;
              }
              
              path += ' Z';
              
              return (
                <path
                  key={layerIndex}
                  d={path}
                  fill={layer.color}
                  opacity={0.85}
                  stroke="#fff"
                  strokeWidth="1"
                  className="cursor-pointer hover:opacity-100 transition-opacity"
                  onMouseEnter={(e) => {
                    // Find which category we're hovering over
                    const rect = e.currentTarget.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const categoryIndex = Math.min(Math.floor((mouseX - leftMargin) / xStep + 0.5), categories.length - 1);
                    const value = layer.points[Math.max(0, categoryIndex)].value;
                    setHoveredSegment({
                      company: layer.company,
                      value,
                      x: e.clientX,
                      y: e.clientY
                    });
                  }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const categoryIndex = Math.min(Math.floor((mouseX - leftMargin) / xStep + 0.5), categories.length - 1);
                    const value = layer.points[Math.max(0, categoryIndex)].value;
                    setHoveredSegment({
                      company: layer.company,
                      value,
                      x: e.clientX,
                      y: e.clientY
                    });
                  }}
                  onMouseLeave={() => setHoveredSegment(null)}
                />
              );
            })}
            
            {/* Category labels and totals */}
            {categories.map((category, index) => {
              const x = leftMargin + index * xStep;
              return (
                <g key={index}>
                  <text
                    x={x}
                    y={topMargin + maxHeight + 20}
                    textAnchor="middle"
                    className="text-xs fill-gray-600 font-medium"
                    style={{ fontSize: '11px' }}
                  >
                    {category.label}
                  </text>
                  <text
                    x={x}
                    y={topMargin + maxHeight + 35}
                    textAnchor="middle"
                    className="text-xs fill-gray-900 font-semibold"
                    style={{ fontSize: '11px' }}
                  >
                    {formatCompactCurrency(agingTotals[category.key as keyof typeof agingTotals])}
                  </text>
                </g>
              );
            })}
          </svg>
          
          {/* Hover tooltip */}
          {hoveredSegment && hoveredSegment.value > 0 && (
            <div 
              className="fixed bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-sm z-50 pointer-events-none"
              style={{ 
                left: hoveredSegment.x + 10, 
                top: hoveredSegment.y - 40 
              }}
            >
              <div className="font-semibold">{hoveredSegment.company}</div>
              <div>{formatCurrency(hoveredSegment.value)}</div>
            </div>
          )}
        </div>
        
        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 justify-center">
          {[...topCompanies].reverse().map((company) => {
            const actualIndex = topCompanies.length - 1 - topCompanies.reverse().indexOf(company);
            topCompanies.reverse(); // reverse back
            return (
              <div key={company.company} className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded" 
                  style={{ backgroundColor: colors[actualIndex], opacity: 0.85 }}
                />
                <span className="text-xs text-gray-700">{company.company}</span>
              </div>
            );
          })}
          {otherCompanies.length > 0 && (
            <div className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded" 
                style={{ backgroundColor: colors[10], opacity: 0.85 }}
              />
              <span className="text-xs text-gray-700">Other ({otherCompanies.length} companies)</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">COMPANY</label>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Companies</option>
              {companies.slice(1).map(company => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">PROPERTY</label>
            <select
              value={selectedProperty}
              onChange={(e) => setSelectedProperty(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Properties</option>
              {properties.slice(1).map(property => (
                <option key={property} value={property}>{property}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">IS GHOSTING</label>
            <select
              value={selectedGhosting}
              onChange={(e) => setSelectedGhosting(e.target.value as 'all' | 'ghosting' | 'not-ghosting')}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="ghosting">TRUE</option>
              <option value="not-ghosting">FALSE</option>
            </select>
          </div>
          <div className="ml-auto text-sm text-gray-600">
            Showing <span className="font-semibold">{filteredInvoices.length}</span> invoices
          </div>
        </div>
      </div>

      {/* Flow Chart */}
      <FlowChart />

      {/* Company Breakdown by Dollars */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Company Breakdown by Dollars</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Company</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Total</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">1-30 Days</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">31-60 Days</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">61-90 Days</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">91-120 Days</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">121+ Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {statsByDollars.slice(0, 20).map((stat) => (
                <tr key={stat.company} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                    <div className="flex items-center gap-2">
                      <span>{stat.company}</span>
                      {stat.hasGhosting && (
                        <div className="p-1 rounded bg-purple-100">
                          <Ghost className="w-4 h-4 text-gray-900" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">${Math.round(stat.total).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">${Math.round(stat.aging_1_30).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">${Math.round(stat.aging_31_60).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">${Math.round(stat.aging_61_90).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">${Math.round(stat.aging_91_120).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">${Math.round(stat.aging_121_plus).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Company Breakdown by Quantity */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Company Breakdown by Invoice Count</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Company</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Total</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">1-30 Days</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">31-60 Days</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">61-90 Days</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">91-120 Days</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">121+ Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {statsByQuantity.slice(0, 20).map((stat) => (
                <tr key={stat.company} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                    <div className="flex items-center gap-2">
                      <span>{stat.company}</span>
                      {stat.hasGhosting && (
                        <div className="p-1 rounded bg-purple-100">
                          <Ghost className="w-4 h-4 text-gray-900" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{stat.count}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">{stat.count_1_30}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">{stat.count_31_60}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">{stat.count_61_90}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">{stat.count_91_120}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">{stat.count_121_plus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}