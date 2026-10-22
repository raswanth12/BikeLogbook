import { NavLink } from 'react-router-dom';
import { ChartIcon, GaugeIcon, GearIcon, ListIcon, WrenchIcon } from './Icons';

const TABS = [
  { to: '/', label: 'Dashboard', icon: <GaugeIcon /> },
  { to: '/log', label: 'Log', icon: <ListIcon /> },
  { to: '/service', label: 'Service', icon: <WrenchIcon /> },
  { to: '/reports', label: 'Reports', icon: <ChartIcon /> },
  { to: '/settings', label: 'Settings', icon: <GearIcon /> },
];

export default function TabBar() {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
          {t.icon}
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
