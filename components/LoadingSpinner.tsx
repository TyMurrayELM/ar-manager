import { RefreshCw } from 'lucide-react';

export default function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
        <p className="text-gray-600">Loading invoice data...</p>
      </div>
    </div>
  );
}