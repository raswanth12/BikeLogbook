export interface CalendarReminder {
  id: number;
  title: string;
  dueDate: string; // 'YYYY-MM-DD'
  repeatMonths?: number;
  /** Last day the repeat runs to, e.g. when a policy ends. */
  until?: string;
  /** How many days ahead the first alert fires. Defaults to 7. */
  alertDays?: number;
  description?: string;
}

const escape = (text: string) => text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

const compactDate = (iso: string) => iso.replace(/-/g, '');

function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** RFC 5545 asks for lines of at most 75 octets; longer ones continue on a line starting with a space. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join('\r\n ');
}

/**
 * An all-day event per reminder, with an alert some days before (a week unless set) and at
 * 9:00 on the day.
 * Repeating reminders repeat in the calendar too.
 */
export function buildIcs(reminders: CalendarReminder[], now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bike Logbook//Reminders//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const r of reminders) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:reminder-${r.id}-${compactDate(r.dueDate)}@bike-logbook`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compactDate(r.dueDate)}`,
      `DTEND;VALUE=DATE:${compactDate(nextDay(r.dueDate))}`,
      `SUMMARY:${escape(r.title)}`,
    );
    if (r.description) lines.push(`DESCRIPTION:${escape(r.description)}`);
    if (r.repeatMonths) lines.push(`RRULE:FREQ=MONTHLY;INTERVAL=${r.repeatMonths}${r.until ? `;UNTIL=${compactDate(r.until)}` : ''}`);
    const lead = r.alertDays ?? 7;
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escape(r.title)} in ${lead === 1 ? '1 day' : `${lead} days`}`,
      `TRIGGER:-P${lead}D`,
      'END:VALARM',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escape(r.title)} today`,
      'TRIGGER:PT9H',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
