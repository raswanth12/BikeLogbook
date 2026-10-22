import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { Settings } from '../src/db/types';
import { buildWorkbook, exportFileName, exportRange, type ExportData } from '../src/lib/export/xlsx';

const settings: Settings = {
  id: 1,
  currencyCode: 'INR',
  currencySymbol: '₹',
  distanceUnit: 'km',
  fuelUnit: 'L',
  mileageUnit: 'km/l',
  activeBikeId: 1,
  installGuideDismissed: false,
};

const data: ExportData = {
  bike: { id: 1, name: 'Himalayan 450', make: 'Royal Enfield', model: 'Himalayan 450', registration: 'KA01AB1234', purchaseOdometer: 0, notes: '' },
  settings,
  stations: [{ id: 1, name: 'HP, Ring Road' }],
  fuel: [
    { id: 1, bikeId: 1, date: '2026-09-28', odometer: 1000, litres: 10, pricePerLitre: 104, totalCost: 1040, isFullTank: true, stationId: 1, notes: '' },
    { id: 2, bikeId: 1, date: '2026-10-05', odometer: 1300, litres: 10, pricePerLitre: 105, totalCost: 1050, isFullTank: true, stationId: 1, notes: 'Highway' },
    { id: 3, bikeId: 1, date: '2026-10-20', odometer: 1600, litres: 12, pricePerLitre: 105, totalCost: 1260, isFullTank: true, notes: '' },
  ],
  trips: [{ id: 1, bikeId: 1, date: '2026-10-12', startOdometer: 1350, endOdometer: 1500, purpose: 'Nandi Hills', tags: ['Ride'], notes: '' }],
  services: [{ id: 1, bikeId: 1, date: '2026-10-10', odometer: 1320, serviceCenter: 'RE Service', laborCost: 600, totalCost: 2450, notes: '', billPhotoIds: [4] }],
  serviceItems: [
    { id: 1, serviceRecordId: 1, itemTypeId: 1, cost: 1850, brandOrPart: 'Motul' },
    { id: 2, serviceRecordId: 1, itemTypeId: 2 },
  ],
  itemTypes: [
    { id: 1, name: 'Engine oil', category: 'engine', isCustom: false, hidden: false, sortOrder: 0 },
    { id: 2, name: 'Chain clean and lube', category: 'chain', isCustom: false, hidden: false, sortOrder: 1 },
  ],
  accessories: [{ id: 1, bikeId: 1, date: '2026-03-01', name: 'Crash guard', category: 'protection', price: 4500, shop: 'Riders Hub', notes: '' }],
  expenses: [
    { id: 1, bikeId: 1, date: '2026-10-11', category: 'toll', amount: 150, notes: '' },
    { id: 2, bikeId: 1, date: '2026-10-30', category: 'parking', amount: 30, odometer: 1650, notes: '' },
  ],
  policies: [{ id: 1, bikeId: 1, insurer: 'ICICI Lombard', policyNumber: 'P1', cover: 'comprehensive', startDate: '2026-03-15', endDate: '2027-03-14', premium: 9200, frequency: 'once', addOns: ['Zero depreciation'], contact: '', notes: '' }],
  readings: [
    { source: 'fuel', id: 1, date: '2026-09-28', odometer: 1000 },
    { source: 'fuel', id: 2, date: '2026-10-05', odometer: 1300 },
    { source: 'service', id: 1, date: '2026-10-10', odometer: 1320 },
    { source: 'trip', id: 1, date: '2026-10-12', odometer: 1500 },
    { source: 'fuel', id: 3, date: '2026-10-20', odometer: 1600 },
    { source: 'expense', id: 2, date: '2026-10-30', odometer: 1650 },
  ],
};

async function roundTrip(scope: Parameters<typeof buildWorkbook>[1]) {
  const wb = await buildWorkbook(data, scope, '2026-10-31');
  const buffer = await wb.xlsx.writeBuffer();
  const back = new ExcelJS.Workbook();
  await back.xlsx.load(buffer as ArrayBuffer);
  return back;
}

describe('file name and range', () => {
  it('follows BikeLogbook_<Bike>_<YYYY-MM>.xlsx', () => {
    expect(exportFileName('Himalayan 450', '2026-10')).toBe('BikeLogbook_Himalayan450_2026-10.xlsx');
    expect(exportFileName('My "Bike"!', '2026')).toBe('BikeLogbook_MyBike_2026.xlsx');
    expect(exportFileName('', 'All')).toBe('BikeLogbook_Bike_All.xlsx');
  });

  it('works out month, year and all-data ranges', () => {
    expect(exportRange({ kind: 'month', anchor: '2026-10-22' }, data, '2026-10-31')).toMatchObject({ start: '2026-10-01', end: '2026-10-31', tag: '2026-10' });
    expect(exportRange({ kind: 'year', anchor: '2026-10-22' }, data, '2026-10-31')).toMatchObject({ start: '2026-01-01', end: '2026-12-31', tag: '2026' });
    expect(exportRange({ kind: 'all' }, data, '2026-10-31')).toMatchObject({ start: '2026-03-01', end: '2026-10-31', tag: 'All' });
  });
});

describe('workbook', () => {
  it('has the expected sheets, each with a frozen, styled header', async () => {
    const wb = await roundTrip({ kind: 'month', anchor: '2026-10-22' });
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Summary', 'Fuel', 'Trips', 'Service', 'Service Items', 'Accessories', 'Expenses', 'Insurance']);
    for (const ws of wb.worksheets) {
      expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
      expect(ws.getRow(1).font?.bold).toBe(true);
    }
  });

  it('writes real dates, currency formats and only rows inside the period', async () => {
    const fuel = (await roundTrip({ kind: 'month', anchor: '2026-10-22' })).getWorksheet('Fuel')!;
    // Two October fills plus a totals row.
    expect(fuel.rowCount).toBe(4);
    const date = fuel.getRow(2).getCell(1).value as Date;
    expect(date).toBeInstanceOf(Date);
    expect(date.toISOString().slice(0, 10)).toBe('2026-10-05');
    expect(fuel.getRow(2).getCell(5).numFmt).toContain('₹');
    expect(fuel.getRow(2).getCell(7).value).toBe('HP, Ring Road');
    // Mileage for the first October fill uses the September fill before it.
    expect(fuel.getRow(2).getCell(11).value).toBe(30);
    expect(fuel.getColumn(7).width).toBe(24);
  });

  it('adds totals rows with a SUM formula and its value', async () => {
    const fuel = (await roundTrip({ kind: 'month', anchor: '2026-10-22' })).getWorksheet('Fuel')!;
    const totals = fuel.getRow(4);
    expect(totals.getCell(1).value).toBe('Total');
    expect(totals.getCell(5).value).toMatchObject({ formula: 'SUM(E2:E3)', result: 2310 });
    expect(totals.getCell(3).value).toMatchObject({ result: 22 });
  });

  it('lists one row per service and one per ticked item', async () => {
    const wb = await roundTrip({ kind: 'month', anchor: '2026-10-22' });
    const service = wb.getWorksheet('Service')!;
    expect(service.getRow(2).getCell(4).value).toBe('Engine oil, Chain clean and lube');
    expect(service.getRow(2).getCell(7).value).toBe(1);
    const items = wb.getWorksheet('Service Items')!;
    expect(items.rowCount).toBe(4); // header, 2 items, totals
    expect(items.getRow(2).getCell(5).value).toBe('Engine');
    expect(items.getRow(2).getCell(7).value).toBe('Motul');
  });

  it('summarises the period', async () => {
    const summary = (await roundTrip({ kind: 'month', anchor: '2026-10-22' })).getWorksheet('Summary')!;
    const rows = new Map<string, unknown>();
    summary.eachRow((row, n) => n > 1 && rows.set(String(row.getCell(1).value), row.getCell(2).value));
    expect(rows.get('Bike')).toBe('Royal Enfield Himalayan 450');
    expect(rows.get('Distance ridden (km)')).toBe(650);
    expect(rows.get('Total cost')).toBe(1050 + 1260 + 2450 + 150 + 30); // the March premium is outside October
    expect(rows.get('Type')).toBe('Motorcycle, Petrol');
  });

  it('lists insurance policies and counts premiums in the year', async () => {
    const wb = await roundTrip({ kind: 'year', anchor: '2026-10-22' });
    const ins = wb.getWorksheet('Insurance')!;
    expect(ins.getRow(2).getCell(1).value).toBe('ICICI Lombard');
    expect(ins.getRow(2).getCell(8).value).toBe(9200);
    const rows = new Map<string, unknown>();
    wb.getWorksheet('Summary')!.eachRow((row, n) => n > 1 && rows.set(String(row.getCell(1).value), row.getCell(2).value));
    expect(rows.get('Insurance spend')).toBe(9200);
  });

  it('includes everything for all data, and leaves empty sheets with just a header', async () => {
    const all = await roundTrip({ kind: 'all' });
    expect(all.getWorksheet('Accessories')!.rowCount).toBe(3);
    expect(all.getWorksheet('Fuel')!.rowCount).toBe(5);
    const empty = await roundTrip({ kind: 'month', anchor: '2026-01-15' });
    expect(empty.getWorksheet('Fuel')!.rowCount).toBe(1);
  });
});
