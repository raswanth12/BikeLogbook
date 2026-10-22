const MAX_SIDE = 1600;
const QUALITY = 0.8;

/** Shrinks a picked photo to at most 1600px on its long side and re-encodes it as JPEG. */
export async function compressImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode photo'))), 'image/jpeg', QUALITY),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
