/** Asks the browser not to evict our data. Returns undefined where the API is missing. */
export async function requestPersistentStorage(): Promise<boolean | undefined> {
  if (!navigator.storage?.persist) return undefined;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}
