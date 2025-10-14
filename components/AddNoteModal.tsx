import { useState } from 'react';
import { Invoice } from '@/types';
import { formatCurrency } from '@/lib/utils';

interface AddNoteModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  onSave: (invoice: Invoice, noteText: string) => void;
}

// Helper function to create Aspire invoice URL
function getAspireInvoiceUrl(invoiceId: number): string {
  return `https://cloud.youraspire.com/app/invoicing/invoices/details/${invoiceId}`;
}

export default function AddNoteModal({ invoice, onClose, onSave }: AddNoteModalProps) {
  const [noteText, setNoteText] = useState('');

  if (!invoice) return null;

  const handleSave = () => {
    if (noteText.trim()) {
      onSave(invoice, noteText);
      setNoteText('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Add Note - Invoice{' '}
            <a
              href={getAspireInvoiceUrl(invoice.invoice_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 hover:underline"
              title="Open in Aspire"
            >
              #{invoice.invoiceNumber}
            </a>
          </h3>
          <div className="text-sm text-gray-600 mb-4">
            {invoice.companyName} • {formatCurrency(invoice.amountRemaining)}
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Note</label>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Enter your note here..."
              autoFocus
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
              disabled={!noteText.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}