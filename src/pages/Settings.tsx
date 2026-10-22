import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BackupSection from '../components/BackupSection';
import InstallGuide from '../components/InstallGuide';
import { db } from '../db';
import { useActiveBike, useSettings } from '../db/hooks';
import { loadSampleData, loadStressData } from '../db/sampleData';
import type { Settings as SettingsType } from '../db/types';
import { isStandalone, requestPersistentStorage } from '../lib/storage';

export default function Settings() {
  const settings = useSettings();
  const bike = useActiveBike();
  const [sampleStatus, setSampleStatus] = useState('');

  if (!settings || !bike) return null;

  async function onLoadStress() {
    setSampleStatus('Loading…');
    const t0 = performance.now();
    const { total } = await loadStressData(bike!.id);
    setSampleStatus(`Added ${total.toLocaleString()} records in ${Math.round(performance.now() - t0)} ms.`);
  }

  async function onLoadSample() {
    setSampleStatus('Loading…');
    const n = await loadSampleData(bike!.id);
    setSampleStatus(`Added a sample car too. ${n.fills} fill-ups, ${n.services} services, ${n.trips} trips, ${n.accessories} accessories, ${n.expenses} expenses, insurance and reminders.`);
  }

  return (
    <>
      <header className="page-header">
        <h1>Settings</h1>
      </header>

      <BackupSection settings={settings} />
      <h2 className="section-title">Vehicles</h2>
      <Link to="/settings/vehicles" className="list list-row nav-row">
        <span className="row-title">{bike.name}</span>
        <span className="row-sub">Add a car or another bike, edit details and purchase price</span>
      </Link>
      <Units settings={settings} />
      <h2 className="section-title">Service</h2>
      <Link to="/settings/catalog" className="list list-row nav-row">
        <span className="row-title">Service checklist</span>
        <span className="row-sub">Items, intervals, order</span>
      </Link>
      <Link to="/settings/stations" className="list list-row nav-row">
        <span className="row-title">Petrol stations</span>
        <span className="row-sub">Rename, add an area, delete</span>
      </Link>
      <Link to="/settings/reminders" className="list list-row nav-row">
        <span className="row-title">Reminders</span>
        <span className="row-sub">Oil changes, insurance, PUC, calendar export</span>
      </Link>

      <StorageStatus granted={settings.persistentStorage} />

      <h2 className="section-title">Install</h2>
      {isStandalone() ? (
        <div className="card">
          <p>Installed. You're running Bike Logbook from the home screen.</p>
        </div>
      ) : (
        <InstallGuide />
      )}


      {import.meta.env.DEV && (
        <>
          <h2 className="section-title">Developer</h2>
          <div className="card">
            <button type="button" className="btn" onClick={onLoadSample}>
              Load sample data
            </button>
            <button type="button" className="btn" onClick={onLoadStress}>
              Load stress test (thousands of records)
            </button>
            {sampleStatus && <p className="hint">{sampleStatus}</p>}
          </div>
        </>
      )}

      <h2 className="section-title">About</h2>
      <div className="card">
        <p>Bike Logbook {__APP_VERSION__}</p>
        <p className="hint">Everything you log stays on this device. Nothing is sent anywhere.</p>
      </div>
    </>
  );
}

type UnitKey = 'currencySymbol' | 'currencyCode' | 'distanceUnit' | 'fuelUnit' | 'mileageUnit';

function Units({ settings }: { settings: SettingsType }) {
  // Local copies, saved when a field loses focus, so typing never races the database.
  const [values, setValues] = useState(() => pickUnits(settings));
  useEffect(() => setValues(pickUnits(settings)), [settings]);

  const field = (key: UnitKey, label: string, upper = false) => (
    <label className="field">
      <span>{label}</span>
      <input
        value={values[key]}
        autoCapitalize={upper ? 'characters' : 'off'}
        onChange={(e) => setValues({ ...values, [key]: upper ? e.target.value.toUpperCase() : e.target.value })}
        onBlur={() => {
          const v = values[key].trim();
          if (v && v !== settings[key]) db.settings.update(1, { [key]: v } as Partial<SettingsType>);
          else setValues(pickUnits(settings));
        }}
      />
    </label>
  );

  return (
    <>
      <h2 className="section-title">Units and currency</h2>
      <div className="card form">
        <div className="field-row">
          {field('currencySymbol', 'Currency symbol')}
          {field('currencyCode', 'Currency code', true)}
        </div>
        <div className="field-row three">
          {field('distanceUnit', 'Distance')}
          {field('fuelUnit', 'Fuel')}
          {field('mileageUnit', 'Mileage')}
        </div>
        <p className="hint">These are labels. Numbers are stored exactly as you enter them, and nothing is converted.</p>
      </div>
    </>
  );
}

function pickUnits(s: SettingsType): Record<UnitKey, string> {
  return {
    currencySymbol: s.currencySymbol,
    currencyCode: s.currencyCode,
    distanceUnit: s.distanceUnit,
    fuelUnit: s.fuelUnit,
    mileageUnit: s.mileageUnit,
  };
}

function StorageStatus({ granted }: { granted?: boolean }) {
  async function retry() {
    const result = await requestPersistentStorage();
    if (result !== undefined) await db.settings.update(1, { persistentStorage: result });
  }
  const supported = typeof navigator.storage?.persist === 'function';
  return (
    <>
      <h2 className="section-title">Storage</h2>
      <div className="card">
        {!supported ? (
          <p>This browser can't promise to keep data. Back up regularly.</p>
        ) : granted ? (
          <p>Persistent storage is on. The browser won't clear your data to free up space.</p>
        ) : (
          <>
            <p>Persistent storage is not granted yet. Safari usually grants it once the app is on your home screen.</p>
            <button type="button" className="btn" onClick={retry}>
              Ask again
            </button>
          </>
        )}
      </div>
    </>
  );
}
