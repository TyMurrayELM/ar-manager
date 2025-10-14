import { DollarSign, RefreshCw, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface HeaderProps {
  onSync: () => void;
  syncing?: boolean;
  lastSyncTime?: string | null;
}

export default function Header({ onSync, syncing = false, lastSyncTime }: HeaderProps) {
  const { user, signOut } = useAuth();

  // Get user display name and initials
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'User';
  const userInitials = (user?.user_metadata?.full_name || user?.user_metadata?.name)
    ? (user.user_metadata.full_name || user.user_metadata.name).split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : user?.email?.[0].toUpperCase() || 'U';

  // Google stores avatar in either avatar_url or picture
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  // Format last sync time in Arizona timezone
  const formatLastSync = (timestamp: string | null | undefined) => {
    if (!timestamp) return 'Never synced';
    
    const date = new Date(timestamp);
    
    // Format in Arizona timezone (MST - no DST)
    return date.toLocaleString('en-US', { 
      timeZone: 'America/Phoenix',
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true
    }) + ' AZ';
  };

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Accounts Receivable</h1>
              <p className="text-sm text-gray-500">Invoice Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <button 
                onClick={onSync}
                disabled={syncing}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  syncing
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing from Aspire...' : 'Sync from Aspire'}
              </button>
              <p className="text-xs text-gray-500 mt-1">
                Last sync: {formatLastSync(lastSyncTime)}
              </p>
            </div>
            
            {/* User Profile */}
            <div className="flex items-center gap-3 pl-3 border-l border-gray-200">
              <div className="flex items-center gap-2">
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt={userName}
                    className="w-8 h-8 rounded-full"
                    onError={(e) => {
                      // If image fails to load, hide it and show initials instead
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm"
                  style={{ display: avatarUrl ? 'none' : 'flex' }}
                >
                  {userInitials}
                </div>
                <span className="text-sm text-gray-700">{userName}</span>
              </div>
              
              <button
                onClick={signOut}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}