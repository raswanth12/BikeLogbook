import type { ServiceCategory, ServiceItemType } from '../db/types';

export const CATEGORY_ORDER: ServiceCategory[] = ['engine', 'chain', 'brakes', 'tyres', 'electrical', 'general'];

/** Item types grouped by category in display order, each group sorted by sortOrder. */
export function groupByCategory(types: ServiceItemType[]): { category: ServiceCategory; items: ServiceItemType[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    items: types.filter((t) => t.category === category).sort((a, b) => a.sortOrder - b.sortOrder),
  })).filter((g) => g.items.length > 0);
}

export function intervalText(t: Pick<ServiceItemType, 'defaultIntervalKm' | 'defaultIntervalMonths'>, distanceUnit: string): string {
  const parts: string[] = [];
  if (t.defaultIntervalKm) parts.push(`${t.defaultIntervalKm.toLocaleString()} ${distanceUnit}`);
  if (t.defaultIntervalMonths) parts.push(`${t.defaultIntervalMonths} ${t.defaultIntervalMonths === 1 ? 'month' : 'months'}`);
  return parts.length ? `Every ${parts.join(' or ')}` : '';
}
