import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const INVOICE_FOLDER_ID = '1yeLH5tVF8cRGMU_SZmusJs2pVtRnY4yA';

export async function POST(request: Request) {
  try {
    console.log('=== FIND INVOICE API CALLED ===');
    
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify auth
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (!user || userError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ Authenticated user:', user.email);

    // Get invoice number and provider token from request body
    const body = await request.json();
    const { invoiceNumber, providerToken } = body;
    
    if (!invoiceNumber) {
      return NextResponse.json({ error: 'Invoice number required' }, { status: 400 });
    }

    console.log('Searching for invoice:', invoiceNumber);

    // Check if provider token was provided
    if (!providerToken) {
      console.error('No provider_token provided in request');
      return NextResponse.json({ 
        error: 'No Google access token. Please sign out and sign in again to grant Drive permissions.',
        debug: {
          hasProviderToken: false
        }
      }, { status: 401 });
    }

    console.log('✅ Provider token received from client');

    // Set up Google Drive API with the provider token from the client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: providerToken
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Search for the invoice file
    // Pattern: "Invoice #33333 - Property Name.pdf"
    const searchQuery = `name contains 'Invoice #${invoiceNumber}' and '${INVOICE_FOLDER_ID}' in parents and trashed=false`;
    
    console.log('Drive search query:', searchQuery);

    const response = await drive.files.list({
      q: searchQuery,
      fields: 'files(id, name, webViewLink, webContentLink)',
      pageSize: 10
    });

    const files = response.data.files || [];
    
    console.log(`Found ${files.length} matching files`);

    if (files.length === 0) {
      return NextResponse.json({ 
        found: false,
        message: 'Invoice not found in Google Drive'
      });
    }

    // Return the first matching file
    const file = files[0];
    
    console.log('✅ Found invoice:', file.name);

    return NextResponse.json({
      found: true,
      fileName: file.name,
      fileId: file.id,
      viewLink: file.webViewLink,
      downloadLink: file.webContentLink
    });

  } catch (error: any) {
    console.error('Error finding invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to find invoice' },
      { status: 500 }
    );
  }
}