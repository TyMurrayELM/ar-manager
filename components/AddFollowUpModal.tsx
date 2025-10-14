import { useState } from 'react';
import { Invoice } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface AddFollowUpModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  onSave: (invoice: Invoice, noteText: string, followUpDate: string) => void;
}

export default function AddFollowUpModal({ invoice, onClose, onSave }: AddFollowUpModalProps) {
  const [noteText, setNoteText] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

  if (!invoice) return null;

  const handleSave = () => {
    if (noteText.trim() && followUpDate) {
      onSave(invoice, noteText, followUpDate);
      setNoteText('');
      setFollowUpDate('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Add Follow-up - Invoice #{invoice.invoiceNumber}
          </h3>
          <div className="text-sm text-gray-600 mb-4">
            {invoice.companyName} • {formatCurrency(invoice.amountRemaining)}
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Note</label>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              rows={4}
              placeholder="What needs to be followed up on?"
              autoFocus
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Follow-up Date</label>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!noteText.trim() || !followUpDate}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Follow-up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}