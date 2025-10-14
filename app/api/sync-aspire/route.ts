import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const CLIENT_ID = 'd6a41ec9-8b16-4638-832f-034769f9e80e';
const API_KEY = 'AsRVgRptwc1mrtXMquNDdsaTlMTar2WE';
const VERCEL_PROXY_URL = 'https://aspire-api-u4pfnjws3-tymurrayelms-projects.vercel.app/api/aspire-proxy';
const PAGE_SIZE = 1000;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

interface AspireInvoice {
  InvoiceID: number;
  InvoiceNumber: string;
  CompanyName: string;
  PropertyName?: string;
  BranchName: string;
  Amount: number;
  AmountRemaining: number;
  DueDate: string;
  InvoiceDate: string;
  BillingContactID?: number;
  BillingContactName?: string;
  BillingContactEmail?: string;
  PrimaryContactID?: number;
  PrimaryContactName?: string;
  PrimaryContactEmail?: string;
  PaymentTermsName?: string;
  InvoiceOpportunities?: Array<{
    OpportunityName?: string;
    OpportunityNumber?: string;
  }>;
}

interface Contact {
  ContactID: number;
  Email?: string;
}

interface ProcessedInvoiceData {
  invoice_id: number;
  invoice_number: string;
  company_name: string;
  property_name: string;
  opportunity_name: string;
  opportunity_number: string;
  branch_name: string;
  amount: number;
  amount_remaining: number;
  due_date: string | null;
  invoice_date: string | null;
  past_due: number;
  aging_category: string;
  aging_1_30: number;
  aging_31_60: number;
  aging_61_90: number;
  aging_91_120: number;
  aging_121_plus: number;
  primary_contact_name: string;
  primary_contact_email: string;
  billing_contact_name: string;
  billing_contact_email: string;
  payment_terms_name: string;
}

export async function POST(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    console.log('=== API ROUTE DEBUG ===');
    console.log('Auth header present:', !!authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ No valid authorization header found');
      return NextResponse.json({ error: 'Unauthorized - No auth header' }, { status: 401 });
    }

    // Extract the token
    const token = authHeader.replace('Bearer ', '');
    console.log('Token extracted, length:', token.length);

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Verify the JWT token by getting the user with the token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    console.log('Auth check result:', { 
      hasUser: !!user, 
      userId: user?.id,
      email: user?.email,
      error: userError?.message 
    });

    if (!user || userError) {
      console.error('❌ Authentication failed:', userError?.message);
      return NextResponse.json({ error: 'Unauthorized - Invalid session' }, { status: 401 });
    }

    console.log('✅ Authenticated user:', user.email);
    console.log('Starting Aspire sync...');

    // Step 1: Fetch all invoices
    const invoices = await fetchAllInvoices();
    console.log(`Fetched ${invoices.length} invoices`);

    if (invoices.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No invoices found',
        count: 0 
      });
    }

    // Step 2: Enrich with contact emails
    const enrichedInvoices = await enrichInvoicesWithContactEmails(invoices);
    console.log(`Enriched invoices with contact emails`);

    // Step 3: Process and transform data
    const processedData = processInvoiceData(enrichedInvoices);
    console.log(`Processed ${processedData.length} invoices`);

    // Step 4: Write to Supabase (use service role for writes)
    const supabaseServiceRole = createClient(
      supabaseUrl, 
      process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey
    );
    await writeToSupabase(supabaseServiceRole, processedData);
    console.log(`Wrote ${processedData.length} invoices to Supabase`);

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${processedData.length} invoices`,
      count: processedData.length
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to sync from Aspire';
    console.error('Error syncing from Aspire:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

async function fetchAllInvoices(): Promise<AspireInvoice[]> {
  const allInvoices: AspireInvoice[] = [];
  let lastMaxId = 0;
  let hasMoreData = true;
  let page = 1;
  const maxPages = 100;
  const baseFilter = 'AmountRemaining gt 0';

  console.log('Fetching invoices with positive amounts only...');

  while (hasMoreData && page <= maxPages) {
    console.log(`Fetching page ${page} (InvoiceID > ${lastMaxId})...`);

    const filter = lastMaxId > 0
      ? `${baseFilter} and InvoiceID gt ${lastMaxId}`
      : baseFilter;

    const invoices = await fetchInvoicesBatch(filter, PAGE_SIZE);

    if (invoices.length > 0) {
      const ids = invoices.map(inv => inv.InvoiceID);
      const maxId = Math.max(...ids);
      const minId = Math.min(...ids);
      console.log(`Page ${page}: Got ${invoices.length} invoices (ID range: ${minId} to ${maxId})`);

      allInvoices.push(...invoices);
      lastMaxId = maxId;

      if (invoices.length < PAGE_SIZE) {
        hasMoreData = false;
        console.log('Last page reached');
      }
    } else {
      hasMoreData = false;
      console.log('No more invoices');
    }

    page++;

    if (page % 10 === 0) {
      console.log(`Progress: ${allInvoices.length} invoices so far...`);
    }
  }

  if (page > maxPages) {
    console.log(`WARNING: Stopped at safety limit of ${maxPages} pages`);
  }

  console.log(`Fetched ${allInvoices.length} total invoices`);
  return allInvoices;
}

async function fetchInvoicesBatch(filter: string, pageSize: number): Promise<AspireInvoice[]> {
  try {
    const timestamp = new Date().getTime();
    const url = `${VERCEL_PROXY_URL}?clientId=${encodeURIComponent(CLIENT_ID)}&secret=${encodeURIComponent(API_KEY)}&filter=${encodeURIComponent(filter)}&endpoint=/Invoices&$orderby=InvoiceID asc&$top=${pageSize}&$expand=InvoiceOpportunities&_t=${timestamp}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API failed: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const responseData = await response.json();
    const invoices = Array.isArray(responseData) ? responseData : (responseData.value || []);

    return invoices;

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching batch:', errorMessage);
    return [];
  }
}

async function enrichInvoicesWithContactEmails(invoices: AspireInvoice[]): Promise<AspireInvoice[]> {
  if (!invoices || invoices.length === 0) {
    return invoices;
  }

  console.log(`Enriching ${invoices.length} invoices with contact emails...`);

  // Collect all unique contact IDs
  const contactIds: number[] = [];
  for (const invoice of invoices) {
    if (invoice.BillingContactID) {
      contactIds.push(invoice.BillingContactID);
    }
    if (invoice.PrimaryContactID) {
      contactIds.push(invoice.PrimaryContactID);
    }
  }

  if (contactIds.length === 0) {
    console.log('No contact IDs found in invoices');
    return invoices;
  }

  // Fetch all contacts in batches
  const contactMap = await fetchContactsByIds(contactIds);
  console.log(`Retrieved ${Object.keys(contactMap).length} contacts`);

  // Enrich each invoice
  let enrichedCount = 0;
  for (const invoice of invoices) {
    // Add billing contact email
    if (invoice.BillingContactID && contactMap[invoice.BillingContactID]) {
      invoice.BillingContactEmail = contactMap[invoice.BillingContactID].Email || '';
      if (invoice.BillingContactEmail) enrichedCount++;
    }

    // Add primary contact email
    if (invoice.PrimaryContactID && contactMap[invoice.PrimaryContactID]) {
      invoice.PrimaryContactEmail = contactMap[invoice.PrimaryContactID].Email || '';
      if (invoice.PrimaryContactEmail) enrichedCount++;
    }
  }

  console.log(`Enriched ${enrichedCount} contact email fields`);
  return invoices;
}

async function fetchContactsByIds(contactIds: number[]): Promise<Record<number, Contact>> {
  if (!contactIds || contactIds.length === 0) {
    return {};
  }

  // Remove duplicates
  const uniqueIds = Array.from(new Set(contactIds.filter(id => id)));

  console.log(`Fetching ${uniqueIds.length} unique contacts...`);

  const contactMap: Record<number, Contact> = {};
  const batchSize = 20;

  // Process in batches
  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    const batch = uniqueIds.slice(i, Math.min(i + batchSize, uniqueIds.length));
    console.log(`Fetching contact batch ${Math.floor(i / batchSize) + 1} (${batch.length} contacts)...`);

    const batchResults = await fetchContactBatch(batch);

    // Merge results into contactMap
    Object.assign(contactMap, batchResults);

    // Small delay to avoid rate limits
    if (i + batchSize < uniqueIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`Fetched ${Object.keys(contactMap).length} contacts total`);
  return contactMap;
}

async function fetchContactBatch(contactIds: number[]): Promise<Record<number, Contact>> {
  if (!contactIds || contactIds.length === 0) {
    return {};
  }

  try {
    // Build filter: ContactID eq 123 or ContactID eq 456 or...
    const filterParts = contactIds.map(id => `ContactID eq ${id}`);
    const filter = filterParts.join(' or ');

    const timestamp = new Date().getTime();
    const url = `${VERCEL_PROXY_URL}?clientId=${encodeURIComponent(CLIENT_ID)}&secret=${encodeURIComponent(API_KEY)}&filter=${encodeURIComponent(filter)}&endpoint=/Contacts&$top=${contactIds.length}&_t=${timestamp}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.log(`Contact batch fetch failed: ${response.status}`);
      return {};
    }

    const data = await response.json();
    const contacts: Contact[] = Array.isArray(data) ? data : (data.value || []);

    // Build a map: ContactID -> Contact object
    const contactMap: Record<number, Contact> = {};
    for (const contact of contacts) {
      if (contact.ContactID) {
        contactMap[contact.ContactID] = contact;
      }
    }

    return contactMap;

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching contact batch:', errorMessage);
    return {};
  }
}

function processInvoiceData(invoices: AspireInvoice[]): ProcessedInvoiceData[] {
  const today = new Date();
  const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

  return invoices.map(invoice => {
    let opportunityName = '';
    let opportunityNumber = '';

    if (invoice.InvoiceOpportunities && invoice.InvoiceOpportunities.length > 0) {
      const oppNames: string[] = [];
      const oppNumbers: string[] = [];

      for (const opp of invoice.InvoiceOpportunities) {
        if (opp.OpportunityName) oppNames.push(opp.OpportunityName);
        if (opp.OpportunityNumber) oppNumbers.push(opp.OpportunityNumber);
      }

      opportunityName = oppNames.join('; ');
      opportunityNumber = oppNumbers.join('; ');
    }

    const aging = calculateAging(invoice.DueDate);

    // Calculate Past Due
    let pastDue = 0;
    if (invoice.DueDate) {
      try {
        const dueDate = new Date(invoice.DueDate);
        const dueDateUTC = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
        const daysDiff = Math.floor((todayUTC - dueDateUTC) / (1000 * 60 * 60 * 24));
        pastDue = daysDiff > 0 ? daysDiff : 0;
      } catch {
        pastDue = 0;
      }
    }

    return {
      invoice_id: invoice.InvoiceID, // Use Aspire InvoiceID as primary key
      invoice_number: invoice.InvoiceNumber || '',
      company_name: invoice.CompanyName || '',
      property_name: invoice.PropertyName || '',
      opportunity_name: opportunityName,
      opportunity_number: opportunityNumber,
      branch_name: invoice.BranchName || '',
      amount: invoice.Amount || 0,
      amount_remaining: invoice.AmountRemaining || 0,
      due_date: invoice.DueDate || null,
      invoice_date: invoice.InvoiceDate || null,
      past_due: pastDue,
      aging_category: aging.agingCategory,
      aging_1_30: aging.bucket === '1-30' ? (invoice.AmountRemaining || 0) : 0,
      aging_31_60: aging.bucket === '31-60' ? (invoice.AmountRemaining || 0) : 0,
      aging_61_90: aging.bucket === '61-90' ? (invoice.AmountRemaining || 0) : 0,
      aging_91_120: aging.bucket === '91-120' ? (invoice.AmountRemaining || 0) : 0,
      aging_121_plus: aging.bucket === '121+' ? (invoice.AmountRemaining || 0) : 0,
      primary_contact_name: invoice.PrimaryContactName || '',
      primary_contact_email: invoice.PrimaryContactEmail || '',
      billing_contact_name: invoice.BillingContactName || '',
      billing_contact_email: invoice.BillingContactEmail || '',
      payment_terms_name: invoice.PaymentTermsName || ''
      // NOTE: Local fields (payment_status, is_ghosting, comments) will be preserved by upsert
    };
  });
}

function calculateAging(dueDateString: string) {
  if (!dueDateString) {
    return { daysPastDue: 0, bucket: 'Current', agingCategory: 'Not Past Due' };
  }

  try {
    const dueDate = new Date(dueDateString);
    const today = new Date();

    const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const dueDateUTC = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());

    const daysPastDue = Math.floor((todayUTC - dueDateUTC) / (1000 * 60 * 60 * 24));

    let bucket = 'Current';
    let agingCategory = 'Not Past Due';

    if (daysPastDue > 120) {
      bucket = '121+';
      agingCategory = 'Aging 121+';
    } else if (daysPastDue > 90) {
      bucket = '91-120';
      agingCategory = 'Aging 91-120';
    } else if (daysPastDue > 60) {
      bucket = '61-90';
      agingCategory = 'Aging 61-90';
    } else if (daysPastDue > 30) {
      bucket = '31-60';
      agingCategory = 'Aging 31-60';
    } else if (daysPastDue > 0) {
      bucket = '1-30';
      agingCategory = 'Aging 1-30';
    }

    return {
      daysPastDue: daysPastDue > 0 ? daysPastDue : 0,
      bucket,
      agingCategory
    };
  } catch {
    console.error('Error calculating aging');
    return { daysPastDue: 0, bucket: 'Current', agingCategory: 'Not Past Due' };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function writeToSupabase(supabase: any, data: ProcessedInvoiceData[]) {
  console.log(`Syncing ${data.length} invoices to Supabase...`);

  // Get all current invoice_ids from Aspire data
  const aspireInvoiceIds = new Set(data.map((inv) => inv.invoice_id));

  // Check if we're in migration mode (existing records have NULL invoice_id)
  const { data: sampleCheck, error: checkError } = await supabase
    .from('ar_aging_invoices')
    .select('invoice_id')
    .limit(1)
    .single();

  const isMigration = !checkError && sampleCheck && sampleCheck.invoice_id === null;

  if (isMigration) {
    console.log('🔄 Migration mode detected - skipping delete logic for first sync');
  } else {
    // Normal mode: Find and delete paid-off invoices
    const { data: existingInvoices, error: fetchError } = await supabase
      .from('ar_aging_invoices')
      .select('invoice_id');

    if (fetchError) {
      console.error('Error fetching existing invoices:', fetchError);
      throw new Error('Failed to fetch existing invoices');
    }

    // Find invoices to delete (exist in Supabase but not in Aspire data)
    const invoicesToDelete = (existingInvoices || []).filter(
      (inv: { invoice_id: number }) => inv.invoice_id && !aspireInvoiceIds.has(inv.invoice_id)
    );

    if (invoicesToDelete.length > 0) {
      console.log(`Deleting ${invoicesToDelete.length} paid-off invoices`);
      const idsToDelete = invoicesToDelete.map((inv: { invoice_id: number }) => inv.invoice_id);
      const { error: deleteError } = await supabase
        .from('ar_aging_invoices')
        .delete()
        .in('invoice_id', idsToDelete);

      if (deleteError) {
        console.error('Error deleting paid invoices:', deleteError);
        throw new Error('Failed to delete paid invoices');
      }
      console.log(`✅ Deleted ${invoicesToDelete.length} paid-off invoices`);
    }
  }

  // UPSERT everything in batches
  const batchSize = 500;
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, Math.min(i + batchSize, data.length));
    console.log(`Upserting batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records`);

    const { error: upsertError } = await supabase
      .from('ar_aging_invoices')
      .upsert(batch, { 
        onConflict: 'invoice_id',
        ignoreDuplicates: false 
      });

    if (upsertError) {
      console.error(`Error upserting batch:`, upsertError);
      throw new Error(`Failed to upsert invoices: ${upsertError.message}`);
    }
  }

  console.log(`✅ Sync complete! Processed ${data.length} invoices`);
  console.log('✅ Local data (payment_status, is_ghosting, comments, notes, follow-ups) preserved!');
}