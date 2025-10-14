import React, { useState } from 'react';
import { ChevronDown, ChevronRight, MessageSquare, Pencil, Trash2, Calendar, FileText, CheckCircle2, Ghost } from 'lucide-react';
import { Invoice, InvoiceNote, HistoryItem, PaymentStatus } from '@/types';
import { formatCurrency, formatDate, getBranchColor } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface InvoiceTableProps {
  invoices: Invoice[];
  branches: string[];
  companies: string[];
  properties: string[];
  selectedBranch: string;
  selectedCompany: string;
  selectedProperty: string;
  selectedGhosting: 'all' | 'ghosting' | 'not-ghosting';
  selectedTerminated: 'all' | 'terminated' | 'not-terminated';
  selectedPaymentStatus: string;
  showCurrentInvoices: boolean;
  onBranchChange: (branch: string) => void;
  onCompanyChange: (company: string) => void;
  onPropertyChange: (property: string) => void;
  onGhostingChange: (ghosting: 'all' | 'ghosting' | 'not-ghosting') => void;
  onTerminatedChange: (terminated: 'all' | 'terminated' | 'not-terminated') => void;
  onPaymentStatusChange: (status: string) => void;
  onShowCurrentInvoicesChange: (show: boolean) => void;
  onAddNote: (invoice: Invoice) => void;
  onAddFollowUp: (invoice: Invoice) => void;
  onEditNote: (noteId: number, noteText: string) => void;
  onDeleteNote: (noteId: number, invoiceId: number) => void;
  onToggleGhosting: (invoiceId: number, currentStatus: boolean) => void;
  onToggleTerminated: (invoiceId: number, currentStatus: boolean) => void;
  onUpdatePaymentStatus: (invoiceId: number, status: PaymentStatus) => void;
}

interface DriveFileResult {
  found: boolean;
  fileName?: string;
  fileId?: string;
  viewLink?: string;
  downloadLink?: string;
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
  selectedTerminated,
  selectedPaymentStatus,
  showCurrentInvoices,
  onBranchChange,
  onCompanyChange,
  onPropertyChange,
  onGhostingChange,
  onTerminatedChange,
  onPaymentStatusChange,
  onShowCurrentInvoicesChange,
  onAddNote,
  onAddFollowUp,
  onEditNote,
  onDeleteNote,
  onToggleGhosting,
  onToggleTerminated,
  onUpdatePaymentStatus
}: InvoiceTableProps) {
  const { user } = useAuth();
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'AR Team';
  
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [searchingInvoice, setSearchingInvoice] = useState<number | null>(null);

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

  // Search for invoice in Google Drive
  const findInvoiceInDrive = async (invoiceNumber: number): Promise<DriveFileResult | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token || !session?.provider_token) {
        console.error('No session or provider token available');
        return null;
      }

      const response = await fetch('/api/find-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          invoiceNumber,
          providerToken: session.provider_token
        })
      });

      // Check if response has content before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Invalid response type:', contentType);
        return null;
      }

      // Get the response text first to check if it's empty
      const text = await response.text();
      if (!text || text.trim() === '') {
        console.error('Empty response from API');
        return null;
      }

      // Now parse the JSON
      let result: DriveFileResult;
      try {
        result = JSON.parse(text);
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError);
        console.error('Response text:', text);
        return null;
      }

      if (response.ok && result.found) {
        console.log('✅ Invoice found in Drive:', result.fileName);
        return result;
      }

      console.log('ℹ️ Invoice not found in Drive');
      return null;
    } catch (error) {
      console.error('Error finding invoice:', error);
      return null;
    }
  };

  // Handle Gmail button click with Drive search
  const handleEmailClick = async (invoice: Invoice) => {
    setSearchingInvoice(invoice.invoice_id);
    
    // Open Gmail immediately to avoid popup blocking
    const gmailWindow = window.open('about:blank', '_blank', 'width=800,height=600,resizable=yes,scrollbars=yes');
    
    if (!gmailWindow) {
      setSearchingInvoice(null);
      alert('Please allow popups for this site to use the email feature.');
      return;
    }

    try {
      // Show loading message in the popup
      gmailWindow.document.write('<html><body style="font-family: Arial; padding: 20px; text-align: center;"><h2>Preparing email...</h2><p>Searching for invoice in Google Drive...</p></body></html>');
      
      // Search for invoice in Drive
      const driveFile = await findInvoiceInDrive(invoice.invoiceNumber);
      
      // Create Gmail link with or without Drive link
      const gmailUrl = createGmailLink(invoice, driveFile);
      
      // Navigate the popup to Gmail
      gmailWindow.location.href = gmailUrl;
      
    } catch (error) {
      console.error('Error opening email:', error);
      gmailWindow.close();
      alert('Failed to prepare email. Please try again.');
    } finally {
      setSearchingInvoice(null);
    }
  };

  // Create Gmail compose link with pre-populated email
  const createGmailLink = (invoice: Invoice, driveFile: DriveFileResult | null = null) => {
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
${driveFile ? `\n🔎 View Invoice: ${driveFile.viewLink}` : ''}

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
    
    console.log('Gmail URL created:', gmailUrl.substring(0, 100) + '...');
    
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
              <label className="block text-xs font-medium text-gray-600 mb-1">PAYMENT STATUS</label>
              <select
                value={selectedPaymentStatus}
                onChange={(e) => onPaymentStatusChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                {PAYMENT_STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
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
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">TERMINATED</label>
              <select
                value={selectedTerminated}
                onChange={(e) => onTerminatedChange(e.target.value as 'all' | 'terminated' | 'not-terminated')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="terminated">TRUE</option>
                <option value="not-terminated">FALSE</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="block text-xs font-medium text-gray-600">SHOW CURRENT</label>
              <button
                type="button"
                onClick={() => onShowCurrentInvoicesChange(!showCurrentInvoices)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  showCurrentInvoices ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showCurrentInvoices ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
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
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Terminated</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {invoices.map((invoice) => {
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
                      <div className="flex justify-center">
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
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-center">
                        <button
                          onClick={() => onToggleTerminated(invoice.invoice_id, invoice.isTerminated || false)}
                          className={`p-1 rounded transition-colors ${
                            invoice.isTerminated ? 'bg-red-100' : ''
                          }`}
                          title={invoice.isTerminated ? "Property is terminated - click to unmark" : "Mark property as terminated"}
                        >
                          <svg 
                            className={`w-5 h-5 ${
                              invoice.isTerminated 
                                ? 'text-red-600' 
                                : 'text-gray-300 hover:text-gray-400'
                            }`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        {/* Gmail Icon */}
                        {invoice.primaryContactEmail && (
                          <button
                            onClick={() => handleEmailClick(invoice)}
                            disabled={searchingInvoice === invoice.invoice_id}
                            className="p-1.5 hover:bg-gray-100 rounded transition-colors relative disabled:opacity-50"
                            title={`Email ${invoice.primaryContactName || 'contact'} about payment`}
                          >
                            {searchingInvoice === invoice.invoice_id ? (
                              <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                            ) : (
                              <img src="/gmail.png" alt="Email" className="w-5 h-5" />
                            )}
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
                      <td colSpan={13} className="px-4 py-4">
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
      </div>
    </div>
  );
}