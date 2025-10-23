import React, { useState } from 'react';
import { Invoice } from '@/types';
import { formatCurrency, formatCompactCurrency, formatDate } from '@/lib/utils';
import { Ghost, ChevronDown, ChevronRight, StickyNote } from 'lucide-react';

interface PropertyNote {
  property_name: string;
  note_text: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface StatsViewProps {
  invoices: Invoice[];
  selectedRegion: 'all' | 'phoenix' | 'las-vegas';
  propertyNotes: Map<string, PropertyNote>;
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
  hasTerminated: boolean;
}

interface PropertyStats {
  property: string;
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
  hasTerminated: boolean;
}

export default function StatsView({ invoices, selectedRegion, propertyNotes }: StatsViewProps) {
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [selectedProperty, setSelectedProperty] = useState('all');
  const [selectedGhosting, setSelectedGhosting] = useState<'all' | 'ghosting' | 'not-ghosting'>('all');
  const [hideCurrent, setHideCurrent] = useState(true);
  
  // Collapsible section states
  const [showFlowChart, setShowFlowChart] = useState(true);
  const [showCompanyDollars, setShowCompanyDollars] = useState(false);
  const [showCompanyCount, setShowCompanyCount] = useState(false);
  const [showPropertyDollars, setShowPropertyDollars] = useState(false);
  const [showPropertyCount, setShowPropertyCount] = useState(false);
  
  // Expanded property rows for showing notes and invoice details
  const [expandedProperties, setExpandedProperties] = useState<Set<string>>(new Set());
  
  // Sorting states for company breakdowns
  const [companyDollarsSortColumn, setCompanyDollarsSortColumn] = useState<'total' | 'aging_1_30' | 'aging_31_60' | 'aging_61_90' | 'aging_91_120' | 'aging_121_plus'>('total');
  const [companyDollarsSortDirection, setCompanyDollarsSortDirection] = useState<'asc' | 'desc'>('desc');
  const [companyCountSortColumn, setCompanyCountSortColumn] = useState<'count' | 'count_1_30' | 'count_31_60' | 'count_61_90' | 'count_91_120' | 'count_121_plus'>('count');
  const [companyCountSortDirection, setCompanyCountSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Sorting states for property breakdowns
  const [propertyDollarsSortColumn, setPropertyDollarsSortColumn] = useState<'total' | 'aging_1_30' | 'aging_31_60' | 'aging_61_90' | 'aging_91_120' | 'aging_121_plus'>('total');
  const [propertyDollarsSortDirection, setPropertyDollarsSortDirection] = useState<'asc' | 'desc'>('desc');
  const [propertyCountSortColumn, setPropertyCountSortColumn] = useState<'count' | 'count_1_30' | 'count_31_60' | 'count_61_90' | 'count_91_120' | 'count_121_plus'>('count');
  const [propertyCountSortDirection, setPropertyCountSortDirection] = useState<'asc' | 'desc'>('desc');

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
    if (hideCurrent && inv.pastDue === 0) return false;
    return true;
  });

  const togglePropertyExpanded = (property: string) => {
    setExpandedProperties(prev => {
      const newSet = new Set(prev);
      if (newSet.has(property)) {
        newSet.delete(property);
      } else {
        newSet.add(property);
      }
      return newSet;
    });
  };

  // Sorting handler for Company Breakdown by Dollars
  const handleCompanyDollarsSort = (column: typeof companyDollarsSortColumn) => {
    if (companyDollarsSortColumn === column) {
      // Toggle direction if clicking same column
      setCompanyDollarsSortDirection(companyDollarsSortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      // New column, default to descending
      setCompanyDollarsSortColumn(column);
      setCompanyDollarsSortDirection('desc');
    }
  };

  // Sorting handler for Company Breakdown by Quantity
  const handleCompanyCountSort = (column: typeof companyCountSortColumn) => {
    if (companyCountSortColumn === column) {
      // Toggle direction if clicking same column
      setCompanyCountSortDirection(companyCountSortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      // New column, default to descending
      setCompanyCountSortColumn(column);
      setCompanyCountSortDirection('desc');
    }
  };

  // Sorting handler for Property Breakdown by Dollars
  const handlePropertyDollarsSort = (column: typeof propertyDollarsSortColumn) => {
    if (propertyDollarsSortColumn === column) {
      // Toggle direction if clicking same column
      setPropertyDollarsSortDirection(propertyDollarsSortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      // New column, default to descending
      setPropertyDollarsSortColumn(column);
      setPropertyDollarsSortDirection('desc');
    }
  };

  // Sorting handler for Property Breakdown by Quantity
  const handlePropertyCountSort = (column: typeof propertyCountSortColumn) => {
    if (propertyCountSortColumn === column) {
      // Toggle direction if clicking same column
      setPropertyCountSortDirection(propertyCountSortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      // New column, default to descending
      setPropertyCountSortColumn(column);
      setPropertyCountSortDirection('desc');
    }
  };

  // Sort icon component
  const SortIcon = ({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) => {
    if (!active) {
      return (
        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return direction === 'desc' ? (
      <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    ) : (
      <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    );
  };

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
      hasGhosting: false,
      hasTerminated: false
    };

    existing.total += inv.amountRemaining;
    existing.count += 1;
    existing.aging_1_30 += inv.aging_1_30;
    existing.aging_31_60 += inv.aging_31_60;
    existing.aging_61_90 += inv.aging_61_90;
    existing.aging_91_120 += inv.aging_91_120;
    existing.aging_121_plus += inv.aging_121_plus;
    
    if (inv.aging_1_30 > 0) existing.count_1_30 += 1;
    if (inv.aging_31_60 > 0) existing.count_31_60 += 1;
    if (inv.aging_61_90 > 0) existing.count_61_90 += 1;
    if (inv.aging_91_120 > 0) existing.count_91_120 += 1;
    if (inv.aging_121_plus > 0) existing.count_121_plus += 1;
    
    if (inv.isGhosting) existing.hasGhosting = true;
    if (inv.isTerminated) existing.hasTerminated = true;

    companyStatsMap.set(inv.companyName, existing);
  });

  const companyStats = Array.from(companyStatsMap.values());
  const statsByDollars = [...companyStats].sort((a, b) => {
    const aVal = a[companyDollarsSortColumn];
    const bVal = b[companyDollarsSortColumn];
    return companyDollarsSortDirection === 'desc' ? bVal - aVal : aVal - bVal;
  });
  const statsByQuantity = [...companyStats].sort((a, b) => {
    const aVal = a[companyCountSortColumn];
    const bVal = b[companyCountSortColumn];
    return companyCountSortDirection === 'desc' ? bVal - aVal : aVal - bVal;
  });

  // Calculate property stats
  const propertyStatsMap = new Map<string, PropertyStats>();
  
  filteredInvoices.forEach(inv => {
    if (!inv.propertyName) return;
    
    const existing = propertyStatsMap.get(inv.propertyName) || {
      property: inv.propertyName,
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
      hasGhosting: false,
      hasTerminated: false
    };

    existing.total += inv.amountRemaining;
    existing.count += 1;
    existing.aging_1_30 += inv.aging_1_30;
    existing.aging_31_60 += inv.aging_31_60;
    existing.aging_61_90 += inv.aging_61_90;
    existing.aging_91_120 += inv.aging_91_120;
    existing.aging_121_plus += inv.aging_121_plus;
    
    if (inv.aging_1_30 > 0) existing.count_1_30 += 1;
    if (inv.aging_31_60 > 0) existing.count_31_60 += 1;
    if (inv.aging_61_90 > 0) existing.count_61_90 += 1;
    if (inv.aging_91_120 > 0) existing.count_91_120 += 1;
    if (inv.aging_121_plus > 0) existing.count_121_plus += 1;
    
    if (inv.isGhosting) existing.hasGhosting = true;
    if (inv.isTerminated) existing.hasTerminated = true;

    propertyStatsMap.set(inv.propertyName, existing);
  });

  const propertyStats = Array.from(propertyStatsMap.values());
  
  // Apply sorting for Property Breakdown by Dollars
  const propertyStatsByDollars = [...propertyStats].sort((a, b) => {
    const aVal = a[propertyDollarsSortColumn];
    const bVal = b[propertyDollarsSortColumn];
    return propertyDollarsSortDirection === 'desc' ? bVal - aVal : aVal - bVal;
  });
  
  // Apply sorting for Property Breakdown by Quantity
  const propertyStatsByQuantity = [...propertyStats].sort((a, b) => {
    const aVal = a[propertyCountSortColumn];
    const bVal = b[propertyCountSortColumn];
    return propertyCountSortDirection === 'desc' ? bVal - aVal : aVal - bVal;
  });

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

  // Get invoices for a specific property
  const getPropertyInvoices = (propertyName: string) => {
    return filteredInvoices.filter(inv => inv.propertyName === propertyName);
  };

  // Horizontal flow chart component
  const FlowChart = () => {
    const [hoveredSegment, setHoveredSegment] = useState<{ company: string; value: number; x: number; y: number } | null>(null);
    
    const topCompanies = [...companyStats]
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    
    const otherCompanies = [...companyStats]
      .sort((a, b) => b.total - a.total)
      .slice(10);
    
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
    
    const maxValue = Math.max(
      agingTotals.aging_1_30,
      agingTotals.aging_31_60,
      agingTotals.aging_61_90,
      agingTotals.aging_91_120,
      agingTotals.aging_121_plus
    );
    
    const chartContentWidth = chartWidth - leftMargin - rightMargin;
    const xStep = chartContentWidth / (categories.length - 1);
    
    const companyLayers: { company: string; color: string; points: { x: number; y0: number; y1: number; value: number }[] }[] = [];
    
    const otherPoints = categories.map((cat, index) => {
      const x = leftMargin + index * xStep;
      const value = otherTotals[cat.key as keyof typeof otherTotals];
      const scaledHeight = (value / maxValue) * maxHeight;
      return {
        x,
        y0: chartHeight - topMargin - scaledHeight,
        y1: chartHeight - topMargin,
        value
      };
    });
    
    companyLayers.push({
      company: 'Other',
      color: colors[10],
      points: otherPoints
    });
    
    topCompanies.forEach((company, companyIndex) => {
      const points = categories.map((cat, catIndex) => {
        const x = leftMargin + catIndex * xStep;
        const value = company[cat.key as keyof typeof company] as number;
        const scaledHeight = (value / maxValue) * maxHeight;
        const prevY1 = companyLayers[companyLayers.length - 1].points[catIndex].y0;
        
        return {
          x,
          y0: prevY1 - scaledHeight,
          y1: prevY1,
          value
        };
      });
      
      companyLayers.push({
        company: company.company,
        color: colors[companyIndex % 10],
        points
      });
    });
    
    return (
      <div className="relative">
        <svg width={chartWidth} height={chartHeight}>
          <line x1={leftMargin} y1={topMargin} x2={leftMargin} y2={chartHeight - topMargin} stroke="#9CA3AF" strokeWidth="2" />
          <line x1={leftMargin} y1={chartHeight - topMargin} x2={chartWidth - rightMargin} y2={chartHeight - topMargin} stroke="#9CA3AF" strokeWidth="2" />
          
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = chartHeight - topMargin - ratio * maxHeight;
            const value = maxValue * ratio;
            return (
              <g key={i}>
                <line x1={leftMargin - 5} y1={y} x2={leftMargin} y2={y} stroke="#9CA3AF" strokeWidth="1" />
                <text x={leftMargin - 10} y={y + 4} textAnchor="end" className="text-xs fill-gray-600">
                  {formatCompactCurrency(value)}
                </text>
              </g>
            );
          })}
          
          {categories.map((cat, index) => {
            const x = leftMargin + index * xStep;
            return (
              <text key={cat.key} x={x} y={chartHeight - 5} textAnchor="middle" className="text-xs fill-gray-600">
                {cat.label}
              </text>
            );
          })}
          
          {companyLayers.map((layer, layerIndex) => {
            let path = '';
            layer.points.forEach((point, i) => {
              if (i === 0) {
                path += `M ${point.x} ${point.y0}`;
              } else {
                path += ` L ${point.x} ${point.y0}`;
              }
            });
            path += ` L ${layer.points[layer.points.length - 1].x} ${layer.points[layer.points.length - 1].y1}`;
            for (let i = layer.points.length - 1; i >= 0; i--) {
              path += ` L ${layer.points[i].x} ${layer.points[i].y1}`;
            }
            path += ' Z';
            
            return (
              <path
                key={layerIndex}
                d={path}
                fill={layer.color}
                opacity={0.7}
                stroke={layer.color}
                strokeWidth="1"
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredSegment({
                    company: layer.company,
                    value: layer.points.reduce((sum, p) => sum + p.value, 0),
                    x: rect.left + rect.width / 2,
                    y: rect.top
                  });
                }}
                onMouseLeave={() => setHoveredSegment(null)}
                className="cursor-pointer hover:opacity-90 transition-opacity"
              />
            );
          })}
        </svg>
        
        {hoveredSegment && (
          <div
            className="absolute z-10 bg-gray-900 text-white px-3 py-2 rounded shadow-lg text-sm"
            style={{
              left: hoveredSegment.x,
              top: hoveredSegment.y - 60,
              transform: 'translateX(-50%)'
            }}
          >
            <div className="font-semibold">{hoveredSegment.company}</div>
            <div>{formatCurrency(hoveredSegment.value)}</div>
          </div>
        )}
        
        <div className="mt-4 flex flex-wrap gap-3">
          {companyLayers.slice().reverse().map((layer, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: layer.color }} />
              <span className="text-sm text-gray-700">{layer.company}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">COMPANY</label>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {companies.map(company => (
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
              {properties.map(property => (
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
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">HIDE CURRENT</label>
            <button
              onClick={() => setHideCurrent(!hideCurrent)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                hideCurrent ? 'bg-blue-600' : 'bg-gray-300'
              }`}
              role="switch"
              aria-checked={hideCurrent}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform ${
                  hideCurrent ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div className="ml-auto text-sm text-gray-600">
            Showing <span className="font-semibold">{filteredInvoices.length}</span> invoices
          </div>
        </div>
      </div>

      {/* Flow Chart */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div 
          className="p-4 border-b border-gray-200 flex items-center gap-2 cursor-pointer hover:bg-gray-50"
          onClick={() => setShowFlowChart(!showFlowChart)}
        >
          {showFlowChart ? <ChevronDown className="w-5 h-5 text-gray-600" /> : <ChevronRight className="w-5 h-5 text-gray-600" />}
          <h3 className="text-lg font-semibold text-gray-900">Company Distribution Across Aging Buckets</h3>
        </div>
        {showFlowChart && (
          <div className="p-6">
            <FlowChart />
          </div>
        )}
      </div>

      {/* Company Breakdown by Dollars */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div 
          className="p-4 border-b border-gray-200 flex items-center gap-2 cursor-pointer hover:bg-gray-50"
          onClick={() => setShowCompanyDollars(!showCompanyDollars)}
        >
          {showCompanyDollars ? <ChevronDown className="w-5 h-5 text-gray-600" /> : <ChevronRight className="w-5 h-5 text-gray-600" />}
          <h3 className="text-lg font-semibold text-gray-900">Company Breakdown by Dollars</h3>
        </div>
        {showCompanyDollars && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Company</th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleCompanyDollarsSort('total')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Total
                      <SortIcon active={companyDollarsSortColumn === 'total'} direction={companyDollarsSortDirection} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleCompanyDollarsSort('aging_1_30')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      1-30 Days
                      <SortIcon active={companyDollarsSortColumn === 'aging_1_30'} direction={companyDollarsSortDirection} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleCompanyDollarsSort('aging_31_60')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      31-60 Days
                      <SortIcon active={companyDollarsSortColumn === 'aging_31_60'} direction={companyDollarsSortDirection} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleCompanyDollarsSort('aging_61_90')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      61-90 Days
                      <SortIcon active={companyDollarsSortColumn === 'aging_61_90'} direction={companyDollarsSortDirection} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleCompanyDollarsSort('aging_91_120')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      91-120 Days
                      <SortIcon active={companyDollarsSortColumn === 'aging_91_120'} direction={companyDollarsSortDirection} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleCompanyDollarsSort('aging_121_plus')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      121+ Days
                      <SortIcon active={companyDollarsSortColumn === 'aging_121_plus'} direction={companyDollarsSortDirection} />
                    </div>
                  </th>
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
                        {stat.hasTerminated && (
                          <div className="p-1 rounded bg-red-100">
                            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
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
        )}
      </div>

      {/* Company Breakdown by Quantity */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div 
          className="p-4 border-b border-gray-200 flex items-center gap-2 cursor-pointer hover:bg-gray-50"
          onClick={() => setShowCompanyCount(!showCompanyCount)}
        >
          {showCompanyCount ? <ChevronDown className="w-5 h-5 text-gray-600" /> : <ChevronRight className="w-5 h-5 text-gray-600" />}
          <h3 className="text-lg font-semibold text-gray-900">Company Breakdown by Invoice Count</h3>
        </div>
        {showCompanyCount && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Company</th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleCompanyCountSort('count')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Total
                      <SortIcon active={companyCountSortColumn === 'count'} direction={companyCountSortDirection} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleCompanyCountSort('count_1_30')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      1-30 Days
                      <SortIcon active={companyCountSortColumn === 'count_1_30'} direction={companyCountSortDirection} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleCompanyCountSort('count_31_60')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      31-60 Days
                      <SortIcon active={companyCountSortColumn === 'count_31_60'} direction={companyCountSortDirection} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleCompanyCountSort('count_61_90')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      61-90 Days
                      <SortIcon active={companyCountSortColumn === 'count_61_90'} direction={companyCountSortDirection} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleCompanyCountSort('count_91_120')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      91-120 Days
                      <SortIcon active={companyCountSortColumn === 'count_91_120'} direction={companyCountSortDirection} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleCompanyCountSort('count_121_plus')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      121+ Days
                      <SortIcon active={companyCountSortColumn === 'count_121_plus'} direction={companyCountSortDirection} />
                    </div>
                  </th>
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
                        {stat.hasTerminated && (
                          <div className="p-1 rounded bg-red-100">
                            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
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
        )}
      </div>

      {/* Property Breakdown by Dollars */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div 
          className="p-4 border-b border-gray-200 flex items-center gap-2 cursor-pointer hover:bg-gray-50"
          onClick={() => setShowPropertyDollars(!showPropertyDollars)}
        >
          {showPropertyDollars ? <ChevronDown className="w-5 h-5 text-gray-600" /> : <ChevronRight className="w-5 h-5 text-gray-600" />}
          <h3 className="text-lg font-semibold text-gray-900">Property Breakdown by Dollars</h3>
        </div>
        {showPropertyDollars && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase w-8"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Property</th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handlePropertyDollarsSort('total')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Total
                      <SortIcon active={propertyDollarsSortColumn === 'total'} direction={propertyDollarsSortDirection} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handlePropertyDollarsSort('aging_1_30')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      1-30 Days
                      <SortIcon active={propertyDollarsSortColumn === 'aging_1_30'} direction={propertyDollarsSortDirection} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handlePropertyDollarsSort('aging_31_60')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      31-60 Days
                      <SortIcon active={propertyDollarsSortColumn === 'aging_31_60'} direction={propertyDollarsSortDirection} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handlePropertyDollarsSort('aging_61_90')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      61-90 Days
                      <SortIcon active={propertyDollarsSortColumn === 'aging_61_90'} direction={propertyDollarsSortDirection} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handlePropertyDollarsSort('aging_91_120')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      91-120 Days
                      <SortIcon active={propertyDollarsSortColumn === 'aging_91_120'} direction={propertyDollarsSortDirection} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handlePropertyDollarsSort('aging_121_plus')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      121+ Days
                      <SortIcon active={propertyDollarsSortColumn === 'aging_121_plus'} direction={propertyDollarsSortDirection} />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {propertyStatsByDollars.slice(0, 20).map((stat) => {
                  const isExpanded = expandedProperties.has(stat.property);
                  const propertyNote = propertyNotes.get(stat.property);
                  const propertyInvoices = getPropertyInvoices(stat.property);
                  
                  return (
                    <React.Fragment key={stat.property}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => togglePropertyExpanded(stat.property)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                          <div className="flex items-center gap-2">
                            <span>{stat.property}</span>
                            {propertyNote && (
                              <StickyNote className="w-4 h-4 text-blue-600" />
                            )}
                            {stat.hasGhosting && (
                              <div className="p-1 rounded bg-purple-100">
                                <Ghost className="w-4 h-4 text-gray-900" />
                              </div>
                            )}
                            {stat.hasTerminated && (
                              <div className="p-1 rounded bg-red-100">
                                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
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
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="px-4 py-4 bg-gray-50">
                            <div className="space-y-4">
                              {/* Property Note */}
                              {propertyNote && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                  <div className="flex items-start gap-2">
                                    <StickyNote className="w-5 h-5 text-blue-600 mt-0.5" />
                                    <div className="flex-1">
                                      <div className="font-semibold text-blue-900 mb-1">Property AR Note</div>
                                      <div className="text-sm text-blue-800 mb-2">{propertyNote.note_text}</div>
                                      <div className="text-xs text-blue-600">
                                        By {propertyNote.created_by} • {formatDate(propertyNote.updated_at)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {/* Invoice List */}
                              <div>
                                <div className="font-semibold text-gray-900 mb-2">
                                  Invoices ({propertyInvoices.length})
                                </div>
                                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Invoice #</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Opportunity</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Company</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Amount</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Due Date</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Days Past Due</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Invoice Note</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                      {propertyInvoices.map(inv => {
                                        // FIXED: Notes are loaded with order by created_at DESC (newest first), so index [0] is the most recent note
                                        const latestNote = inv.notes && inv.notes.length > 0 
                                          ? inv.notes[0]
                                          : null;
                                        
                                        return (
                                          <tr key={inv.invoice_id} className="hover:bg-gray-50">
                                            <td className="px-3 py-2 text-gray-900">{inv.invoiceNumber}</td>
                                            <td className="px-3 py-2 text-gray-700">{inv.opportunityName || '-'}</td>
                                            <td className="px-3 py-2 text-gray-700">{inv.companyName}</td>
                                            <td className="px-3 py-2 text-right font-semibold text-gray-900">
                                              ${Math.round(inv.amountRemaining).toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2 text-gray-700">{formatDate(inv.dueDate)}</td>
                                            <td className="px-3 py-2 text-right">
                                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                inv.pastDue === 0 ? 'bg-blue-100 text-blue-700' :
                                                inv.pastDue <= 30 ? 'bg-yellow-100 text-yellow-700' :
                                                inv.pastDue <= 60 ? 'bg-orange-100 text-orange-700' :
                                                'bg-red-100 text-red-700'
                                              }`}>
                                                {inv.pastDue} days
                                              </span>
                                            </td>
                                            <td className="px-3 py-2">
                                              {latestNote ? (
                                                <div className="text-xs bg-blue-50 border border-blue-200 rounded p-2 max-w-md">
                                                  <div className="mb-1">{latestNote.note_text}</div>
                                                  <div className="text-[10px] text-blue-600">
                                                    By {latestNote.created_by} • {formatDate(latestNote.created_at)}
                                                  </div>
                                                </div>
                                              ) : (
                                                <span className="text-gray-400 italic text-xs">No note</span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Property Breakdown by Quantity */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div 
          className="p-4 border-b border-gray-200 flex items-center gap-2 cursor-pointer hover:bg-gray-50"
          onClick={() => setShowPropertyCount(!showPropertyCount)}
        >
          {showPropertyCount ? <ChevronDown className="w-5 h-5 text-gray-600" /> : <ChevronRight className="w-5 h-5 text-gray-600" />}
          <h3 className="text-lg font-semibold text-gray-900">Property Breakdown by Invoice Count</h3>
        </div>
        {showPropertyCount && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase w-8"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Property</th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handlePropertyCountSort('count')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Total
                      <SortIcon active={propertyCountSortColumn === 'count'} direction={propertyCountSortDirection} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handlePropertyCountSort('count_1_30')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      1-30 Days
                      <SortIcon active={propertyCountSortColumn === 'count_1_30'} direction={propertyCountSortDirection} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handlePropertyCountSort('count_31_60')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      31-60 Days
                      <SortIcon active={propertyCountSortColumn === 'count_31_60'} direction={propertyCountSortDirection} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handlePropertyCountSort('count_61_90')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      61-90 Days
                      <SortIcon active={propertyCountSortColumn === 'count_61_90'} direction={propertyCountSortDirection} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handlePropertyCountSort('count_91_120')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      91-120 Days
                      <SortIcon active={propertyCountSortColumn === 'count_91_120'} direction={propertyCountSortDirection} />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handlePropertyCountSort('count_121_plus')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      121+ Days
                      <SortIcon active={propertyCountSortColumn === 'count_121_plus'} direction={propertyCountSortDirection} />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {propertyStatsByQuantity.slice(0, 20).map((stat) => {
                  const isExpanded = expandedProperties.has(stat.property);
                  const propertyNote = propertyNotes.get(stat.property);
                  const propertyInvoices = getPropertyInvoices(stat.property);
                  
                  return (
                    <React.Fragment key={stat.property}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => togglePropertyExpanded(stat.property)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                          <div className="flex items-center gap-2">
                            <span>{stat.property}</span>
                            {propertyNote && (
                              <StickyNote className="w-4 h-4 text-blue-600" />
                            )}
                            {stat.hasGhosting && (
                              <div className="p-1 rounded bg-purple-100">
                                <Ghost className="w-4 h-4 text-gray-900" />
                              </div>
                            )}
                            {stat.hasTerminated && (
                              <div className="p-1 rounded bg-red-100">
                                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
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
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="px-4 py-4 bg-gray-50">
                            <div className="space-y-4">
                              {/* Property Note */}
                              {propertyNote && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                  <div className="flex items-start gap-2">
                                    <StickyNote className="w-5 h-5 text-blue-600 mt-0.5" />
                                    <div className="flex-1">
                                      <div className="font-semibold text-blue-900 mb-1">Property AR Note</div>
                                      <div className="text-sm text-blue-800 mb-2">{propertyNote.note_text}</div>
                                      <div className="text-xs text-blue-600">
                                        By {propertyNote.created_by} • {formatDate(propertyNote.updated_at)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {/* Invoice List */}
                              <div>
                                <div className="font-semibold text-gray-900 mb-2">
                                  Invoices ({propertyInvoices.length})
                                </div>
                                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Invoice #</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Opportunity</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Company</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Amount</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Due Date</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-600">Days Past Due</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Invoice Note</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                      {propertyInvoices.map(inv => {
                                        // FIXED: Notes are loaded with order by created_at DESC (newest first), so index [0] is the most recent note
                                        const latestNote = inv.notes && inv.notes.length > 0 
                                          ? inv.notes[0]
                                          : null;
                                        
                                        return (
                                          <tr key={inv.invoice_id} className="hover:bg-gray-50">
                                            <td className="px-3 py-2 text-gray-900">{inv.invoiceNumber}</td>
                                            <td className="px-3 py-2 text-gray-700">{inv.opportunityName || '-'}</td>
                                            <td className="px-3 py-2 text-gray-700">{inv.companyName}</td>
                                            <td className="px-3 py-2 text-right font-semibold text-gray-900">
                                              ${Math.round(inv.amountRemaining).toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2 text-gray-700">{formatDate(inv.dueDate)}</td>
                                            <td className="px-3 py-2 text-right">
                                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                inv.pastDue === 0 ? 'bg-blue-100 text-blue-700' :
                                                inv.pastDue <= 30 ? 'bg-yellow-100 text-yellow-700' :
                                                inv.pastDue <= 60 ? 'bg-orange-100 text-orange-700' :
                                                'bg-red-100 text-red-700'
                                              }`}>
                                                {inv.pastDue} days
                                              </span>
                                            </td>
                                            <td className="px-3 py-2">
                                              {latestNote ? (
                                                <div className="text-xs bg-blue-50 border border-blue-200 rounded p-2 max-w-md">
                                                  <div className="mb-1">{latestNote.note_text}</div>
                                                  <div className="text-[10px] text-blue-600">
                                                    By {latestNote.created_by} • {formatDate(latestNote.created_at)}
                                                  </div>
                                                </div>
                                              ) : (
                                                <span className="text-gray-400 italic text-xs">No note</span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}