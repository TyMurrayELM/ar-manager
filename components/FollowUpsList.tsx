import { Clock, Pencil } from 'lucide-react';
import { useState } from 'react';
import { FollowUp } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface FollowUpsListProps {
  followUps: FollowUp[];
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (id: number, noteText: string, followUpDate: string) => void;
}

type FollowUpTab = 'open' | 'completed';

// Helper function to create Aspire invoice URL
function getAspireInvoiceUrl(invoiceId: number): string {
  return `https://cloud.youraspire.com/app/invoicing/invoices/details/${invoiceId}`;
}

export default function FollowUpsList({ followUps, onComplete, onDelete, onEdit }: FollowUpsListProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingDate, setEditingDate] = useState('');
  const [activeTab, setActiveTab] = useState<FollowUpTab>('open');
  const [selectedUser, setSelectedUser] = useState('all');

  const openFollowUps = followUps
    .filter(fu => !fu.completed)
    .filter(fu => selectedUser === 'all' || fu.createdBy === selectedUser)
    .sort((a, b) => new Date(a.followUpDate).getTime() - new Date(b.followUpDate).getTime());

  const completedFollowUps = followUps
    .filter(fu => fu.completed)
    .filter(fu => selectedUser === 'all' || fu.createdBy === selectedUser)
    .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime());

  // Get unique users from all follow-ups
  const users = ['all', ...new Set(followUps.map(fu => fu.createdBy).filter(Boolean))].sort((a, b) => {
    if (a === 'all') return -1;
    if (b === 'all') return 1;
    return a.localeCompare(b);
  });

  const startEditing = (followUp: FollowUp) => {
    setEditingId(followUp.id);
    setEditingText(followUp.noteText);
    setEditingDate(followUp.followUpDate);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingText('');
    setEditingDate('');
  };

  const saveEditing = (id: number) => {
    if (editingText.trim() && editingDate) {
      onEdit(id, editingText, editingDate);
      cancelEditing();
    }
  };

  const FollowUpRow = ({ followUp, isCompleted }: { followUp: FollowUp; isCompleted: boolean }) => {
    const isOverdue = new Date(followUp.followUpDate) < new Date() && !followUp.completed;
    const isToday = new Date(followUp.followUpDate).toDateString() === new Date().toDateString();

    if (editingId === followUp.id) {
      return (
        <div className="bg-white border rounded-lg p-3 border-gray-300">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Note</label>
                <input
                  type="text"
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Follow-up Date</label>
                <input
                  type="date"
                  value={editingDate}
                  onChange={(e) => setEditingDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => saveEditing(followUp.id)}
                disabled={!editingText.trim() || !editingDate}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
              <button
                onClick={cancelEditing}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`border rounded-lg p-3 ${
        isCompleted
          ? 'bg-green-50 border-green-200'
          : isOverdue
          ? 'bg-red-50 border-red-200'
          : 'bg-yellow-50 border-yellow-200'
      }`}>
        <div className="flex items-center gap-3">
          {/* Checkbox */}
          <input
            type="checkbox"
            checked={followUp.completed}
            onChange={() => onComplete(followUp.id)}
            className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500 flex-shrink-0"
          />
          
          {/* Company, Invoice, Property, Amount - Left side */}
          <div className="flex items-center gap-2" style={{ minWidth: '350px' }}>
            <span className="font-semibold text-gray-900 truncate">{followUp.companyName}</span>
            <span className="text-gray-400">•</span>
            <a
              href={getAspireInvoiceUrl(followUp.invoiceId)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex-shrink-0 hover:underline"
              title="Open in Aspire"
            >
              #{followUp.invoiceNumber}
            </a>
            {followUp.propertyName && (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-sm text-gray-600 truncate">{followUp.propertyName}</span>
              </>
            )}
            <span className="text-gray-400">•</span>
            <span className="text-sm font-medium text-gray-900 flex-shrink-0">{formatCurrency(followUp.amount)}</span>
          </div>

          {/* Note - Middle (flexible) */}
          <div className="flex-1 min-w-0 px-3">
            <p className="text-sm text-gray-700 truncate" title={followUp.noteText}>
              {followUp.noteText}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              by {followUp.createdBy}
            </p>
          </div>

          {/* Due Date and Status - Right side */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isOverdue && !followUp.completed && (
              <span className="text-xs text-red-600 font-medium">OVERDUE</span>
            )}
            {isToday && !followUp.completed && (
              <span className="text-xs text-orange-600 font-medium">TODAY</span>
            )}
            <span className="text-xs text-gray-700 font-medium" style={{ minWidth: '90px', textAlign: 'right' }}>
              {new Date(followUp.followUpDate).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
          </div>

          {/* Actions - Far Right */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {!followUp.completed && (
              <button
                onClick={() => startEditing(followUp)}
                className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                title="Edit follow-up"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => onDelete(followUp.id)}
              className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
              title="Delete follow-up"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const displayedFollowUps = activeTab === 'open' ? openFollowUps : completedFollowUps;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Tabs and Filter */}
      <div className="border-b border-gray-200">
        <div className="flex items-center justify-between px-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('open')}
              className={`pb-3 pt-4 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'open'
                  ? 'border-yellow-600 text-yellow-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Open Follow-ups ({openFollowUps.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`pb-3 pt-4 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'completed'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Completed Follow-ups ({completedFollowUps.length})
            </button>
          </div>

          {/* User Filter */}
          <div className="py-3">
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Users</option>
              {users.slice(1).map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {displayedFollowUps.length > 0 ? (
          <div className="space-y-2">
            {displayedFollowUps.map((followUp) => (
              <FollowUpRow 
                key={followUp.id} 
                followUp={followUp} 
                isCompleted={activeTab === 'completed'} 
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {selectedUser === 'all' 
                ? (activeTab === 'open' ? 'No open follow-ups' : 'No completed follow-ups')
                : `No ${activeTab} follow-ups for ${selectedUser}`
              }
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {activeTab === 'open' 
                ? 'Add follow-ups from the invoices tab'
                : 'Completed follow-ups will appear here'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}