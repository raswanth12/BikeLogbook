/**
 * Opens the iOS share sheet for a file (Save to Files, Mail, WhatsApp...). Where sharing files
 * isn't supported, falls back to a normal download.
 */
export async function shareOrDownload(file: File): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return 'shared';
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return 'cancelled';
      // Any other failure: fall through to a download.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}
