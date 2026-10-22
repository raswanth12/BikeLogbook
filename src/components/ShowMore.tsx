import { useEffect, useState } from 'react';

export const PAGE_SIZE = 100;

/** Shows the first 100 items, then 100 more per tap. Starts over when `resetKey` changes. */
export function usePaged<T>(items: T[], resetKey: string) {
  const [count, setCount] = useState(PAGE_SIZE);
  useEffect(() => setCount(PAGE_SIZE), [resetKey]);
  return { visible: items.slice(0, count), remaining: Math.max(0, items.length - count), more: () => setCount((c) => c + PAGE_SIZE) };
}

export default function ShowMore({ remaining, onMore }: { remaining: number; onMore: () => void }) {
  if (remaining <= 0) return null;
  return (
    <button type="button" className="btn show-more" onClick={onMore}>
      Show {Math.min(remaining, PAGE_SIZE)} more ({remaining} left)
    </button>
  );
}
