'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useInvoices } from '@/hooks/useInvoices';
import { Invoice, TabType } from '@/types';
import { ChevronDown, ChevronRight } from 'lucide-react';

import LoadingSpinner from '@/components/LoadingSpinner';
import Header from '@/components/Header';
import TabNavigation from '@/components/TabNavigation';
import SummaryCards from '@/components/SummaryCards';
import BucketPieCharts from '@/components/BucketPieCharts';
import InvoiceTable from '@/components/InvoiceTable';
import FollowUpsList from '@/components/FollowUpsList';
import StatsView from '@/components/StatsView';
import KPIView from '@/components/KPIView';
import AddNoteModal from '@/components/AddNoteModal';
import AddFollowUpModal from '@/components/AddFollowUpModal';

export default function ARManagementApp() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('invoices');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showPieCharts, setShowPieCharts] = useState(true);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const {
    invoices,
    filteredInvoices,
    followUps,
    snapshots,
    loading,
    syncing,
    lastSyncTime,
    buckets,
    branches,
    companies,
    properties,
    selectedBucket,
    selectedBranch,
    selectedCompany,
    selectedProperty,
    selectedRegion,
    selectedGhosting,
    setSelectedBucket,
    setSelectedBranch,
    setSelectedCompany,
    setSelectedProperty,
    setSelectedRegion,
    setSelectedGhosting,
    syncFromAspire,
    addNote,
    addFollowUp,
    editNote,
    deleteNote,
    completeFollowUp,
    deleteFollowUp,
    editFollowUp,
    toggleGhosting,
    updatePaymentStatus,
    createSnapshot
  } = useInvoices();

  const handleOpenNoteModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowNoteModal(true);
  };

  const handleOpenFollowUpModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowFollowUpModal(true);
  };

  const handleCloseNoteModal = () => {
    setShowNoteModal(false);
    setSelectedInvoice(null);
  };

  const handleCloseFollowUpModal = () => {
    setShowFollowUpModal(false);
    setSelectedInvoice(null);
  };

  const handleSaveNote = async (invoice: Invoice, noteText: string) => {
    await addNote(invoice, noteText);
  };

  const handleSaveFollowUp = async (invoice: Invoice, noteText: string, followUpDate: string) => {
    await addFollowUp(invoice, noteText, followUpDate);
  };

  const pendingFollowUps = followUps.filter(fu => !fu.completed).length;

  // Show loading while checking auth
  if (authLoading || (!user && !authLoading)) {
    return <LoadingSpinner />;
  }

  // Show loading while fetching data
  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        onSync={syncFromAspire} 
        syncing={syncing}
        lastSyncTime={lastSyncTime}
      />

      <div className="px-8 py-6">
        <TabNavigation 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          pendingFollowUps={pendingFollowUps}
          selectedRegion={selectedRegion}
          onRegionChange={setSelectedRegion}
        />

        {activeTab === 'invoices' ? (
          <>
            <SummaryCards 
              buckets={buckets}
              selectedBucket={selectedBucket}
              onBucketSelect={setSelectedBucket}
            />

            <div className="mb-6">
              <button
                onClick={() => setShowPieCharts(!showPieCharts)}
                className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors mb-3"
              >
                {showPieCharts ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
                <span className="font-semibold text-sm">Company Breakdown by Bucket</span>
              </button>

              {showPieCharts && (
                <BucketPieCharts 
                  invoices={invoices}
                  selectedBucket={selectedBucket}
                  selectedRegion={selectedRegion}
                />
              )}
            </div>

            <InvoiceTable 
              invoices={filteredInvoices}
              branches={branches}
              companies={companies}
              properties={properties}
              selectedBranch={selectedBranch}
              selectedCompany={selectedCompany}
              selectedProperty={selectedProperty}
              selectedGhosting={selectedGhosting}
              onBranchChange={setSelectedBranch}
              onCompanyChange={setSelectedCompany}
              onPropertyChange={setSelectedProperty}
              onGhostingChange={setSelectedGhosting}
              onAddNote={handleOpenNoteModal}
              onAddFollowUp={handleOpenFollowUpModal}
              onEditNote={editNote}
              onDeleteNote={deleteNote}
              onToggleGhosting={toggleGhosting}
              onUpdatePaymentStatus={updatePaymentStatus}
            />
          </>
        ) : activeTab === 'followups' ? (
          <FollowUpsList 
            followUps={followUps}
            onComplete={completeFollowUp}
            onDelete={deleteFollowUp}
            onEdit={editFollowUp}
          />
        ) : activeTab === 'stats' ? (
          <StatsView 
            invoices={invoices}
            selectedRegion={selectedRegion}
          />
        ) : (
          <KPIView 
            snapshots={snapshots}
            selectedRegion={selectedRegion}
            onCreateSnapshot={createSnapshot}
          />
        )}
      </div>

      {showNoteModal && (
        <AddNoteModal 
          invoice={selectedInvoice}
          onClose={handleCloseNoteModal}
          onSave={handleSaveNote}
        />
      )}

      {showFollowUpModal && (
        <AddFollowUpModal 
          invoice={selectedInvoice}
          onClose={handleCloseFollowUpModal}
          onSave={handleSaveFollowUp}
        />
      )}
    </div>
  );
}