import { useState } from 'react';
import { useSettings } from '../db/hooks';
import { loadExportData } from '../db/exportData';
import type { ExportScope } from '../lib/export/xlsx';
import { todayISO } from '../lib/format';
import { shareOrDownload } from '../lib/share';

export interface ExportOption {
  label: string;
  scope: ExportScope;
}

/** Buttons that build an .xlsx for a period and hand it to the share sheet. */
export default function ExportPanel({ options, bikeId }: { options: ExportOption[]; bikeId?: number }) {
  const settings = useSettings();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function run(option: ExportOption) {
    if (!settings || busy) return;
    setBusy(option.label);
    setMessage('');
    try {
      // The Excel library is large, so it only loads the first time you export.
      const { workbookFile } = await import('../lib/export/xlsx');
      const file = await workbookFile(await loadExportData(bikeId ?? settings.activeBikeId), option.scope, todayISO());
      const result = await shareOrDownload(file);
      setMessage(result === 'cancelled' ? '' : result === 'shared' ? `Shared ${file.name}.` : `Downloaded ${file.name}.`);
    } catch (err) {
      setMessage(`Export failed: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="export-panel">
      <div className="export-buttons">
        {options.map((o) => (
          <button key={o.label} type="button" className="btn" onClick={() => run(o)} disabled={busy !== null}>
            {busy === o.label ? 'Building…' : o.label}
          </button>
        ))}
      </div>
      {message && <p className="hint">{message}</p>}
    </div>
  );
}
