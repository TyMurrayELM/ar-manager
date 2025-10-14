import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Invoice, FollowUp, BucketSummary, Bucket, MonthlySnapshot, CompanyBreakdown, PaymentStatus } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export function useInvoices() {
  const { user } = useAuth();
  const CURRENT_USER = user?.user_metadata?.full_name || user?.email || 'Unknown User';

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [selectedBucket, setSelectedBucket] = useState('121+');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [selectedProperty, setSelectedProperty] = useState('all');
  const [selectedRegion, setSelectedRegion] = useState<'all' | 'phoenix' | 'las-vegas'>('all');
  const [selectedGhosting, setSelectedGhosting] = useState<'all' | 'ghosting' | 'not-ghosting'>('all');
  const [selectedTerminated, setSelectedTerminated] = useState<'all' | 'terminated' | 'not-terminated'>('all');

  useEffect(() => {
    loadInvoiceDataFromSupabase();
    loadFollowUps();
    loadSnapshots();
    loadLastSyncTime();
  }, []);

  useEffect(() => {
    const bucketFilteredInvoices = invoices.filter(inv => {
      if (selectedRegion === 'phoenix') {
        const phoenixBranches = ['Phx - North', 'Phx - SouthWest', 'Phx - SouthEast', 'Corporate'];
        if (!phoenixBranches.includes(inv.branchName)) return false;
      } else if (selectedRegion === 'las-vegas') {
        if (!inv.branchName?.toLowerCase().includes('vegas') && !inv.branchName?.toLowerCase().includes('las vegas')) return false;
      }
      
      if (selectedBucket === 'all') return inv.amountRemaining > 0;
      
      switch(selectedBucket) {
        case '1-30': return inv.aging_1_30 > 0;
        case '31-60': return inv.aging_31_60 > 0;
        case '61-90': return inv.aging_61_90 > 0;
        case '91-120': return inv.aging_91_120 > 0;
        case '121+': return inv.aging_121_plus > 0;
        default: return true;
      }
    });

    const availableBranches = new Set(bucketFilteredInvoices.map(inv => inv.branchName).filter(Boolean));
    const availableCompanies = new Set(bucketFilteredInvoices.map(inv => inv.companyName).filter(Boolean));
    const availableProperties = new Set(bucketFilteredInvoices.map(inv => inv.propertyName).filter(Boolean));

    if (selectedBranch !== 'all' && !availableBranches.has(selectedBranch)) {
      setSelectedBranch('all');
    }
    if (selectedCompany !== 'all' && !availableCompanies.has(selectedCompany)) {
      setSelectedCompany('all');
    }
    if (selectedProperty !== 'all' && !availableProperties.has(selectedProperty)) {
      setSelectedProperty('all');
    }
  }, [selectedBucket, selectedRegion, invoices]);

  const loadLastSyncTime = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'last_aspire_sync')
        .single();

      if (error) {
        if (error.code !== 'PGRST116') {
          console.warn('Error loading last sync time:', error);
        }
        return;
      }

      if (data?.value) {
        setLastSyncTime(data.value);
        console.log('✅ Loaded last sync time:', data.value);
      }
    } catch (error) {
      console.warn('Error in loadLastSyncTime:', error);
    }
  };

  const updateLastSyncTime = async () => {
    try {
      const syncTime = new Date().toISOString();
      
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'last_aspire_sync',
          value: syncTime,
          updated_by: CURRENT_USER,
          updated_at: syncTime
        }, {
          onConflict: 'key'
        });

      if (error) {
        console.error('Error saving last sync time:', error);
        return;
      }

      setLastSyncTime(syncTime);
      console.log('✅ Saved last sync time:', syncTime);
    } catch (error) {
      console.error('Error in updateLastSyncTime:', error);
    }
  };

  const syncFromAspire = async () => {
    try {
      setSyncing(true);
      console.log('🔄 Starting Aspire sync...');

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log('Session debug:', {
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
        userId: session?.user?.id,
        email: session?.user?.email,
        error: sessionError
      });
      
      if (!session || !session.access_token) {
        throw new Error('Not authenticated. Please sign in again.');
      }

      console.log('✅ Got session, calling API with auth token...');
      console.log('Token length:', session.access_token.length);
      console.log('Token preview:', session.access_token.substring(0, 20) + '...');

      const response = await fetch('/api/sync-aspire', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      console.log('Response status:', response.status);
      const result = await response.json();
      console.log('Response body:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Sync failed');
      }

      console.log('✅ Aspire sync completed:', result.message);
      
      await updateLastSyncTime();
      
      alert(`✅ ${result.message}`);

      await loadInvoiceDataFromSupabase();

    } catch (error: any) {
      console.error('❌ Aspire sync error:', error);
      alert(`❌ Sync failed: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const loadInvoiceDataFromSupabase = async () => {
    try {
      setLoading(true);
      
      console.log('=== SUPABASE DEBUG ===');
      console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.log('Key exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
      
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        console.error('⚠️ Supabase URL missing! Check .env.local file');
        setInvoices([]);
        setLoading(false);
        return;
      }
      
      console.log('Attempting to fetch from Supabase...');
      
      let allData: any[] = [];
      let start = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error, count } = await supabase
          .from('ar_aging_invoices')
          .select('*', { count: 'exact' })
          .order('due_date', { ascending: true })
          .range(start, start + batchSize - 1);

        if (error) {
          console.error('Supabase Error Details:', JSON.stringify(error, null, 2));
          console.error('Common issues:');
          console.error('1. Table name might be wrong (check it\'s exactly: ar_aging_invoices)');
          console.error('2. RLS policies might be blocking access');
          console.error('3. API credentials might be incorrect');
          setInvoices([]);
          setLoading(false);
          return;
        }

        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allData = [...allData, ...data];
          console.log(`Fetched batch: ${start}-${start + data.length - 1}, Total so far: ${allData.length}`);
          
          if (count && allData.length >= count) {
            hasMore = false;
          } else if (data.length < batchSize) {
            hasMore = false;
          } else {
            start += batchSize;
          }
        }
      }

      console.log('Response received');
      console.log('Error:', null);
      console.log('Data count:', allData.length);

      if (!allData || allData.length === 0) {
        console.warn('⚠️ No data returned from Supabase. Table might be empty. Run Aspire sync to populate data.');
        setInvoices([]);
        setLoading(false);
        return;
      }

      const transformedData = allData.map(row => ({
        invoice_id: row.invoice_id,
        invoiceNumber: row.invoice_number,
        companyName: row.company_name,
        propertyName: row.property_name,
        opportunityName: row.opportunity_name,
        opportunityNumber: row.opportunity_number,
        branchName: row.branch_name,
        amount: row.amount || 0,
        amountRemaining: row.amount_remaining || 0,
        dueDate: row.due_date,
        invoiceDate: row.invoice_date,
        pastDue: row.past_due || 0,
        agingCategory: row.aging_category,
        aging_1_30: row.aging_1_30 || 0,
        aging_31_60: row.aging_31_60 || 0,
        aging_61_90: row.aging_61_90 || 0,
        aging_91_120: row.aging_91_120 || 0,
        aging_121_plus: row.aging_121_plus || 0,
        primaryContactName: row.primary_contact_name,
        primaryContactEmail: row.primary_contact_email,
        billingContactName: row.billing_contact_name,
        billingContactEmail: row.billing_contact_email,
        paymentTerms: row.payment_terms_name,
        comments: row.comments || '',
        followUpCategory: row.follow_up_category,
        isGhosting: row.is_ghosting || false,
        isTerminated: row.is_terminated || false,
        paymentStatus: row.payment_status || 'No Follow Up',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        notes: []
      }));

      console.log('✅ Successfully loaded', transformedData.length, 'invoices from Supabase');
      
      await loadNotesForInvoices(transformedData);
      
      setLoading(false);
    } catch (error) {
      console.error('Caught error during load:', error);
      setInvoices([]);
      setLoading(false);
    }
  };

  const loadFollowUps = async () => {
    try {
      const { data, error } = await supabase
        .from('follow_ups')
        .select('*')
        .order('follow_up_date', { ascending: true })
        .limit(10000);

      if (error) {
        console.warn('Could not load follow-ups:', error);
        return;
      }

      const transformedFollowUps = data?.map(row => ({
        id: row.id,
        invoiceId: row.invoice_id,
        noteId: row.note_id,
        invoiceNumber: row.invoice_number,
        companyName: row.company_name,
        propertyName: row.property_name,
        amount: row.amount,
        noteText: row.note_text,
        followUpDate: row.follow_up_date,
        createdBy: row.created_by,
        createdAt: row.created_at,
        completed: row.completed,
        completedAt: row.completed_at
      })) || [];

      setFollowUps(transformedFollowUps);
      console.log('✅ Loaded', transformedFollowUps.length, 'follow-ups from database');
    } catch (error) {
      console.warn('Error loading follow-ups:', error);
    }
  };

  const loadNotesForInvoices = async (invoiceList: Invoice[]) => {
    try {
      const { data: notesData, error: notesError } = await supabase
        .from('invoice_notes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10000);

      if (notesError) {
        console.warn('Could not load notes:', notesError);
      }

      const { data: followUpsData, error: followUpsError } = await supabase
        .from('follow_ups')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10000);

      if (followUpsError) {
        console.warn('Could not load follow-ups for invoices:', followUpsError);
      }

      const notesByInvoice: Record<number, any[]> = {};
      notesData?.forEach(note => {
        if (!notesByInvoice[note.invoice_id]) {
          notesByInvoice[note.invoice_id] = [];
        }
        notesByInvoice[note.invoice_id].push(note);
      });

      const followUpsByInvoice: Record<number, any[]> = {};
      followUpsData?.forEach(followUp => {
        if (!followUpsByInvoice[followUp.invoice_id]) {
          followUpsByInvoice[followUp.invoice_id] = [];
        }
        followUpsByInvoice[followUp.invoice_id].push({
          id: followUp.id,
          invoiceId: followUp.invoice_id,
          noteId: followUp.note_id,
          invoiceNumber: followUp.invoice_number,
          companyName: followUp.company_name,
          propertyName: followUp.property_name,
          amount: followUp.amount,
          noteText: followUp.note_text,
          followUpDate: followUp.follow_up_date,
          createdBy: followUp.created_by,
          createdAt: followUp.created_at,
          completed: followUp.completed,
          completedAt: followUp.completed_at
        });
      });

      const invoicesWithNotesAndFollowUps = invoiceList.map(inv => ({
        ...inv,
        notes: notesByInvoice[inv.invoice_id] || [],
        followUpsForInvoice: followUpsByInvoice[inv.invoice_id] || []
      }));

      setInvoices(invoicesWithNotesAndFollowUps);
    } catch (error) {
      console.warn('Error loading notes and follow-ups:', error);
      setInvoices(invoiceList);
    }
  };

  const loadSnapshots = async () => {
    try {
      const { data, error } = await supabase
        .from('monthly_ar_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: false });

      if (error) {
        console.warn('Could not load snapshots:', error);
        return;
      }

      const transformedSnapshots = data?.map(row => ({
        id: row.id,
        snapshot_date: row.snapshot_date,
        region: row.region,
        total_outstanding: row.total_outstanding,
        invoice_count: row.invoice_count,
        aging_1_30: row.aging_1_30,
        aging_31_60: row.aging_31_60,
        aging_61_90: row.aging_61_90,
        aging_91_120: row.aging_91_120,
        aging_121_plus: row.aging_121_plus,
        count_1_30: row.count_1_30,
        count_31_60: row.count_31_60,
        count_61_90: row.count_61_90,
        count_91_120: row.count_91_120,
        count_121_plus: row.count_121_plus,
        company_breakdown: row.company_breakdown,
        created_at: row.created_at,
        created_by: row.created_by
      })) || [];

      setSnapshots(transformedSnapshots);
      console.log('✅ Loaded', transformedSnapshots.length, 'snapshots');
    } catch (error) {
      console.warn('Error loading snapshots:', error);
    }
  };

  const createSnapshot = async (snapshotDate?: string) => {
    try {
      const date = snapshotDate || getLastDayOfMonth(new Date());
      
      const regions: Array<'all' | 'phoenix' | 'las-vegas'> = ['all', 'phoenix', 'las-vegas'];
      
      for (const region of regions) {
        const regionInvoices = invoices.filter(inv => {
          if (region === 'phoenix') {
            const phoenixBranches = ['Phx - North', 'Phx - SouthWest', 'Phx - SouthEast', 'Corporate'];
            return phoenixBranches.includes(inv.branchName);
          } else if (region === 'las-vegas') {
            return inv.branchName?.toLowerCase().includes('vegas') || inv.branchName?.toLowerCase().includes('las vegas');
          }
          return true;
        });

        const totals = {
          total_outstanding: 0,
          invoice_count: regionInvoices.length,
          aging_1_30: 0,
          aging_31_60: 0,
          aging_61_90: 0,
          aging_91_120: 0,
          aging_121_plus: 0,
          count_1_30: 0,
          count_31_60: 0,
          count_61_90: 0,
          count_91_120: 0,
          count_121_plus: 0
        };

        const companyMap = new Map<string, CompanyBreakdown>();

        regionInvoices.forEach(inv => {
          totals.total_outstanding += inv.amountRemaining;
          totals.aging_1_30 += inv.aging_1_30;
          totals.aging_31_60 += inv.aging_31_60;
          totals.aging_61_90 += inv.aging_61_90;
          totals.aging_91_120 += inv.aging_91_120;
          totals.aging_121_plus += inv.aging_121_plus;

          if (inv.aging_1_30 > 0) totals.count_1_30++;
          if (inv.aging_31_60 > 0) totals.count_31_60++;
          if (inv.aging_61_90 > 0) totals.count_61_90++;
          if (inv.aging_91_120 > 0) totals.count_91_120++;
          if (inv.aging_121_plus > 0) totals.count_121_plus++;

          const existing = companyMap.get(inv.companyName) || {
            company: inv.companyName,
            total: 0,
            count: 0,
            aging_1_30: 0,
            aging_31_60: 0,
            aging_61_90: 0,
            aging_91_120: 0,
            aging_121_plus: 0
          };

          existing.total += inv.amountRemaining;
          existing.count += 1;
          existing.aging_1_30 += inv.aging_1_30;
          existing.aging_31_60 += inv.aging_31_60;
          existing.aging_61_90 += inv.aging_61_90;
          existing.aging_91_120 += inv.aging_91_120;
          existing.aging_121_plus += inv.aging_121_plus;

          companyMap.set(inv.companyName, existing);
        });

        const companyBreakdown = Array.from(companyMap.values())
          .sort((a, b) => b.total - a.total)
          .slice(0, 20);

        const { error } = await supabase
          .from('monthly_ar_snapshots')
          .upsert({
            snapshot_date: date,
            region: region,
            total_outstanding: totals.total_outstanding,
            invoice_count: totals.invoice_count,
            aging_1_30: totals.aging_1_30,
            aging_31_60: totals.aging_31_60,
            aging_61_90: totals.aging_61_90,
            aging_91_120: totals.aging_91_120,
            aging_121_plus: totals.aging_121_plus,
            count_1_30: totals.count_1_30,
            count_31_60: totals.count_31_60,
            count_61_90: totals.count_61_90,
            count_91_120: totals.count_91_120,
            count_121_plus: totals.count_121_plus,
            company_breakdown: companyBreakdown,
            created_by: CURRENT_USER
          }, {
            onConflict: 'snapshot_date,region'
          });

        if (error) {
          console.error('Error saving snapshot for', region, ':', error);
          throw error;
        }
      }

      console.log('✅ Snapshots created for date:', date);
      
      await loadSnapshots();
      
      return true;
    } catch (error) {
      console.error('Error creating snapshot:', error);
      alert('Failed to create snapshot. Please try again.');
      return false;
    }
  };

  const getLastDayOfMonth = (date: Date): string => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const lastDay = new Date(year, month + 1, 0);
    
    const yyyy = lastDay.getFullYear();
    const mm = String(lastDay.getMonth() + 1).padStart(2, '0');
    const dd = String(lastDay.getDate()).padStart(2, '0');
    
    return `${yyyy}-${mm}-${dd}`;
  };

  const getBucketSummaries = (): Record<string, BucketSummary> => {
    const summaries: Record<string, BucketSummary> = {
      all: { count: 0, value: 0 },
      '1-30': { count: 0, value: 0 },
      '31-60': { count: 0, value: 0 },
      '61-90': { count: 0, value: 0 },
      '91-120': { count: 0, value: 0 },
      '121+': { count: 0, value: 0 }
    };

    const regionFilteredInvoices = invoices.filter(inv => {
      if (selectedRegion === 'phoenix') {
        const phoenixBranches = ['Phx - North', 'Phx - SouthWest', 'Phx - SouthEast', 'Corporate'];
        return phoenixBranches.includes(inv.branchName);
      } else if (selectedRegion === 'las-vegas') {
        return inv.branchName?.toLowerCase().includes('vegas') || inv.branchName?.toLowerCase().includes('las vegas');
      }
      return true;
    });

    regionFilteredInvoices.forEach(inv => {
      const remaining = inv.amountRemaining;
      summaries.all.count++;
      summaries.all.value += remaining;

      if (inv.aging_1_30 > 0) {
        summaries['1-30'].count++;
        summaries['1-30'].value += inv.aging_1_30;
      }
      if (inv.aging_31_60 > 0) {
        summaries['31-60'].count++;
        summaries['31-60'].value += inv.aging_31_60;
      }
      if (inv.aging_61_90 > 0) {
        summaries['61-90'].count++;
        summaries['61-90'].value += inv.aging_61_90;
      }
      if (inv.aging_91_120 > 0) {
        summaries['91-120'].count++;
        summaries['91-120'].value += inv.aging_91_120;
      }
      if (inv.aging_121_plus > 0) {
        summaries['121+'].count++;
        summaries['121+'].value += inv.aging_121_plus;
      }
    });

    return summaries;
  };

  const buckets: Bucket[] = (() => {
    const summaries = getBucketSummaries();
    return [
      { id: 'all', label: 'All Outstanding', count: summaries.all.count, value: summaries.all.value },
      { id: '1-30', label: '1-30 Days', count: summaries['1-30'].count, value: summaries['1-30'].value },
      { id: '31-60', label: '31-60 Days', count: summaries['31-60'].count, value: summaries['31-60'].value },
      { id: '61-90', label: '61-90 Days', count: summaries['61-90'].count, value: summaries['61-90'].value },
      { id: '91-120', label: '91-120 Days', count: summaries['91-120'].count, value: summaries['91-120'].value },
      { id: '121+', label: '121+ Days', count: summaries['121+'].count, value: summaries['121+'].value }
    ];
  })();

  const filteredInvoices = invoices.filter(inv => {
    if (selectedRegion === 'phoenix') {
      const phoenixBranches = ['Phx - North', 'Phx - SouthWest', 'Phx - SouthEast', 'Corporate'];
      if (!phoenixBranches.includes(inv.branchName)) return false;
    } else if (selectedRegion === 'las-vegas') {
      if (!inv.branchName?.toLowerCase().includes('vegas') && !inv.branchName?.toLowerCase().includes('las vegas')) return false;
    }
    
    if (selectedBucket === 'all') return inv.amountRemaining > 0;
    
    switch(selectedBucket) {
      case '1-30': return inv.aging_1_30 > 0;
      case '31-60': return inv.aging_31_60 > 0;
      case '61-90': return inv.aging_61_90 > 0;
      case '91-120': return inv.aging_91_120 > 0;
      case '121+': return inv.aging_121_plus > 0;
      default: return true;
    }
  }).filter(inv => {
    if (selectedBranch === 'all') return true;
    return inv.branchName === selectedBranch;
  }).filter(inv => {
    if (selectedCompany === 'all') return true;
    return inv.companyName === selectedCompany;
  }).filter(inv => {
    if (selectedProperty === 'all') return true;
    return inv.propertyName === selectedProperty;
  }).filter(inv => {
    if (selectedGhosting === 'all') return true;
    if (selectedGhosting === 'ghosting') return inv.isGhosting === true;
    if (selectedGhosting === 'not-ghosting') return inv.isGhosting !== true;
    return true;
  }).filter(inv => {
    if (selectedTerminated === 'all') return true;
    if (selectedTerminated === 'terminated') return inv.isTerminated === true;
    if (selectedTerminated === 'not-terminated') return inv.isTerminated !== true;
    return true;
  });

  const bucketFilteredInvoices = invoices.filter(inv => {
    if (selectedRegion === 'phoenix') {
      const phoenixBranches = ['Phx - North', 'Phx - SouthWest', 'Phx - SouthEast', 'Corporate'];
      if (!phoenixBranches.includes(inv.branchName)) return false;
    } else if (selectedRegion === 'las-vegas') {
      if (!inv.branchName?.toLowerCase().includes('vegas') && !inv.branchName?.toLowerCase().includes('las vegas')) return false;
    }
    
    if (selectedBucket === 'all') return inv.amountRemaining > 0;
    
    switch(selectedBucket) {
      case '1-30': return inv.aging_1_30 > 0;
      case '31-60': return inv.aging_31_60 > 0;
      case '61-90': return inv.aging_61_90 > 0;
      case '91-120': return inv.aging_91_120 > 0;
      case '121+': return inv.aging_121_plus > 0;
      default: return true;
    }
  });

  const branches = ['all', ...new Set(bucketFilteredInvoices.map(inv => inv.branchName).filter(Boolean))];
  const companies = ['all', ...new Set(bucketFilteredInvoices.map(inv => inv.companyName).filter(Boolean))].sort((a, b) => {
    if (a === 'all') return -1;
    if (b === 'all') return 1;
    return a.localeCompare(b);
  });
  
  const propertySet = new Set<string>();
  bucketFilteredInvoices.forEach(inv => {
    if (inv.propertyName && inv.propertyName.trim() !== '') {
      propertySet.add(inv.propertyName);
    }
  });
  const properties: string[] = ['all', ...Array.from(propertySet)].sort((a, b) => {
    if (a === 'all') return -1;
    if (b === 'all') return 1;
    return a.localeCompare(b);
  });

  const addNote = async (invoice: Invoice, noteText: string) => {
    try {
      const { data: newNote, error } = await supabase
        .from('invoice_notes')
        .insert({
          invoice_id: invoice.invoice_id,
          note_text: noteText,
          created_by: CURRENT_USER,
          is_follow_up: false,
          follow_up_date: null
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving note:', error);
        alert('Failed to save note. Please try again.');
        return;
      }

      console.log('✅ Note saved to database');

      setInvoices(prev => prev.map(inv => {
        if (inv.invoice_id === invoice.invoice_id) {
          return {
            ...inv,
            notes: [newNote, ...inv.notes]
          };
        }
        return inv;
      }));
    } catch (error) {
      console.error('Error in addNote:', error);
      alert('Failed to save note. Please try again.');
    }
  };

  const addFollowUp = async (invoice: Invoice, noteText: string, followUpDate: string) => {
    try {
      // Insert follow-up directly (no note needed)
      const { data: followUpData, error: followUpError } = await supabase
        .from('follow_ups')
        .insert({
          invoice_id: invoice.invoice_id,
          note_id: null,
          invoice_number: invoice.invoiceNumber,
          company_name: invoice.companyName,
          property_name: invoice.propertyName,
          amount: invoice.amountRemaining,
          note_text: noteText,
          follow_up_date: followUpDate,
          created_by: CURRENT_USER,
          completed: false
        })
        .select()
        .single();

      if (followUpError) {
        console.error('Error creating follow-up:', followUpError);
        alert('Failed to create follow-up. Please try again.');
        return;
      }

      console.log('✅ Follow-up saved to database');

      setInvoices(prev => prev.map(inv => {
        if (inv.invoice_id === invoice.invoice_id) {
          return {
            ...inv,
            followUpsForInvoice: [
              ...(inv.followUpsForInvoice || []),
              {
                id: followUpData.id,
                invoiceId: followUpData.invoice_id,
                noteId: followUpData.note_id || undefined,
                invoiceNumber: followUpData.invoice_number,
                companyName: followUpData.company_name,
                propertyName: followUpData.property_name,
                amount: followUpData.amount,
                noteText: followUpData.note_text,
                followUpDate: followUpData.follow_up_date,
                createdBy: followUpData.created_by,
                createdAt: followUpData.created_at,
                completed: followUpData.completed,
                completedAt: followUpData.completed_at
              }
            ]
          };
        }
        return inv;
      }));

      const newFollowUp: FollowUp = {
        id: followUpData.id,
        invoiceId: followUpData.invoice_id,
        noteId: followUpData.note_id || undefined,
        invoiceNumber: followUpData.invoice_number,
        companyName: followUpData.company_name,
        propertyName: followUpData.property_name,
        amount: followUpData.amount,
        noteText: followUpData.note_text,
        followUpDate: followUpData.follow_up_date,
        createdBy: followUpData.created_by,
        createdAt: followUpData.created_at,
        completed: followUpData.completed,
        completedAt: followUpData.completed_at
      };
      setFollowUps(prev => [...prev, newFollowUp]);
    } catch (error) {
      console.error('Error in addFollowUp:', error);
      alert('Failed to save follow-up. Please try again.');
    }
  };

  const completeFollowUp = async (followUpId: number) => {
    try {
      const currentFollowUp = followUps.find(fu => fu.id === followUpId);
      if (!currentFollowUp) return;

      const newCompletedStatus = !currentFollowUp.completed;
      const completedAt = newCompletedStatus ? new Date().toISOString() : null;

      const { error } = await supabase
        .from('follow_ups')
        .update({ 
          completed: newCompletedStatus,
          completed_at: completedAt
        })
        .eq('id', followUpId);

      if (error) {
        console.error('Error toggling follow-up:', error);
        return;
      }

      setFollowUps(prev => prev.map(fu => 
        fu.id === followUpId 
          ? { ...fu, completed: newCompletedStatus, completedAt: completedAt || undefined } 
          : fu
      ));

      setInvoices(prev => prev.map(inv => ({
        ...inv,
        followUpsForInvoice: inv.followUpsForInvoice?.map(fu =>
          fu.id === followUpId
            ? { ...fu, completed: newCompletedStatus, completedAt: completedAt || undefined }
            : fu
        ) || []
      })));

      console.log(`✅ Follow-up ${newCompletedStatus ? 'completed' : 'reopened'}`);
    } catch (error) {
      console.error('Error in completeFollowUp:', error);
    }
  };

  const deleteFollowUp = async (followUpId: number) => {
    try {
      const { error } = await supabase
        .from('follow_ups')
        .delete()
        .eq('id', followUpId);

      if (error) {
        console.error('Error deleting follow-up:', error);
        return;
      }

      setFollowUps(prev => prev.filter(fu => fu.id !== followUpId));

      setInvoices(prev => prev.map(inv => ({
        ...inv,
        followUpsForInvoice: inv.followUpsForInvoice?.filter(fu => fu.id !== followUpId) || []
      })));

      console.log('✅ Follow-up deleted');
    } catch (error) {
      console.error('Error in deleteFollowUp:', error);
    }
  };

  const editNote = async (noteId: number, newText: string) => {
    try {
      const { error } = await supabase
        .from('invoice_notes')
        .update({ note_text: newText })
        .eq('id', noteId);

      if (error) {
        console.error('Error editing note:', error);
        alert('Failed to edit note. Please try again.');
        return;
      }

      setInvoices(prev => prev.map(inv => ({
        ...inv,
        notes: inv.notes.map(note => 
          note.id === noteId ? { ...note, note_text: newText } : note
        )
      })));

      console.log('✅ Note updated');
    } catch (error) {
      console.error('Error in editNote:', error);
      alert('Failed to edit note. Please try again.');
    }
  };

  const deleteNote = async (noteId: number, invoiceId: number) => {
    try {
      const { error } = await supabase
        .from('invoice_notes')
        .delete()
        .eq('id', noteId);

      if (error) {
        console.error('Error deleting note:', error);
        alert('Failed to delete note. Please try again.');
        return;
      }

      setInvoices(prev => prev.map(inv => 
        inv.invoice_id === invoiceId 
          ? { ...inv, notes: inv.notes.filter(note => note.id !== noteId) }
          : inv
      ));

      console.log('✅ Note deleted');
    } catch (error) {
      console.error('Error in deleteNote:', error);
      alert('Failed to delete note. Please try again.');
    }
  };

  const editFollowUp = async (followUpId: number, newText: string, newDate: string) => {
    try {
      const { error } = await supabase
        .from('follow_ups')
        .update({ 
          note_text: newText,
          follow_up_date: newDate
        })
        .eq('id', followUpId);

      if (error) {
        console.error('Error editing follow-up:', error);
        alert('Failed to edit follow-up. Please try again.');
        return;
      }

      setFollowUps(prev => prev.map(fu => 
        fu.id === followUpId 
          ? { ...fu, noteText: newText, followUpDate: newDate }
          : fu
      ));

      setInvoices(prev => prev.map(inv => ({
        ...inv,
        followUpsForInvoice: inv.followUpsForInvoice?.map(fu =>
          fu.id === followUpId
            ? { ...fu, noteText: newText, followUpDate: newDate }
            : fu
        ) || []
      })));

      console.log('✅ Follow-up updated');
    } catch (error) {
      console.error('Error in editFollowUp:', error);
      alert('Failed to edit follow-up. Please try again.');
    }
  };

  const toggleGhosting = async (invoiceId: number, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      
      const { error } = await supabase
        .from('ar_aging_invoices')
        .update({ is_ghosting: newStatus })
        .eq('invoice_id', invoiceId);

      if (error) {
        console.error('Error toggling ghosting status:', error);
        alert('Failed to update ghosting status. Please try again.');
        return;
      }

      setInvoices(prev => prev.map(inv => 
        inv.invoice_id === invoiceId 
          ? { ...inv, isGhosting: newStatus }
          : inv
      ));

      console.log('✅ Ghosting status updated');
    } catch (error) {
      console.error('Error in toggleGhosting:', error);
      alert('Failed to update ghosting status. Please try again.');
    }
  };

  const toggleTerminated = async (invoiceId: number, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      
      const { error } = await supabase
        .from('ar_aging_invoices')
        .update({ is_terminated: newStatus })
        .eq('invoice_id', invoiceId);

      if (error) {
        console.error('Error toggling terminated status:', error);
        alert('Failed to update terminated status. Please try again.');
        return;
      }

      setInvoices(prev => prev.map(inv => 
        inv.invoice_id === invoiceId 
          ? { ...inv, isTerminated: newStatus }
          : inv
      ));

      console.log('✅ Terminated status updated');
    } catch (error) {
      console.error('Error in toggleTerminated:', error);
      alert('Failed to update terminated status. Please try again.');
    }
  };

  const updatePaymentStatus = async (invoiceId: number, status: PaymentStatus) => {
    try {
      const { error } = await supabase
        .from('ar_aging_invoices')
        .update({ payment_status: status })
        .eq('invoice_id', invoiceId);

      if (error) {
        console.error('Error updating payment status:', error);
        alert('Failed to update payment status. Please try again.');
        return;
      }

      setInvoices(prev => prev.map(inv => 
        inv.invoice_id === invoiceId 
          ? { ...inv, paymentStatus: status }
          : inv
      ));

      console.log('✅ Payment status updated to:', status);
    } catch (error) {
      console.error('Error in updatePaymentStatus:', error);
      alert('Failed to update payment status. Please try again.');
    }
  };

  return {
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
    setSelectedBucket,
    setSelectedBranch,
    setSelectedCompany,
    setSelectedProperty,
    setSelectedRegion,
    setSelectedGhosting,
    setSelectedTerminated,
    syncFromAspire,
    loadInvoiceData: loadInvoiceDataFromSupabase,
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
    createSnapshot,
    loadSnapshots
  };
}