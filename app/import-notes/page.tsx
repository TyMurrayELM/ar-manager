'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ParsedNote {
  invoice_number: string;
  note_text: string;
}

interface ImportResult {
  success: boolean;
  message: string;
  inserted: number;
  skipped: number;
  errors?: string[];
}

export default function ImportNotesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [csvText, setCsvText] = useState('');
  const [parsedNotes, setParsedNotes] = useState<ParsedNote[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    try {
      const lines = text.trim().split('\n');
      if (lines.length === 0) {
        setError('CSV file is empty');
        return;
      }

      // Parse header
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      
      // Find required column indices
      const invoiceNumIndex = headers.findIndex(h => 
        h.includes('invoice') && (h.includes('number') || h.includes('num') || h === 'invoice' || h === 'invoice_number')
      );
      const noteIndex = headers.findIndex(h => 
        h.includes('note') || h.includes('comment') || h === 'note' || h === 'notes'
      );

      if (invoiceNumIndex === -1) {
        setError('CSV must have an "Invoice Number" or "Invoice" column');
        setParsedNotes([]);
        return;
      }

      if (noteIndex === -1) {
        setError('CSV must have a "Note" or "Comment" column');
        setParsedNotes([]);
        return;
      }

      // Parse data rows
      const notes: ParsedNote[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Handle CSV parsing with commas inside quoted strings
        const regex = /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;
        const values = line.split(regex).map(v => v.trim().replace(/^"|"$/g, ''));

        const invoiceNumber = values[invoiceNumIndex]?.trim() || '';
        const noteText = values[noteIndex]?.trim() || '';

        if (!invoiceNumber || !noteText) continue;

        notes.push({
          invoice_number: invoiceNumber,
          note_text: noteText
        });
      }

      if (notes.length === 0) {
        setError('No valid notes found in CSV. Make sure you have Invoice Number and Note columns with data.');
        setParsedNotes([]);
        return;
      }

      setParsedNotes(notes);
      setError('');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Error parsing CSV: ${errorMessage}`);
      setParsedNotes([]);
    }
  };

  const handleImport = async () => {
    if (parsedNotes.length === 0) {
      setError('No notes to import');
      return;
    }

    try {
      setImporting(true);
      setError('');
      setResult(null);

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/import-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ notes: parsedNotes })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setResult(data);
      setCsvText('');
      setParsedNotes([]);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Import Historical Notes</h1>
          <p className="text-gray-600 mt-2">One-time import of notes from Google Sheets</p>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-blue-900 mb-2">CSV Format Instructions</h2>
          <p className="text-sm text-blue-800 mb-2">Your CSV file needs just 2 columns:</p>
          <ul className="text-sm text-blue-800 space-y-1 ml-4">
            <li><strong>Invoice Number</strong> (or Invoice, Invoice_Number, etc.)</li>
            <li><strong>Note</strong> (or Notes, Comment, Comments, etc.)</li>
          </ul>
          <p className="text-sm text-blue-800 mt-3">Example CSV:</p>
          <div className="text-xs bg-blue-100 px-3 py-2 rounded mt-1 font-mono">
            Invoice Number,Note<br/>
            12345,Called customer about payment<br/>
            12346,Waiting on approval from accounting<br/>
            12347,Payment received via check
          </div>
          <p className="text-xs text-blue-700 mt-2">💡 Notes will be attributed to you ({user.email}) with today&apos;s date</p>
        </div>

        {/* Upload Area */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload or Paste CSV Data</h2>
          
          {/* File Upload */}
          <div className="mb-4">
            <label className="flex items-center justify-center w-full px-4 py-6 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:border-gray-400 transition-colors">
              <div className="flex flex-col items-center">
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">Click to upload CSV file</span>
                <span className="text-xs text-gray-500 mt-1">or drag and drop</span>
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="text-center text-sm text-gray-500 mb-4">OR</div>

          {/* Text Area */}
          <textarea
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              if (e.target.value.trim()) {
                parseCSV(e.target.value);
              } else {
                setParsedNotes([]);
              }
            }}
            placeholder="Paste CSV data here...&#10;&#10;Invoice Number,Note&#10;12345,Called customer&#10;12346,Payment pending"
            className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Preview */}
        {parsedNotes.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Preview - {parsedNotes.length} note{parsedNotes.length !== 1 ? 's' : ''} ready to import
            </h2>
            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 border-b">Invoice #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 border-b">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {parsedNotes.map((note, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900 font-medium">{note.invoice_number}</td>
                      <td className="px-4 py-3 text-gray-700">{note.note_text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Success Message */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-900">Success!</h3>
              <p className="text-sm text-green-800">{result.message}</p>
              {result.skipped > 0 && (
                <p className="text-sm text-green-700 mt-1">Skipped {result.skipped} empty notes</p>
              )}
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-orange-700 font-medium">Some issues occurred:</p>
                  <ul className="text-xs text-orange-600 mt-1 ml-4 list-disc max-h-32 overflow-y-auto">
                    {result.errors.map((err: string, idx: number) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Import Button */}
        <div className="flex justify-end gap-3">
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={parsedNotes.length === 0 || importing}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {importing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Import {parsedNotes.length} Note{parsedNotes.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}