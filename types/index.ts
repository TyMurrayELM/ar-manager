export interface Invoice {
  invoice_id: number; // Changed from 'id' - now uses Aspire InvoiceID as primary key
  invoiceNumber: number;
  companyName: string;
  propertyName?: string;
  opportunityName?: string;
  opportunityNumber?: number;
  branchName: string;
  amount: number;
  amountRemaining: number;
  dueDate: string;
  invoiceDate: string;
  pastDue: number;
  agingCategory?: string;
  aging_1_30: number;
  aging_31_60: number;
  aging_61_90: number;
  aging_91_120: number;
  aging_121_plus: number;
  primaryContactName?: string;
  primaryContactEmail?: string;
  billingContactName?: string;
  billingContactEmail?: string;
  paymentTerms?: string;
  comments: string;
  followUpCategory?: number;
  isGhosting?: boolean;
  paymentStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  notes: InvoiceNote[];
  followUpsForInvoice?: FollowUp[];
}

export interface InvoiceNote {
  id: number;
  invoice_id: number; // This still references the invoice by invoice_id
  note_text: string;
  created_by: string;
  created_at: string;
  is_follow_up: boolean;
  follow_up_date?: string;
}

export interface HistoryItem {
  id: number;
  type: 'note' | 'follow-up';
  text: string;
  createdBy: string;
  createdAt: string;
  followUpDate?: string;
  completed?: boolean;
  noteId?: number;
  followUpId?: number;
}

export interface FollowUp {
  id: number;
  invoiceId: number; // This references invoice_id
  noteId?: number;
  invoiceNumber: number;
  companyName: string;
  propertyName?: string;
  amount: number;
  noteText: string;
  followUpDate: string;
  createdBy: string;
  createdAt: string;
  completed: boolean;
  completedAt?: string;
}

export interface BucketSummary {
  count: number;
  value: number;
}

export interface Bucket {
  id: string;
  label: string;
  count: number;
  value: number;
}

export interface MonthlySnapshot {
  id: number;
  snapshot_date: string;
  region: 'all' | 'phoenix' | 'las-vegas';
  total_outstanding: number;
  invoice_count: number;
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
  company_breakdown?: CompanyBreakdown[];
  created_at: string;
  created_by?: string;
}

export interface CompanyBreakdown {
  company: string;
  total: number;
  count: number;
  aging_1_30: number;
  aging_31_60: number;
  aging_61_90: number;
  aging_91_120: number;
  aging_121_plus: number;
}

export type TabType = 'invoices' | 'followups' | 'stats' | 'kpi';

export type PaymentStatus = 'No Contact' | 'Payment En Route' | 'Payment Processing' | 'In Communication' | 'No Follow Up';