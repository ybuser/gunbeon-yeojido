/** Request sharing for this page lifetime only. Reloading clears all entries. */
const requests = new Map<
  string,
  { promise: Promise<Response>; started: number }
>();
export function clearPageCache(prefix = '/api/') {
  for (const key of requests.keys())
    if (key.includes(prefix)) requests.delete(key);
}
export function pageFetch(
  input: string,
  init: RequestInit = {},
  options: { refresh?: boolean; maxAge?: number } = {},
) {
  const key =
    (init.method || 'GET') + ' ' + input + ' ' + String(init.body || '');
  const existing = requests.get(key);
  if (
    existing &&
    !options.refresh &&
    Date.now() - existing.started < (options.maxAge ?? Infinity)
  )
    return existing.promise.then((r) => r.clone());
  // A view unmount must not abort a request another view is using.
  const { signal: _signal, ...sharedInit } = init;
  const promise = fetch(input, { ...sharedInit, cache: 'no-store' });
  requests.set(key, { promise, started: Date.now() });
  promise.catch(() => {
    if (requests.get(key)?.promise === promise) requests.delete(key);
  });
  return promise.then((r) => r.clone());
}
