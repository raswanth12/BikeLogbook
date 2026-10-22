import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import BackupBanner from './components/BackupBanner';
import BackupPrompt from './components/BackupPrompt';
import ReminderBanner from './components/ReminderBanner';
import TabBar from './components/TabBar';
import { db } from './db';
import { requestPersistentStorage } from './lib/storage';
import AccessoryForm from './pages/AccessoryForm';
import Dashboard from './pages/Dashboard';
import ExpenseForm from './pages/ExpenseForm';
import FuelForm from './pages/FuelForm';
import Insurance from './pages/Insurance';
import InsuranceForm from './pages/InsuranceForm';
import Log from './pages/Log';
import ReminderForm from './pages/ReminderForm';
import Reminders from './pages/Reminders';
import Reports from './pages/Reports';
import Service from './pages/Service';
import ServiceCatalog from './pages/ServiceCatalog';
import ServiceForm from './pages/ServiceForm';
import Settings from './pages/Settings';
import Stations from './pages/Stations';
import TripForm from './pages/TripForm';
import VehicleForm from './pages/VehicleForm';
import Vehicles from './pages/Vehicles';

export default function App() {
  useEffect(() => {
    requestPersistentStorage().then((granted) => {
      if (granted !== undefined) db.settings.update(1, { persistentStorage: granted });
    });
  }, []);

  return (
    <div className="app">
      <main className="content">
        <ReminderBanner />
        <BackupBanner />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/log" element={<Log />} />
          <Route path="/fuel/new" element={<FuelForm />} />
          <Route path="/fuel/:id" element={<FuelForm />} />
          <Route path="/trip/new" element={<TripForm />} />
          <Route path="/trip/:id" element={<TripForm />} />
          <Route path="/accessory/new" element={<AccessoryForm />} />
          <Route path="/accessory/:id" element={<AccessoryForm />} />
          <Route path="/expense/new" element={<ExpenseForm />} />
          <Route path="/expense/:id" element={<ExpenseForm />} />
          <Route path="/insurance" element={<Insurance />} />
          <Route path="/insurance/new" element={<InsuranceForm />} />
          <Route path="/insurance/:id" element={<InsuranceForm />} />
          <Route path="/service" element={<Service />} />
          <Route path="/service/new" element={<ServiceForm />} />
          <Route path="/service/:id" element={<ServiceForm />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/catalog" element={<ServiceCatalog />} />
          <Route path="/settings/reminders" element={<Reminders />} />
          <Route path="/settings/stations" element={<Stations />} />
          <Route path="/settings/vehicles" element={<Vehicles />} />
          <Route path="/vehicle/new" element={<VehicleForm />} />
          <Route path="/vehicle/:id" element={<VehicleForm />} />
          <Route path="/reminder/new" element={<ReminderForm />} />
          <Route path="/reminder/:id" element={<ReminderForm />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>
      <TabBar />
      <BackupPrompt />
    </div>
  );
}
