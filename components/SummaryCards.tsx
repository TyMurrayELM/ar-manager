import { Bucket } from '@/types';
import { formatCompactCurrency } from '@/lib/utils';

interface SummaryCardsProps {
  buckets: Bucket[];
  selectedBucket: string;
  onBucketSelect: (bucketId: string) => void;
}

export default function SummaryCards({ buckets, selectedBucket, onBucketSelect }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-6 gap-4 mb-6">
      {buckets.map((bucket) => (
        <div
          key={bucket.id}
          onClick={() => onBucketSelect(bucket.id)}
          className={`bg-white rounded-lg border-2 p-4 cursor-pointer transition-all ${
            selectedBucket === bucket.id
              ? 'border-blue-500 shadow-md'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-sm text-gray-600 mb-1">{bucket.label}</div>
          <div className={`text-2xl font-bold mb-1 ${
            selectedBucket === bucket.id ? 'text-blue-600' : 'text-gray-900'
          }`}>
            {bucket.count}
          </div>
          <div className="text-sm text-gray-500">{formatCompactCurrency(bucket.value)}</div>
        </div>
      ))}
    </div>
  );
}