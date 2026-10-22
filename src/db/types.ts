/** Local calendar date, 'YYYY-MM-DD'. */
export type ISODate = string;

export type VehicleKind = 'motorcycle' | 'scooter' | 'car' | 'other';
export type FuelKind = 'petrol' | 'diesel' | 'cng';

export const VEHICLE_KIND_LABELS: Record<VehicleKind, string> = {
  motorcycle: 'Motorcycle',
  scooter: 'Scooter',
  car: 'Car',
  other: 'Other',
};

export const FUEL_KIND_LABELS: Record<FuelKind, string> = {
  petrol: 'Petrol',
  diesel: 'Diesel',
  cng: 'CNG',
};

/** A vehicle. Called Bike in code because the app started with one; it covers cars too. */
export interface Bike {
  id: number;
  name: string;
  /** Missing on vehicles saved before cars were supported; treat as motorcycle. */
  kind?: VehicleKind;
  fuelKind?: FuelKind;
  /** What you paid for the vehicle, on-road. */
  purchasePrice?: number;
  make: string;
  model: string;
  year?: number;
  registration: string;
  purchaseDate?: ISODate;
  purchaseOdometer: number;
  tankCapacity?: number;
  notes: string;
}

export interface FuelEntry {
  id: number;
  bikeId: number;
  date: ISODate;
  odometer: number;
  litres: number;
  pricePerLitre: number;
  totalCost: number;
  isFullTank: boolean;
  stationId?: number;
  /** Fuel company, a key from FUEL_BRANDS (e.g. 'iocl'). */
  brand?: string;
  /** Product, a key from FUEL_TYPES (e.g. 'xp95'). */
  fuelType?: string;
  /** How you rode on the fuel this fill replaces, e.g. ['city', 'highway']. */
  conditions?: string[];
  notes: string;
}

export interface Station {
  id: number;
  name: string;
  area?: string;
  brand?: string;
}

export interface Trip {
  id: number;
  bikeId: number;
  date: ISODate;
  startOdometer: number;
  endOdometer: number;
  purpose: string;
  tags: string[];
  notes: string;
}

export type ServiceCategory = 'engine' | 'chain' | 'brakes' | 'tyres' | 'electrical' | 'general';

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  engine: 'Engine',
  chain: 'Drivetrain',
  brakes: 'Brakes',
  tyres: 'Tyres',
  electrical: 'Electrical',
  general: 'General',
};

export interface ServiceItemType {
  id: number;
  name: string;
  category: ServiceCategory;
  defaultIntervalKm?: number;
  defaultIntervalMonths?: number;
  isCustom: boolean;
  hidden: boolean;
  sortOrder: number;
  /** Vehicle types this item applies to. Missing means all. */
  kinds?: VehicleKind[];
}

export interface ServiceRecord {
  id: number;
  bikeId: number;
  date: ISODate;
  odometer: number;
  serviceCenter: string;
  laborCost: number;
  totalCost: number;
  notes: string;
  billPhotoIds: number[];
}

export interface ServiceItem {
  id: number;
  serviceRecordId: number;
  itemTypeId: number;
  cost?: number;
  brandOrPart?: string;
  note?: string;
}

export type ReminderType = 'serviceItem' | 'insurance' | 'puc' | 'registration' | 'license' | 'custom';

export interface ReminderRule {
  id: number;
  bikeId: number;
  title: string;
  type: ReminderType;
  dueOdometer?: number;
  dueDate?: ISODate;
  repeatKm?: number;
  repeatMonths?: number;
  linkedItemTypeId?: number;
  /** Set on reminders made for an insurance policy. */
  linkedPolicyId?: number;
  /** 'renewal' is due when the policy ends; 'premium' on its next payment date. */
  policyEvent?: 'renewal' | 'premium';
  /** Show as due soon (and alert in Calendar) this many days ahead. */
  alertDays?: number;
  active: boolean;
}

export type InsuranceCover = 'comprehensive' | 'thirdParty' | 'ownDamage' | 'bundled';
export type PremiumFrequency = 'once' | 'yearly' | 'monthly';

export const INSURANCE_COVER_LABELS: Record<InsuranceCover, string> = {
  comprehensive: 'Comprehensive',
  thirdParty: 'Third-party only',
  ownDamage: 'Own damage only',
  bundled: 'Bundled (1 yr OD + multi-year TP)',
};

export const PREMIUM_FREQUENCY_LABELS: Record<PremiumFrequency, string> = {
  once: 'Paid once for the term',
  yearly: 'Every year',
  monthly: 'Every month',
};

export const INSURANCE_ADD_ONS = [
  'Zero depreciation',
  'Roadside assistance',
  'Engine protection',
  'Return to invoice',
  'Consumables',
  'NCB protection',
  'Personal accident cover',
  'Key replacement',
  'Tyre protection',
];

export interface InsurancePolicy {
  id: number;
  bikeId: number;
  insurer: string;
  policyNumber: string;
  cover: InsuranceCover;
  startDate: ISODate;
  endDate: ISODate;
  /** The amount of each payment: the whole premium if paid once, else per year or per month. */
  premium: number;
  frequency: PremiumFrequency;
  /** Insured declared value. */
  idv?: number;
  ncbPercent?: number;
  addOns: string[];
  contact: string;
  photoId?: number;
  notes: string;
}

export type AccessoryCategory = 'protection' | 'luggage' | 'electronics' | 'comfort' | 'performance' | 'other';

export interface Accessory {
  id: number;
  bikeId: number;
  date: ISODate;
  name: string;
  category: AccessoryCategory;
  price: number;
  shop: string;
  odometer?: number;
  photoId?: number;
  notes: string;
}

export type ExpenseCategory = 'parking' | 'toll' | 'fine' | 'wash' | 'insurance' | 'puc' | 'registration' | 'other';

export interface Expense {
  id: number;
  bikeId: number;
  date: ISODate;
  category: ExpenseCategory;
  amount: number;
  odometer?: number;
  notes: string;
}

export interface Photo {
  id: number;
  blob: Blob;
  createdAt: number;
}

/** Units are labels only: values are stored exactly as you enter them. */
export interface Settings {
  id: 1;
  currencyCode: string;
  currencySymbol: string;
  distanceUnit: string;
  fuelUnit: string;
  mileageUnit: string;
  activeBikeId: number;
  lastBackupDate?: ISODate;
  installGuideDismissed: boolean;
  persistentStorage?: boolean;
  /** How often the app asks for a backup. Missing means monthly. */
  backupFrequency?: BackupFrequency;
  /** The day the app last asked, so it asks at most once a day. */
  backupPromptDate?: ISODate;
  /** OAuth client ID from your own Google Cloud project, for Drive backups. */
  googleClientId?: string;
  driveFolderId?: string;
  lastDriveBackup?: string;
}

export type BackupFrequency = 'weekly' | 'monthly' | 'off';

export const ACCESSORY_CATEGORY_LABELS: Record<AccessoryCategory, string> = {
  protection: 'Protection',
  luggage: 'Luggage',
  electronics: 'Electronics',
  comfort: 'Comfort',
  performance: 'Performance',
  other: 'Other',
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  parking: 'Parking',
  toll: 'Toll',
  fine: 'Fine',
  wash: 'Wash',
  insurance: 'Insurance',
  puc: 'PUC',
  registration: 'Registration',
  other: 'Other',
};

export const DEFAULT_TRIP_TAGS = ['Commute', 'Ride', 'Long trip'];

export const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  serviceItem: 'Service item',
  insurance: 'Insurance',
  puc: 'PUC',
  registration: 'Registration',
  license: 'Licence',
  custom: 'Custom',
};

/** Suggested title and repeat for document-style reminders. */
export const REMINDER_TYPE_DEFAULTS: Partial<Record<ReminderType, { title: string; repeatMonths?: number }>> = {
  insurance: { title: 'Insurance renewal', repeatMonths: 12 },
  puc: { title: 'PUC certificate', repeatMonths: 12 },
  registration: { title: 'Registration renewal' },
  license: { title: 'Driving licence renewal' },
};

/** Suggestions for the insurer field; you can type any name. */
export const INSURERS = [
  'ICICI Lombard',
  'HDFC ERGO',
  'Bajaj General',
  'Tata AIG',
  'New India Assurance',
  'United India Insurance',
  'The Oriental Insurance',
  'National Insurance',
  'Go Digit',
  'Acko',
  'SBI General',
  'Reliance General',
  'Royal Sundaram',
  'IFFCO Tokio',
  'Cholamandalam MS',
  'Zurich Kotak',
  'Liberty General',
  'Shriram General',
  'Future Generali',
  'Universal Sompo',
  'Magma General',
  'Navi General',
];

export const RIDING_CONDITIONS: { key: string; label: string }[] = [
  { key: 'city', label: 'City' },
  { key: 'highway', label: 'Highway' },
  { key: 'mixed', label: 'Mixed' },
  { key: 'hills', label: 'Hills / ghats' },
  { key: 'offroad', label: 'Off-road' },
  { key: 'touring', label: 'Loaded touring' },
];
