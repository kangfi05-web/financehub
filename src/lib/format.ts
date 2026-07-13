import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value || 0);
}

export function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/[^\d]/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
}

export function formatCurrencyInput(value: number): string {
  if (!value) return '';
  return new Intl.NumberFormat('id-ID').format(value);
}

export function formatDate(date: string | Date, pattern = 'dd MMM yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, pattern, { locale: localeId });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd MMM yyyy, HH:mm', { locale: localeId });
}

export function formatPercentage(value: number): string {
  return `${value >= 0 ? '' : ''}${value.toFixed(2)}%`;
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function getMonthLabel(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MMM yyyy', { locale: localeId });
}

export function getWeekLabel(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, "'Minggu' w, MMM", { locale: localeId });
}
