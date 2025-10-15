'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useInvoices } from '@/hooks/useInvoices';
import { Invoice, TabType } from '@/types';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

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
import AddPropertyNoteModal from '@/components/AddPropertyNoteModal';

interface PropertyNote {
  property_name: string;
  note_text: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export default function ARManagementApp() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('invoices');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showPropertyNoteModal, setShowPropertyNoteModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedPropertyForNote, setSelectedPropertyForNote] = useState<string | null>(null);
  const [showPieCharts, setShowPieCharts] = useState(true);
  const [propertyNotes, setPropertyNotes] = useState<Map<string, PropertyNote>>(new Map());

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
    selectedTerminated,
    selectedPaymentStatus,
    showCurrentInvoices,
    setSelectedBucket,
    setSelectedBranch,
    setSelectedCompany,
    setSelectedProperty,
    setSelectedRegion,
    setSelectedGhosting,
    setSelectedTerminated,
    setSelectedPaymentStatus,
    setShowCurrentInvoices,
    syncFromAspire,
    addNote,
    addFollowUp,
    editNote,
    deleteNote,
    completeFollowUp,
    deleteFollowUp,
    editFollowUp,
    toggleGhosting,
    toggleTerminated,
    updatePaymentStatus,
    createSnapshot
  } = useInvoices();

  // Load property notes from Supabase
  useEffect(() => {
    if (user) {
      loadPropertyNotes();
    }
  }, [user]);

  const loadPropertyNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('property_ar_notes')
        .select('*');

      if (error) {
        console.error('Error loading property notes:', error);
        return;
      }

      if (data) {
        const notesMap = new Map<string, PropertyNote>();
        data.forEach((note: PropertyNote) => {
          notesMap.set(note.property_name, note);
        });
        setPropertyNotes(notesMap);
        console.log('✅ Loaded', data.length, 'property notes');
      }
    } catch (error) {
      console.error('Error in loadPropertyNotes:', error);
    }
  };

  const handleOpenNoteModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowNoteModal(true);
  };

  const handleOpenFollowUpModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowFollowUpModal(true);
  };

  const handleOpenPropertyNoteModal = (propertyName: string) => {
    setSelectedPropertyForNote(propertyName);
    setShowPropertyNoteModal(true);
  };

  const handleCloseNoteModal = () => {
    setShowNoteModal(false);
    setSelectedInvoice(null);
  };

  const handleCloseFollowUpModal = () => {
    setShowFollowUpModal(false);
    setSelectedInvoice(null);
  };

  const handleClosePropertyNoteModal = () => {
    setShowPropertyNoteModal(false);
    setSelectedPropertyForNote(null);
  };

  const handleSaveNote = async (invoice: Invoice, noteText: string) => {
    await addNote(invoice, noteText);
  };

  const handleSaveFollowUp = async (invoice: Invoice, noteText: string, followUpDate: string) => {
    await addFollowUp(invoice, noteText, followUpDate);
  };

  const handleSavePropertyNote = async (propertyName: string, noteText: string) => {
    try {
      const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'AR Team';
      
      // Check if property note already exists
      const existingNote = propertyNotes.get(propertyName);

      if (existingNote) {
        // Update existing note
        const { error } = await supabase
          .from('property_ar_notes')
          .update({
            note_text: noteText,
            updated_at: new Date().toISOString()
          })
          .eq('property_name', propertyName);

        if (error) {
          console.error('Error updating property note:', error);
          alert('Failed to update property note. Please try again.');
          return;
        }

        // Update local state
        setPropertyNotes(prev => {
          const newMap = new Map(prev);
          newMap.set(propertyName, {
            ...existingNote,
            note_text: noteText,
            updated_at: new Date().toISOString()
          });
          return newMap;
        });

        console.log('✅ Property note updated');
      } else {
        // Insert new note
        const { data, error } = await supabase
          .from('property_ar_notes')
          .insert({
            property_name: propertyName,
            note_text: noteText,
            created_by: userName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating property note:', error);
          alert('Failed to create property note. Please try again.');
          return;
        }

        // Update local state
        setPropertyNotes(prev => {
          const newMap = new Map(prev);
          newMap.set(propertyName, data);
          return newMap;
        });

        console.log('✅ Property note created');
      }

      handleClosePropertyNoteModal();
    } catch (error) {
      console.error('Error in handleSavePropertyNote:', error);
      alert('Failed to save property note. Please try again.');
    }
  };

  const handleEditPropertyNote = async (propertyName: string, noteText: string) => {
    try {
      const { error } = await supabase
        .from('property_ar_notes')
        .update({
          note_text: noteText,
          updated_at: new Date().toISOString()
        })
        .eq('property_name', propertyName);

      if (error) {
        console.error('Error updating property note:', error);
        alert('Failed to update property note. Please try again.');
        return;
      }

      // Update local state
      const existingNote = propertyNotes.get(propertyName);
      if (existingNote) {
        setPropertyNotes(prev => {
          const newMap = new Map(prev);
          newMap.set(propertyName, {
            ...existingNote,
            note_text: noteText,
            updated_at: new Date().toISOString()
          });
          return newMap;
        });
      }

      console.log('✅ Property note updated');
    } catch (error) {
      console.error('Error in handleEditPropertyNote:', error);
      alert('Failed to update property note. Please try again.');
    }
  };

  const handleDeletePropertyNote = async (propertyName: string) => {
    try {
      const { error } = await supabase
        .from('property_ar_notes')
        .delete()
        .eq('property_name', propertyName);

      if (error) {
        console.error('Error deleting property note:', error);
        alert('Failed to delete property note. Please try again.');
        return;
      }

      // Update local state
      setPropertyNotes(prev => {
        const newMap = new Map(prev);
        newMap.delete(propertyName);
        return newMap;
      });

      console.log('✅ Property note deleted');
    } catch (error) {
      console.error('Error in handleDeletePropertyNote:', error);
      alert('Failed to delete property note. Please try again.');
    }
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

            <SummaryCards 
              buckets={buckets}
              selectedBucket={selectedBucket}
              onBucketSelect={setSelectedBucket}
            />

            <InvoiceTable 
              invoices={filteredInvoices}
              branches={branches}
              companies={companies}
              properties={properties}
              selectedBranch={selectedBranch}
              selectedCompany={selectedCompany}
              selectedProperty={selectedProperty}
              selectedGhosting={selectedGhosting}
              selectedTerminated={selectedTerminated}
              selectedPaymentStatus={selectedPaymentStatus}
              showCurrentInvoices={showCurrentInvoices}
              propertyNotes={propertyNotes}
              onBranchChange={setSelectedBranch}
              onCompanyChange={setSelectedCompany}
              onPropertyChange={setSelectedProperty}
              onGhostingChange={setSelectedGhosting}
              onTerminatedChange={setSelectedTerminated}
              onPaymentStatusChange={setSelectedPaymentStatus}
              onShowCurrentInvoicesChange={setShowCurrentInvoices}
              onAddNote={handleOpenNoteModal}
              onAddFollowUp={handleOpenFollowUpModal}
              onEditNote={editNote}
              onDeleteNote={deleteNote}
              onToggleGhosting={toggleGhosting}
              onToggleTerminated={toggleTerminated}
              onUpdatePaymentStatus={updatePaymentStatus}
              onAddPropertyNote={handleOpenPropertyNoteModal}
              onEditPropertyNote={handleEditPropertyNote}
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

      {showPropertyNoteModal && selectedPropertyForNote && (
        <AddPropertyNoteModal 
          propertyName={selectedPropertyForNote}
          existingNote={propertyNotes.get(selectedPropertyForNote)?.note_text || ''}
          onClose={handleClosePropertyNoteModal}
          onSave={handleSavePropertyNote}
        />
      )}
    </div>
  );
}