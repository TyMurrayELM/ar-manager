import { TabType } from '@/types';

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  pendingFollowUps: number;
  selectedRegion: 'all' | 'phoenix' | 'las-vegas';
  onRegionChange: (region: 'all' | 'phoenix' | 'las-vegas') => void;
}

export default function TabNavigation({ 
  activeTab, 
  onTabChange, 
  pendingFollowUps,
  selectedRegion,
  onRegionChange 
}: TabNavigationProps) {
  return (
    <div className="mb-6">
      {/* Region Toggle */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm font-medium text-gray-700">Region:</span>
        <div className="inline-flex rounded-lg border border-gray-300 bg-white">
          <button
            onClick={() => onRegionChange('all')}
            className={`px-4 py-2 text-sm font-medium transition-colors rounded-l-lg ${
              selectedRegion === 'all'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          <button
            onClick={() => onRegionChange('phoenix')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
              selectedRegion === 'phoenix'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            Phoenix
          </button>
          <button
            onClick={() => onRegionChange('las-vegas')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 rounded-r-lg ${
              selectedRegion === 'las-vegas'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            Las Vegas
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          <button
            onClick={() => onTabChange('invoices')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'invoices'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Outstanding Invoices
          </button>
          <button
            onClick={() => onTabChange('followups')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors relative ${
              activeTab === 'followups'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Follow-ups
            {pendingFollowUps > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                {pendingFollowUps}
              </span>
            )}
          </button>
          <button
            onClick={() => onTabChange('stats')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'stats'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Stats
          </button>
          <button
            onClick={() => onTabChange('kpi')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'kpi'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            KPI
          </button>
        </div>
      </div>
    </div>
  );
}