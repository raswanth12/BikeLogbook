import { useEffect, useState } from 'react';

function useObjectUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

/** A tappable thumbnail that opens the photo full screen. */
export default function PhotoThumb({ blob, onRemove }: { blob: Blob; onRemove?: () => void }) {
  const url = useObjectUrl(blob);
  const [open, setOpen] = useState(false);
  if (!url) return <div className="thumb" />;

  return (
    <>
      <div className="thumb">
        <button type="button" className="thumb-open" onClick={() => setOpen(true)} aria-label="View photo">
          <img src={url} alt="Bill photo" />
        </button>
        {onRemove && (
          <button type="button" className="thumb-remove" onClick={onRemove} aria-label="Remove photo">
            ×
          </button>
        )}
      </div>
      {open && (
        <div className="viewer" role="dialog" aria-label="Photo" onClick={() => setOpen(false)}>
          <img src={url} alt="Bill photo" />
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      )}
    </>
  );
}
