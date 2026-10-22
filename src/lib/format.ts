/** Accepts "12.5" and "12,5" (some iPhone regions show a comma on the decimal keypad). */
export function parseDecimal(text: string): number | null {
  const cleaned = text.trim().replace(/\s/g, '').replace(',', '.');
  if (cleaned === '' || !/^\d*\.?\d*$/.test(cleaned) || cleaned === '.') return null;
  return Number(cleaned);
}

export function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatMoney(value: number, symbol: string, decimals = 2): string {
  return `${symbol}${formatNumber(value, decimals)}`;
}
