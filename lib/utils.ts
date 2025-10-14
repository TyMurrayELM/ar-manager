export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
  }).format(amount);
}

export function formatCompactCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`;
  }
  return formatCurrency(amount);
}

export function getStatusColor(pastDue: number): string {
  if (pastDue === 0) return 'bg-blue-100 text-blue-700';
  if (pastDue <= 30) return 'bg-yellow-100 text-yellow-700';
  if (pastDue <= 60) return 'bg-orange-100 text-orange-700';
  return 'bg-red-100 text-red-700';
}

export function getStatusText(pastDue: number): string {
  if (pastDue === 0) return 'Current';
  if (pastDue <= 30) return 'Overdue';
  if (pastDue <= 60) return 'Past Due';
  return 'Critical';
}

export function getBranchColor(branchName: string): string {
  if (!branchName) return 'bg-gray-100 text-gray-700';
  
  const branch = branchName.toLowerCase();
  
  if (branch.includes('north')) {
    return 'bg-green-100 text-green-700';
  } else if (branch.includes('southwest')) {
    return 'bg-blue-100 text-blue-700';
  } else if (branch.includes('southeast')) {
    return 'bg-red-100 text-red-700';
  } else if (branch.includes('corp')) {
    return 'bg-gray-100 text-gray-700';
  } else if (branch.includes('las vegas') || branch.includes('vegas')) {
    return 'bg-yellow-100 text-yellow-700';
  }
  
  return 'bg-gray-100 text-gray-700';
}

export function formatDate(dateString: string | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!dateString) return '-';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  };
  
  return new Date(dateString).toLocaleDateString('en-US', options || defaultOptions);
}