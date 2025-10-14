import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface ImportNoteRow {
  invoice_number: string;
  note_text: string;
  created_by?: string;
  created_at?: string;
  is_follow_up?: boolean;
  follow_up_date?: string;
}

export async function POST(request: Request) {
  try {
    console.log('=== IMPORT NOTES API CALLED ===');
    
    // Check environment variables
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials');
      return NextResponse.json({ 
        error: 'Server configuration error: Missing Supabase credentials' 
      }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('No valid authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify auth
    const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (!user || userError) {
      console.error('Authentication failed:', userError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ Authenticated user:', user.email);

    // Get the CSV data from request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json({ 
        error: 'Invalid request body: Expected JSON' 
      }, { status: 400 });
    }

    const { notes } = body;
    
    if (!notes || !Array.isArray(notes)) {
      console.error('Invalid notes data:', typeof notes);
      return NextResponse.json({ 
        error: 'Invalid notes data: Expected array of notes' 
      }, { status: 400 });
    }

    console.log(`Processing ${notes.length} notes for import...`);

    // Use service role for write operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // First, fetch all invoices to create a lookup map
    // FIXED: Changed from 'id' to 'invoice_id' to match new schema
    console.log('Fetching invoices from database...');
    const { data: invoices, error: invoicesError } = await supabaseAdmin
      .from('ar_aging_invoices')
      .select('invoice_id, invoice_number');

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
      return NextResponse.json({ 
        error: `Failed to fetch invoices: ${invoicesError.message}` 
      }, { status: 500 });
    }

    if (!invoices || invoices.length === 0) {
      console.error('No invoices found in database');
      return NextResponse.json({ 
        error: 'No invoices found in database. Please sync from Aspire first.' 
      }, { status: 400 });
    }

    // Create invoice number to invoice_id map
    // FIXED: Changed from inv.id to inv.invoice_id
    const invoiceMap = new Map<string, number>();
    invoices.forEach(inv => {
      invoiceMap.set(inv.invoice_number.toString(), inv.invoice_id);
    });

    console.log(`Found ${invoiceMap.size} invoices in database`);

    // Process notes and prepare for insertion
    const notesToInsert: any[] = [];
    const errors: string[] = [];
    let skipped = 0;

    for (const note of notes as ImportNoteRow[]) {
      // Skip empty notes
      if (!note.note_text || note.note_text.trim() === '') {
        skipped++;
        continue;
      }

      // Find the invoice_id by invoice_number
      const invoiceId = invoiceMap.get(note.invoice_number.toString());
      
      if (!invoiceId) {
        errors.push(`Invoice #${note.invoice_number} not found in database`);
        continue;
      }

      // Prepare note for insertion
      const noteToInsert = {
        invoice_id: invoiceId,
        note_text: note.note_text.trim(),
        created_by: note.created_by || user.email || 'Imported from Google Sheets',
        created_at: note.created_at || new Date().toISOString(),
        is_follow_up: note.is_follow_up || false,
        follow_up_date: note.follow_up_date || null
      };

      notesToInsert.push(noteToInsert);
    }

    console.log(`Prepared ${notesToInsert.length} notes for insertion`);
    console.log(`Skipped ${skipped} empty notes`);
    console.log(`${errors.length} errors found`);

    if (notesToInsert.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No valid notes to import',
        inserted: 0,
        skipped,
        errors: errors.length > 0 ? errors : undefined
      }, { status: 400 });
    }

    // Insert notes in batches
    let inserted = 0;
    const batchSize = 100;

    for (let i = 0; i < notesToInsert.length; i += batchSize) {
      const batch = notesToInsert.slice(i, i + batchSize);
      
      console.log(`Inserting batch ${Math.floor(i / batchSize) + 1}...`);
      const { error: insertError } = await supabaseAdmin
        .from('invoice_notes')
        .insert(batch);

      if (insertError) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError);
        errors.push(`Batch ${i / batchSize + 1} failed: ${insertError.message}`);
      } else {
        inserted += batch.length;
        console.log(`✅ Inserted batch ${i / batchSize + 1}: ${batch.length} notes`);
      }
    }

    // Also create follow-ups for notes that have follow_up_date
    const followUpsToCreate = notesToInsert.filter(note => note.is_follow_up && note.follow_up_date);
    
    if (followUpsToCreate.length > 0) {
      console.log(`Creating ${followUpsToCreate.length} follow-ups...`);
      
      try {
        // First, get the note IDs that were just created
        const { data: createdNotes, error: fetchNotesError } = await supabaseAdmin
          .from('invoice_notes')
          .select('id, invoice_id, note_text, follow_up_date')
          .eq('is_follow_up', true)
          .not('follow_up_date', 'is', null)
          .order('created_at', { ascending: false })
          .limit(followUpsToCreate.length);

        if (fetchNotesError) {
          console.error('Error fetching created notes:', fetchNotesError);
          errors.push(`Failed to fetch created notes: ${fetchNotesError.message}`);
        } else if (createdNotes && createdNotes.length > 0) {
          // Get invoice details for follow-ups
          const invoiceIds = [...new Set(createdNotes.map(n => n.invoice_id))];
          const { data: invoiceDetails, error: invoiceDetailsError } = await supabaseAdmin
            .from('ar_aging_invoices')
            .select('invoice_id, invoice_number, company_name, property_name, amount_remaining')
            .in('invoice_id', invoiceIds);

          if (invoiceDetailsError) {
            console.error('Error fetching invoice details:', invoiceDetailsError);
            errors.push(`Failed to fetch invoice details: ${invoiceDetailsError.message}`);
          } else if (invoiceDetails) {
            // FIXED: Changed from inv.id to inv.invoice_id
            const invoiceDetailsMap = new Map(invoiceDetails.map(inv => [inv.invoice_id, inv]));
            
            const followUpsData = createdNotes.map(note => {
              const invoice = invoiceDetailsMap.get(note.invoice_id);
              if (!invoice) return null;

              return {
                invoice_id: note.invoice_id,
                note_id: note.id,
                invoice_number: invoice.invoice_number,
                company_name: invoice.company_name,
                property_name: invoice.property_name,
                amount: invoice.amount_remaining,
                note_text: note.note_text,
                follow_up_date: note.follow_up_date,
                created_by: user.email || 'Imported from Google Sheets',
                completed: false
              };
            }).filter(Boolean);

            if (followUpsData.length > 0) {
              const { error: followUpError } = await supabaseAdmin
                .from('follow_ups')
                .insert(followUpsData);

              if (followUpError) {
                console.error('Error creating follow-ups:', followUpError);
                errors.push(`Failed to create follow-ups: ${followUpError.message}`);
              } else {
                console.log(`✅ Created ${followUpsData.length} follow-ups`);
              }
            }
          }
        }
      } catch (followUpError: any) {
        console.error('Error in follow-up creation:', followUpError);
        errors.push(`Follow-up creation error: ${followUpError.message}`);
      }
    }

    const response = {
      success: true,
      message: `Successfully imported ${inserted} notes`,
      inserted,
      skipped,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('=== IMPORT COMPLETE ===');
    console.log(response);

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('=== IMPORT ERROR ===');
    console.error('Error importing notes:', error);
    console.error('Stack:', error.stack);
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to import notes',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}