import { useState, useEffect } from 'react';

interface AddPropertyNoteModalProps {
  propertyName: string;
  existingNote: string;
  onClose: () => void;
  onSave: (propertyName: string, noteText: string) => void;
}

export default function AddPropertyNoteModal({ 
  propertyName, 
  existingNote,
  onClose, 
  onSave 
}: AddPropertyNoteModalProps) {
  const [noteText, setNoteText] = useState('');

  // Initialize with existing note if present
  useEffect(() => {
    setNoteText(existingNote);
  }, [existingNote]);

  const handleSave = () => {
    if (noteText.trim()) {
      onSave(propertyName, noteText);
      setNoteText('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {existingNote ? 'Edit' : 'Add'} Property AR Note
          </h3>
          <div className="text-sm text-gray-600 mb-4">
            Property: <span className="font-semibold">{propertyName}</span>
          </div>
          <div className="text-xs text-gray-500 mb-4 bg-yellow-50 border border-yellow-200 rounded p-3">
            💡 This note will be visible for all invoices associated with this property.
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Note</label>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={6}
              placeholder="Enter property-specific AR note here... (e.g., 'Contact Sarah before following up', 'Always send invoices to accounting@company.com', etc.)"
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!noteText.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {existingNote ? 'Update' : 'Save'} Note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}