import { useState } from 'react';

export interface LogFilter {
  query: string;
  from: string;
  to: string;
  setQuery: (v: string) => void;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  /** True when the record's date is in range and its text contains the search. */
  matches: (date: string, text: string) => boolean;
}

export function useLogFilter(): LogFilter {
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const q = query.trim().toLowerCase();
  return {
    query,
    from,
    to,
    setQuery,
    setFrom,
    setTo,
    matches: (date, text) => (!from || date >= from) && (!to || date <= to) && (!q || text.toLowerCase().includes(q)),
  };
}

export default function LogFilters({ filter, placeholder }: { filter: LogFilter; placeholder: string }) {
  return (
    <div className="filters">
      <input type="search" placeholder={placeholder} value={filter.query} onChange={(e) => filter.setQuery(e.target.value)} aria-label="Search" />
      <div className="date-range">
        <label>
          <span>From</span>
          <input type="date" value={filter.from} onChange={(e) => filter.setFrom(e.target.value)} />
        </label>
        <label>
          <span>To</span>
          <input type="date" value={filter.to} onChange={(e) => filter.setTo(e.target.value)} />
        </label>
      </div>
    </div>
  );
}
