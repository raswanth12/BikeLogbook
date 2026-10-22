// Google Drive backups, straight from the browser. Uses Google Identity Services for sign-in
// and the Drive REST API. The scope is drive.file: the app can only see files it created
// itself, never the rest of your Drive. These are the app's only network requests, and they
// only happen when you back up or restore with Drive.

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime';
export const FOLDER_NAME = 'Bike Logbook Backups';

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}
interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}
declare global {
  interface Window {
    google?: { accounts: { oauth2: { initTokenClient: (config: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type: string }) => void }) => TokenClient } } };
  }
}

let gisLoading: Promise<void> | null = null;

/** Loads Google's sign-in script ahead of time, so tapping "Back up" can open sign-in at once. */
export function preloadGoogle(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  gisLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoading = null;
      reject(new Error("Couldn't reach Google. Check your connection."));
    };
    document.head.appendChild(script);
  });
  return gisLoading;
}

let cached: { token: string; expires: number } | null = null;

/**
 * Gets an access token. Must be called straight from a tap, because it may open Google's
 * sign-in window, which browsers only allow in response to a tap. After the first consent,
 * Google usually returns a token without asking again.
 */
export function getToken(clientId: string): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return Promise.resolve(cached.token);
  if (!window.google?.accounts) return Promise.reject(new Error('Google sign-in is still loading. Try again in a moment.'));
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (r) => {
        if (r.error || !r.access_token) return reject(new Error(`Google sign-in failed (${r.error ?? 'no token'}).`));
        cached = { token: r.access_token, expires: Date.now() + (r.expires_in ?? 3600) * 1000 };
        resolve(r.access_token);
      },
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'Sign-in was closed.' : `Google sign-in failed (${e.type}).`)),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

async function drive<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
  if (res.status === 401) cached = null;
  if (!res.ok) throw new Error(`Google Drive said ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return (init.method === 'GET' || !init.method) && url.includes('alt=media') ? ((await res.text()) as T) : ((await res.json()) as T);
}

/** The app's backup folder in your Drive, created the first time. */
export async function ensureFolder(token: string, knownId?: string): Promise<string> {
  if (knownId) {
    try {
      const f = await drive<{ id: string; trashed: boolean }>(token, `${API}/files/${knownId}?fields=id,trashed`);
      if (!f.trashed) return f.id;
    } catch {
      // Deleted or not ours any more: look it up or make a new one.
    }
  }
  const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`);
  const found = await drive<{ files: { id: string }[] }>(token, `${API}/files?q=${q}&fields=files(id)`);
  if (found.files[0]) return found.files[0].id;
  const created = await drive<{ id: string }>(token, `${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  return created.id;
}

/** A multipart/related body: file metadata, then the file itself (Drive's one-request upload). */
export function multipartBody(metadata: object, content: string, boundary: string): string {
  return [`--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '', JSON.stringify(metadata), `--${boundary}`, 'Content-Type: application/json', '', content, `--${boundary}--`, ''].join('\r\n');
}

export async function uploadBackup(token: string, folderId: string, name: string, json: string) {
  const boundary = `bikelogbook${Date.now().toString(36)}`;
  return drive<{ id: string; name: string; createdTime: string }>(token, UPLOAD, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipartBody({ name, parents: [folderId], mimeType: 'application/json' }, json, boundary),
  });
}

export interface DriveFile {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
}

export async function listBackups(token: string, folderId: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const r = await drive<{ files: DriveFile[] }>(token, `${API}/files?q=${q}&orderBy=createdTime desc&pageSize=50&fields=files(id,name,createdTime,size)`);
  return r.files;
}

export function downloadBackup(token: string, id: string): Promise<string> {
  return drive<string>(token, `${API}/files/${id}?alt=media`);
}
