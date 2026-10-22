import type { Workbook, Worksheet } from 'exceljs';
import type { Accessory, Bike, Expense, FuelEntry, InsurancePolicy, ServiceItem, ServiceItemType, ServiceRecord, Settings, Station, Trip } from '../../db/types';
import { ACCESSORY_CATEGORY_LABELS, EXPENSE_CATEGORY_LABELS, FUEL_KIND_LABELS, INSURANCE_COVER_LABELS, PREMIUM_FREQUENCY_LABELS, RIDING_CONDITIONS, SERVICE_CATEGORY_LABELS, VEHICLE_KIND_LABELS } from '../../db/types';
import { insurancePayments, policyCost } from '../calc/insurance';
import { ownership } from '../calc/ownership';
import { brandName, fuelTypeName } from '../fuelCatalog';
import { unitsFor } from '../units';
import { computeMileage, sortFills } from '../calc/mileage';
import type { OdometerReading } from '../calc/odometer';
import { buildReport, periodRange } from '../calc/periods';
import { tripDistance } from '../calc/trips';

export type ExportScope = { kind: 'month' | 'year'; anchor: string } | { kind: 'all' };

export interface ExportData {
  bike: Bike;
  settings: Settings;
  fuel: FuelEntry[];
  stations: Station[];
  trips: Trip[];
  services: ServiceRecord[];
  serviceItems: ServiceItem[];
  itemTypes: ServiceItemType[];
  accessories: Accessory[];
  expenses: Expense[];
  readings: OdometerReading[];
  policies: InsurancePolicy[];
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Date range and file-name tag for a scope. "All" runs from the first record to today. */
export function exportRange(scope: ExportScope, data: ExportData, today: string): { start: string; end: string; tag: string; label: string } {
  if (scope.kind === 'month') {
    const { start, end } = periodRange('month', scope.anchor);
    return { start, end, tag: start.slice(0, 7), label: start.slice(0, 7) };
  }
  if (scope.kind === 'year') {
    const { start, end } = periodRange('year', scope.anchor);
    return { start, end, tag: start.slice(0, 4), label: start.slice(0, 4) };
  }
  const dates = [...data.fuel, ...data.trips, ...data.services, ...data.accessories, ...data.expenses].map((r) => r.date).sort();
  const start = dates[0] ?? today;
  const end = dates.length && dates[dates.length - 1] > today ? dates[dates.length - 1] : today;
  return { start, end, tag: 'All', label: 'All data' };
}

/** e.g. BikeLogbook_Himalayan450_2026-10.xlsx. Keeps letters and digits only in the bike name. */
export function exportFileName(bikeName: string, tag: string): string {
  const safe = bikeName.replace(/[^A-Za-z0-9]+/g, '') || 'Bike';
  return `BikeLogbook_${safe}_${tag}.xlsx`;
}

// Excel stores dates as day numbers. UTC midnight converts to exactly that calendar day.
const excelDate = (iso: string | undefined) => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

type ColType = 'date' | 'money' | 'number' | 'int' | 'text';
interface Col {
  header: string;
  key: string;
  width: number;
  type: ColType;
  total?: boolean;
}

function formats(currencySymbol: string): Record<ColType, string | undefined> {
  const sym = currencySymbol.replace(/"/g, '');
  return { date: 'dd mmm yyyy', money: `"${sym}"#,##0.00`, number: '#,##0.00', int: '#,##0', text: undefined };
}

const HEADER_FILL = 'FFC2410C';

function addTable(wb: Workbook, name: string, cols: Col[], rows: Record<string, unknown>[], currencySymbol: string): Worksheet {
  const fmt = formats(currencySymbol);
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width, style: fmt[c.type] ? { numFmt: fmt[c.type] } : {} }));

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  header.alignment = { vertical: 'middle' };
  header.height = 20;

  for (const row of rows) ws.addRow(row);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };

  if (rows.length && cols.some((c) => c.total)) {
    const last = rows.length + 1;
    const totals: Record<string, unknown> = { [cols[0].key]: 'Total' };
    cols.forEach((c, i) => {
      if (!c.total) return;
      const letter = ws.getColumn(i + 1).letter;
      const result = rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
      totals[c.key] = { formula: `SUM(${letter}2:${letter}${last})`, result };
    });
    const t = ws.addRow(totals);
    t.font = { bold: true };
    t.border = { top: { style: 'thin' } };
  }
  return ws;
}

export async function buildWorkbook(data: ExportData, scope: ExportScope, today: string): Promise<Workbook> {
  const { default: ExcelJS } = await import('exceljs');
  const { settings, bike } = data;
  const units = unitsFor(settings, bike);
  const cur = units.currency;
  const dist = units.distance;
  const fuelUnit = units.fuel;
  const { start, end, label } = exportRange(scope, data, today);
  const insurance = insurancePayments(data.policies, today);
  const records = { ...data, insurance };
  const inRange = (d: string) => d >= start && d <= end;
  const byDate = <T extends { date: string }>(a: T, b: T) => a.date.localeCompare(b.date);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Bike Logbook';
  wb.created = new Date();

  // Summary
  const report = buildReport(records, start, end);
  const owned = ownership(bike, records, data.readings, today);
  const fmt = formats(cur);
  const summary = wb.addWorksheet('Summary', { views: [{ state: 'frozen', ySplit: 1 }] });
  summary.columns = [
    { header: 'Item', key: 'item', width: 26 },
    { header: 'Value', key: 'value', width: 22 },
  ];
  const sh = summary.getRow(1);
  sh.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sh.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  const lines: [string, unknown, ColType][] = [
    ['Bike', [bike.make, bike.model].filter(Boolean).join(' ') || bike.name, 'text'],
    ['Vehicle name', bike.name, 'text'],
    ['Type', `${VEHICLE_KIND_LABELS[bike.kind ?? 'motorcycle']}, ${FUEL_KIND_LABELS[bike.fuelKind ?? 'petrol']}`, 'text'],
    ['Vehicle number', bike.registration || '—', 'text'],
    ['Period', label, 'text'],
    ['From', excelDate(start), 'date'],
    ['To', excelDate(end), 'date'],
    [`Distance ridden (${dist})`, report.km, 'int'],
    [`Fuel (${fuelUnit})`, report.litres, 'number'],
    ['Fill-ups', report.fillCount, 'int'],
    [`Average mileage (${units.mileage})`, report.kmPerLitre, 'number'],
    ['Trips', report.tripCount, 'int'],
    ['Fuel spend', report.spend.fuel, 'money'],
    ['Service spend', report.spend.service, 'money'],
    ['Accessory spend', report.spend.accessories, 'money'],
    ['Other spend', report.spend.other, 'money'],
    ['Insurance spend', report.spend.insurance, 'money'],
    ['Total cost', report.spend.total, 'money'],
    [`Total cost per ${dist}`, report.costPerKm, 'money'],
    [`Fuel cost per ${dist}`, report.fuelCostPerKm, 'money'],
    ['Purchase price', owned.purchasePrice, 'money'],
    ['Spent since purchase (all time)', owned.running.total, 'money'],
    ['Total cost of ownership', owned.purchasePrice != null ? owned.totalCost : null, 'money'],
    [`Total cost of ownership per ${dist}`, owned.totalPerKm, 'money'],
  ];
  for (const [item, value, type] of lines) {
    const row = summary.addRow({ item, value: value ?? '—' });
    if (value != null && fmt[type]) row.getCell(2).numFmt = fmt[type]!;
    if (item === 'Total cost') row.font = { bold: true };
  }

  // Fuel: mileage comes from all fills, so the first fill in a month still gets its figure.
  const stationName = new Map(data.stations.map((s) => [s.id, s.name]));
  const mileage = computeMileage(data.fuel);
  addTable(
    wb,
    'Fuel',
    [
      { header: 'Date', key: 'date', width: 13, type: 'date' },
      { header: `Odometer (${dist})`, key: 'odometer', width: 15, type: 'int' },
      { header: `Litres (${fuelUnit})`, key: 'litres', width: 12, type: 'number', total: true },
      { header: 'Price per litre', key: 'price', width: 14, type: 'money' },
      { header: 'Total', key: 'total', width: 13, type: 'money', total: true },
      { header: 'Full tank', key: 'full', width: 10, type: 'text' },
      { header: 'Station', key: 'station', width: 24, type: 'text' },
      { header: 'Company', key: 'brand', width: 18, type: 'text' },
      { header: 'Fuel', key: 'fuelType', width: 14, type: 'text' },
      { header: 'Riding', key: 'riding', width: 18, type: 'text' },
      { header: `Mileage (${units.mileage})`, key: 'kmpl', width: 15, type: 'number' },
      { header: `Cost per ${dist}`, key: 'cpk', width: 13, type: 'money' },
      { header: 'Notes', key: 'notes', width: 30, type: 'text' },
    ],
    sortFills(data.fuel)
      .filter((f) => inRange(f.date))
      .map((f) => ({
        date: excelDate(f.date),
        odometer: f.odometer,
        litres: f.litres,
        price: f.pricePerLitre,
        total: f.totalCost,
        full: f.isFullTank ? 'Yes' : 'No',
        station: f.stationId != null ? (stationName.get(f.stationId) ?? '') : '',
        brand: brandName(f.brand),
        fuelType: fuelTypeName(f.fuelType),
        riding: (f.conditions ?? []).map((c) => RIDING_CONDITIONS.find((x) => x.key === c)?.label ?? c).join(', '),
        kmpl: mileage.get(f.id)?.kmPerLitre ?? null,
        cpk: mileage.get(f.id)?.costPerKm ?? null,
        notes: f.notes,
      })),
    cur,
  );

  addTable(
    wb,
    'Trips',
    [
      { header: 'Date', key: 'date', width: 13, type: 'date' },
      { header: `Start (${dist})`, key: 'start', width: 12, type: 'int' },
      { header: `End (${dist})`, key: 'end', width: 12, type: 'int' },
      { header: `Distance (${dist})`, key: 'distance', width: 14, type: 'int', total: true },
      { header: 'Purpose or route', key: 'purpose', width: 30, type: 'text' },
      { header: 'Tags', key: 'tags', width: 20, type: 'text' },
      { header: 'Notes', key: 'notes', width: 30, type: 'text' },
    ],
    data.trips
      .filter((t) => inRange(t.date))
      .sort(byDate)
      .map((t) => ({ date: excelDate(t.date), start: t.startOdometer, end: t.endOdometer, distance: tripDistance(t), purpose: t.purpose, tags: t.tags.join(', '), notes: t.notes })),
    cur,
  );

  const typeById = new Map(data.itemTypes.map((t) => [t.id, t]));
  const services = data.services.filter((s) => inRange(s.date)).sort((a, b) => byDate(a, b) || a.odometer - b.odometer);
  const itemsFor = (id: number) => data.serviceItems.filter((i) => i.serviceRecordId === id);

  addTable(
    wb,
    'Service',
    [
      { header: 'Date', key: 'date', width: 13, type: 'date' },
      { header: `Odometer (${dist})`, key: 'odometer', width: 15, type: 'int' },
      { header: 'Service centre', key: 'centre', width: 24, type: 'text' },
      { header: 'Items', key: 'items', width: 45, type: 'text' },
      { header: 'Labour', key: 'labour', width: 12, type: 'money', total: true },
      { header: 'Total', key: 'total', width: 13, type: 'money', total: true },
      { header: 'Bill photos', key: 'photos', width: 11, type: 'int' },
      { header: 'Notes', key: 'notes', width: 30, type: 'text' },
    ],
    services.map((s) => ({
      date: excelDate(s.date),
      odometer: s.odometer,
      centre: s.serviceCenter,
      items: itemsFor(s.id)
        .map((i) => typeById.get(i.itemTypeId)?.name ?? 'Item')
        .join(', '),
      labour: s.laborCost,
      total: s.totalCost,
      photos: s.billPhotoIds.length,
      notes: s.notes,
    })),
    cur,
  );

  addTable(
    wb,
    'Service Items',
    [
      { header: 'Date', key: 'date', width: 13, type: 'date' },
      { header: `Odometer (${dist})`, key: 'odometer', width: 15, type: 'int' },
      { header: 'Service centre', key: 'centre', width: 24, type: 'text' },
      { header: 'Item', key: 'item', width: 24, type: 'text' },
      { header: 'Category', key: 'category', width: 16, type: 'text' },
      { header: 'Cost', key: 'cost', width: 12, type: 'money', total: true },
      { header: 'Brand or part', key: 'brand', width: 20, type: 'text' },
      { header: 'Note', key: 'note', width: 30, type: 'text' },
    ],
    services.flatMap((s) =>
      itemsFor(s.id).map((i) => {
        const t = typeById.get(i.itemTypeId);
        return {
          date: excelDate(s.date),
          odometer: s.odometer,
          centre: s.serviceCenter,
          item: t?.name ?? 'Item',
          category: t ? SERVICE_CATEGORY_LABELS[t.category] : '',
          cost: i.cost ?? null,
          brand: i.brandOrPart ?? '',
          note: i.note ?? '',
        };
      }),
    ),
    cur,
  );

  addTable(
    wb,
    'Accessories',
    [
      { header: 'Date', key: 'date', width: 13, type: 'date' },
      { header: 'Item', key: 'name', width: 26, type: 'text' },
      { header: 'Category', key: 'category', width: 14, type: 'text' },
      { header: 'Price', key: 'price', width: 12, type: 'money', total: true },
      { header: 'Shop', key: 'shop', width: 22, type: 'text' },
      { header: `Odometer (${dist})`, key: 'odometer', width: 15, type: 'int' },
      { header: 'Notes', key: 'notes', width: 30, type: 'text' },
    ],
    data.accessories
      .filter((a) => inRange(a.date))
      .sort(byDate)
      .map((a) => ({ date: excelDate(a.date), name: a.name, category: ACCESSORY_CATEGORY_LABELS[a.category], price: a.price, shop: a.shop, odometer: a.odometer ?? null, notes: a.notes })),
    cur,
  );

  addTable(
    wb,
    'Expenses',
    [
      { header: 'Date', key: 'date', width: 13, type: 'date' },
      { header: 'Category', key: 'category', width: 14, type: 'text' },
      { header: 'Amount', key: 'amount', width: 12, type: 'money', total: true },
      { header: `Odometer (${dist})`, key: 'odometer', width: 15, type: 'int' },
      { header: 'Notes', key: 'notes', width: 30, type: 'text' },
    ],
    data.expenses
      .filter((e) => inRange(e.date))
      .sort(byDate)
      .map((e) => ({ date: excelDate(e.date), category: EXPENSE_CATEGORY_LABELS[e.category], amount: e.amount, odometer: e.odometer ?? null, notes: e.notes })),
    cur,
  );

  addTable(
    wb,
    'Insurance',
    [
      { header: 'Insurer', key: 'insurer', width: 22, type: 'text' },
      { header: 'Policy number', key: 'number', width: 18, type: 'text' },
      { header: 'Cover', key: 'cover', width: 22, type: 'text' },
      { header: 'Starts', key: 'start', width: 13, type: 'date' },
      { header: 'Ends', key: 'end', width: 13, type: 'date' },
      { header: 'Premium', key: 'premium', width: 12, type: 'money' },
      { header: 'Paid', key: 'frequency', width: 20, type: 'text' },
      { header: 'Total premium', key: 'total', width: 14, type: 'money', total: true },
      { header: 'Per year', key: 'perYear', width: 12, type: 'money' },
      { header: 'IDV', key: 'idv', width: 12, type: 'money' },
      { header: 'NCB %', key: 'ncb', width: 8, type: 'int' },
      { header: 'Add-ons', key: 'addOns', width: 30, type: 'text' },
      { header: 'Notes', key: 'notes', width: 30, type: 'text' },
    ],
    // Every policy that overlaps the period.
    data.policies
      .filter((p) => p.startDate <= end && p.endDate >= start)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((p) => {
        const c = policyCost(p);
        return {
          insurer: p.insurer,
          number: p.policyNumber,
          cover: INSURANCE_COVER_LABELS[p.cover],
          start: excelDate(p.startDate),
          end: excelDate(p.endDate),
          premium: p.premium,
          frequency: PREMIUM_FREQUENCY_LABELS[p.frequency],
          total: c.total,
          perYear: c.perYear,
          idv: p.idv ?? null,
          ncb: p.ncbPercent ?? null,
          addOns: p.addOns.join(', '),
          notes: p.notes,
        };
      }),
    cur,
  );

  return wb;
}

/** Builds the workbook and wraps it as a File ready for the share sheet. */
export async function workbookFile(data: ExportData, scope: ExportScope, today: string): Promise<File> {
  const wb = await buildWorkbook(data, scope, today);
  const buffer = await wb.xlsx.writeBuffer();
  const { tag } = exportRange(scope, data, today);
  return new File([buffer], exportFileName(data.bike.name, tag), { type: XLSX_MIME });
}
