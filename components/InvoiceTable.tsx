import React, { useState } from 'react';
import { ChevronDown, ChevronRight, MessageSquare, Pencil, Trash2, Calendar, FileText, CheckCircle2, Ghost } from 'lucide-react';
import { Invoice, InvoiceNote, HistoryItem, PaymentStatus } from '@/types';
import { formatCurrency, formatDate, getBranchColor } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface InvoiceTableProps {
  invoices: Invoice[];
  branches: string[];
  companies: string[];
  properties: string[];
  selectedBranch: string;
  selectedCompany: string;
  selectedProperty: string;
  selectedGhosting: 'all' | 'ghosting' | 'not-ghosting';
  onBranchChange: (branch: string) => void;
  onCompanyChange: (company: string) => void;
  onPropertyChange: (property: string) => void;
  onGhostingChange: (ghosting: 'all' | 'ghosting' | 'not-ghosting') => void;
  onAddNote: (invoice: Invoice) => void;
  onAddFollowUp: (invoice: Invoice) => void;
  onEditNote: (noteId: number, noteText: string) => void;
  onDeleteNote: (noteId: number, invoiceId: number) => void;
  onToggleGhosting: (invoiceId: number, currentStatus: boolean) => void;
  onUpdatePaymentStatus: (invoiceId: number, status: PaymentStatus) => void;
}

const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus; label: string; colorClass: string }[] = [
  { value: 'No Follow Up', label: 'No Follow Up', colorClass: 'bg-gray-100 text-gray-700' },
  { value: 'No Contact', label: 'No Contact', colorClass: 'bg-red-100 text-red-700' },
  { value: 'Payment En Route', label: 'Payment En Route', colorClass: 'bg-green-100 text-green-700' },
  { value: 'Payment Processing', label: 'Payment Processing', colorClass: 'bg-blue-100 text-blue-700' },
  { value: 'In Communication', label: 'In Communication', colorClass: 'bg-yellow-100 text-yellow-700' }
];

function getPaymentStatusColor(status: string): string {
  const option = PAYMENT_STATUS_OPTIONS.find(opt => opt.value === status);
  return option?.colorClass || 'bg-gray-100 text-gray-700';
}

// Helper function to create Aspire invoice URL
function getAspireInvoiceUrl(invoiceId: number): string {
  return `https://cloud.youraspire.com/app/invoicing/invoices/details/${invoiceId}`;
}

export default function InvoiceTable({ 
  invoices, 
  branches,
  companies,
  properties,
  selectedBranch,
  selectedCompany,
  selectedProperty,
  selectedGhosting,
  onBranchChange,
  onCompanyChange,
  onPropertyChange,
  onGhostingChange,
  onAddNote,
  onAddFollowUp,
  onEditNote,
  onDeleteNote,
  onToggleGhosting,
  onUpdatePaymentStatus
}: InvoiceTableProps) {
  const { user } = useAuth();
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'AR Team';
  
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  const getInvoiceHistory = (invoice: Invoice): HistoryItem[] => {
    const history: HistoryItem[] = [];

    // Add notes
    invoice.notes?.forEach(note => {
      history.push({
        id: note.id,
        type: 'note',
        text: note.note_text,
        createdBy: note.created_by,
        createdAt: note.created_at,
        followUpDate: note.follow_up_date,
        noteId: note.id
      });
    });

    // Add follow-ups
    invoice.followUpsForInvoice?.forEach(followUp => {
      history.push({
        id: followUp.id,
        type: 'follow-up',
        text: followUp.noteText,
        createdBy: followUp.createdBy,
        createdAt: followUp.createdAt,
        followUpDate: followUp.followUpDate,
        completed: followUp.completed,
        followUpId: followUp.id
      });
    });

    // Sort by date (newest first)
    return history.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  };

  const toggleRow = (invoiceId: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(invoiceId)) {
        newSet.delete(invoiceId);
      } else {
        newSet.add(invoiceId);
      }
      return newSet;
    });
  };

  const startEditingNote = (note: InvoiceNote) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.note_text);
  };

  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  const saveEditedNote = (noteId: number) => {
    if (editingNoteText.trim()) {
      onEditNote(noteId, editingNoteText);
      setEditingNoteId(null);
      setEditingNoteText('');
    }
  };

  const handleDeleteNote = (noteId: number, invoiceId: number) => {
    if (confirm('Are you sure you want to delete this note? This cannot be undone.')) {
      onDeleteNote(noteId, invoiceId);
    }
  };

  const handlePaymentStatusChange = (invoiceId: number, newStatus: string) => {
    onUpdatePaymentStatus(invoiceId, newStatus as PaymentStatus);
  };

  // Simplified email handler - no Drive search
  const handleEmailClick = (invoice: Invoice) => {
    const gmailUrl = createGmailLink(invoice);
    
    // Calculate center position for popup
    const width = 800;
    const height = 600;
    
    // Use dual offset method for better browser compatibility
    const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
    const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
    
    const windowWidth = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth ? document.documentElement.clientWidth : window.screen.width;
    const windowHeight = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : window.screen.height;
    
    const left = ((windowWidth / 2) - (width / 2)) + dualScreenLeft;
    const top = ((windowHeight / 2) - (height / 2)) + dualScreenTop;
    
    window.open(
      gmailUrl, 
      '_blank', 
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  };

  // Create Gmail compose link with pre-populated email (no Drive link)
  const createGmailLink = (invoice: Invoice) => {
    const to = invoice.primaryContactEmail || '';
    const cc = invoice.billingContactEmail || '';
    const subject = `Payment Follow-Up: Invoice #${invoice.invoiceNumber} | Encore Landscape Management`;
    
    // Extract first name from contact name
    const firstName = invoice.primaryContactName 
      ? invoice.primaryContactName.split(' ')[0] 
      : 'Valued Customer';
    
    const body = `Hi ${firstName},

I'm reaching out regarding Invoice #${invoice.invoiceNumber} for ${invoice.companyName}.

INVOICE DETAILS:
• Invoice Number: ${invoice.invoiceNumber}
• Amount Due: ${formatCurrency(invoice.amountRemaining)}
• Original Due Date: ${formatDate(invoice.dueDate)}
• Days Past Due: ${invoice.pastDue} days
${invoice.propertyName ? `• Property: ${invoice.propertyName}` : ''}

We wanted to check in on the status of this payment. If payment has already been sent, please let me know the check number or confirmation so we can update our records. If you have any questions or need any additional information about this invoice, please don't hesitate to reach out.

We appreciate your business and look forward to resolving this together.

Best regards,

${userName}
Encore Landscape Management
Accounts Receivable Team
(602) 568-2582
ar@encorelm.com`;

    // Build Gmail compose URL with proper parameter formatting
    let gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}`;
    
    // Add CC only if it exists AND is different from the To address
    if (cc && cc.trim() !== '' && cc.toLowerCase() !== to.toLowerCase()) {
      gmailUrl += `&cc=${encodeURIComponent(cc)}`;
    }
    
    // Add subject and body
    gmailUrl += `&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    return gmailUrl;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Filter Bar */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">BRANCH</label>
              <select
                value={selectedBranch}
                onChange={(e) => onBranchChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Branches</option>
                {branches.slice(1).map(branch => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">COMPANY</label>
              <select
                value={selectedCompany}
                onChange={(e) => onCompanyChange(e.target.value)}
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
                onChange={(e) => onPropertyChange(e.target.value)}
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
                onChange={(e) => onGhostingChange(e.target.value as 'all' | 'ghosting' | 'not-ghosting')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="ghosting">TRUE</option>
                <option value="not-ghosting">FALSE</option>
              </select>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            Showing <span className="font-semibold">{invoices.length}</span> invoices
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[600px]">
        <table className="w-full">
          <thead className="bg-blue-50 border-b border-blue-200 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Invoice #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Company</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Property</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Opportunity</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Branch</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Amount Due</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Due Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Days Past Due</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Payment Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Activity</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Ghosting</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {invoices.slice(0, 50).map((invoice) => {
              const isExpanded = expandedRows.has(invoice.invoice_id);
              const history = getInvoiceHistory(invoice);
              const hasHistory = history.length > 0;
              const currentStatus = invoice.paymentStatus || 'No Follow Up';

              return (
                <React.Fragment key={invoice.invoice_id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <a
                        href={getAspireInvoiceUrl(invoice.invoice_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 font-medium text-sm hover:underline"
                        title="Open in Aspire"
                      >
                        {invoice.invoiceNumber}
                      </a>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">{invoice.companyName}</div>
                      {invoice.primaryContactName && (
                        <div className="text-xs text-gray-500">{invoice.primaryContactName}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 font-semibold">
                      {invoice.propertyName || '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">
                      {invoice.opportunityName || '-'}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getBranchColor(invoice.branchName)}`}>
                        {invoice.branchName}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                      {formatCurrency(invoice.amountRemaining)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {formatDate(invoice.dueDate)}
                    </td>
                    <td className="px-4 py-4">
                      {invoice.pastDue > 0 ? (
                        <span className="text-sm font-medium text-red-600">{invoice.pastDue} days</span>
                      ) : (
                        <span className="text-sm text-gray-400">Current</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={currentStatus}
                        onChange={(e) => handlePaymentStatusChange(invoice.invoice_id, e.target.value)}
                        className={`px-2 py-1 rounded text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${getPaymentStatusColor(currentStatus)}`}
                      >
                        {PAYMENT_STATUS_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      {hasHistory ? (
                        <button
                          onClick={() => toggleRow(invoice.invoice_id)}
                          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                          <div className="flex items-center gap-1 text-xs">
                            <MessageSquare className="w-4 h-4" />
                            <span>{history.length}</span>
                          </div>
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => onToggleGhosting(invoice.invoice_id, invoice.isGhosting || false)}
                        className={`p-1 rounded transition-colors ${
                          invoice.isGhosting ? 'bg-purple-100' : ''
                        }`}
                        title={invoice.isGhosting ? "Client is ghosting - click to unmark" : "Mark client as ghosting"}
                      >
                        <Ghost 
                          className={`w-5 h-5 ${
                            invoice.isGhosting 
                              ? 'text-gray-900' 
                              : 'text-gray-300 hover:text-gray-400'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        {/* Gmail Icon - simplified without Drive search */}
                        {invoice.primaryContactEmail && (
                          <button
                            onClick={() => handleEmailClick(invoice)}
                            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                            title={`Email ${invoice.primaryContactName || 'contact'} about payment`}
                          >
                            <img src="/gmail.png" alt="Email" className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => onAddNote(invoice)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          Add Note
                        </button>
                        <button
                          onClick={() => onAddFollowUp(invoice)}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors flex items-center gap-1"
                        >
                          <Calendar className="w-3 h-3" />
                          Add Follow-up
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Activity Row */}
                  {isExpanded && hasHistory && (
                    <tr className="bg-gray-50">
                      <td colSpan={12} className="px-4 py-4">
                        <div className="ml-8">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            Activity ({history.length})
                          </h4>
                          <div className="space-y-3">
                            {history.map((item) => (
                              <div key={`${item.type}-${item.id}`}>
                                {item.type === 'note' ? (
                                  // Note display
                                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                                    {editingNoteId === item.noteId ? (
                                      // Edit mode
                                      <div>
                                        <textarea
                                          value={editingNoteText}
                                          onChange={(e) => setEditingNoteText(e.target.value)}
                                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                          rows={3}
                                          autoFocus
                                        />
                                        <div className="flex gap-2 mt-2">
                                          <button
                                            onClick={() => saveEditedNote(item.noteId!)}
                                            disabled={!editingNoteText.trim()}
                                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            Save
                                          </button>
                                          <button
                                            onClick={cancelEditingNote}
                                            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-medium transition-colors"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      // View mode
                                      <div className="flex items-start justify-between group">
                                        <div className="flex items-start gap-2 flex-1">
                                          <FileText className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                          <p className="text-sm text-gray-700 flex-1">
                                            <span className="font-semibold text-gray-900">{item.createdBy}</span>
                                            <span className="text-gray-400 mx-2">•</span>
                                            <span className="text-gray-500">
                                              {new Date(item.createdAt).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                                hour: 'numeric',
                                                minute: '2-digit'
                                              })}
                                            </span>
                                            <span className="text-gray-400 mx-2">•</span>
                                            <span className="text-gray-700">{item.text}</span>
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-2 ml-2">
                                          {item.followUpDate && (
                                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded whitespace-nowrap">
                                              Follow-up: {formatDate(item.followUpDate)}
                                            </span>
                                          )}
                                          <button
                                            onClick={() => {
                                              const note = invoice.notes.find(n => n.id === item.noteId);
                                              if (note) startEditingNote(note);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-600 transition-all"
                                            title="Edit note"
                                          >
                                            <Pencil className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteNote(item.noteId!, invoice.invoice_id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition-all"
                                            title="Delete note"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  // Follow-up display (indented)
                                  <div className={`ml-6 bg-white rounded-lg p-3 border ${
                                    item.completed ? 'border-green-200' : 'border-yellow-200'
                                  }`}>
                                    <div className="flex items-start justify-between group">
                                      <div className="flex items-start gap-2 flex-1">
                                        <Calendar className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                                          item.completed ? 'text-green-600' : 'text-yellow-600'
                                        }`} />
                                        <div className="flex-1">
                                          <p className="text-sm text-gray-700">
                                            <span className="font-semibold text-gray-900">{item.createdBy}</span>
                                            <span className="text-gray-400 mx-2">•</span>
                                            <span className="text-gray-500">
                                              {new Date(item.createdAt).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                                hour: 'numeric',
                                                minute: '2-digit'
                                              })}
                                            </span>
                                            <span className="text-gray-400 mx-2">•</span>
                                            <span className="text-gray-700">{item.text}</span>
                                          </p>
                                          <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-gray-500">
                                              Due: {formatDate(item.followUpDate!)}
                                            </span>
                                            {item.completed && (
                                              <span className="flex items-center gap-1 text-xs text-green-600">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Completed
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
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
        {invoices.length > 50 && (
          <div className="p-4 text-center text-sm text-gray-500 border-t">
            Showing first 50 of {invoices.length} invoices
          </div>
        )}
      </div>
    </div>
  );
}