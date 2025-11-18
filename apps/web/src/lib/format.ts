const CURRENCY = 'KES';

export function formatKes(amount: number | string, options?: Intl.NumberFormatOptions): string {
  const numericValue = typeof amount === 'string' ? Number(amount) : amount;
  const safeAmount = Number.isFinite(numericValue) ? numericValue : 0;

  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: CURRENCY,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    ...(options ?? {}),
  }).format(safeAmount);
}
