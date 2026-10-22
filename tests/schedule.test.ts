import { describe, expect, it } from 'vitest';
import { multipartBody } from '../src/lib/backup/googleDrive';
import { backupDue, shouldPrompt } from '../src/lib/backup/schedule';

describe('backup schedule', () => {
  it('is due with no backup yet, unless backups are off', () => {
    expect(backupDue({}, '2026-10-22')).toBe(true);
    expect(backupDue({ backupFrequency: 'off' }, '2026-10-22')).toBe(false);
  });

  it('waits a week or a month after the last backup', () => {
    expect(backupDue({ backupFrequency: 'weekly', lastBackupDate: '2026-10-16' }, '2026-10-22')).toBe(false);
    expect(backupDue({ backupFrequency: 'weekly', lastBackupDate: '2026-10-15' }, '2026-10-22')).toBe(true);
    expect(backupDue({ lastBackupDate: '2026-09-23' }, '2026-10-22')).toBe(false); // monthly is the default
    expect(backupDue({ lastBackupDate: '2026-09-22' }, '2026-10-22')).toBe(true);
  });

  it('asks at most once a day, and only with data', () => {
    expect(shouldPrompt({}, '2026-10-22', true)).toBe(true);
    expect(shouldPrompt({ backupPromptDate: '2026-10-22' }, '2026-10-22', true)).toBe(false);
    expect(shouldPrompt({}, '2026-10-22', false)).toBe(false);
  });
});

describe('Drive upload body', () => {
  it('puts metadata first, then the file, between boundaries', () => {
    const body = multipartBody({ name: 'b.json', parents: ['F'] }, '{"a":1}', 'XYZ');
    expect(body).toBe('--XYZ\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{"name":"b.json","parents":["F"]}\r\n--XYZ\r\nContent-Type: application/json\r\n\r\n{"a":1}\r\n--XYZ--\r\n');
  });
});
