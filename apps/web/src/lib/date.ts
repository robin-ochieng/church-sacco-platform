const BANK_TIMEZONE = process.env.NEXT_PUBLIC_BANK_TIMEZONE ?? 'Africa/Nairobi';

export function getBankTodayIso(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BANK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(new Date());
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = lookup.year ?? '0000';
  const month = lookup.month ?? '01';
  const day = lookup.day ?? '01';

  return `${year}-${month}-${day}`;
}

export function formatBankDate(dateIso: string, options?: Intl.DateTimeFormatOptions): string {
  if (!dateIso) {
    return 'Select a date';
  }

  const [year, month = '01', day = '01'] = dateIso.split('-');
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  if (Number.isNaN(date.getTime())) {
    return 'Select a valid date';
  }

  return new Intl.DateTimeFormat('en-KE', {
    timeZone: BANK_TIMEZONE,
    dateStyle: 'full',
    ...(options ?? {}),
  }).format(date);
}

export function formatTimestampForTable(timestamp: string | null | undefined): string {
  if (!timestamp) {
    return 'Not available';
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat('en-KE', {
    timeZone: BANK_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export { BANK_TIMEZONE };
