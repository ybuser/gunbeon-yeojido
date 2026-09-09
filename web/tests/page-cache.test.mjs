import test from 'node:test';
import assert from 'node:assert/strict';
import { pageFetch, clearPageCache } from '../lib/page-cache.ts';

const response = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
test.beforeEach(() => clearPageCache(''));
test.afterEach(() => clearPageCache(''));

test('concurrent consumers share one request and receive independently readable bodies', async (t) => {
  let finish;
  const network = t.mock.method(
    globalThis,
    'fetch',
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const first = pageFetch('/api/places?region=fixture');
  const second = pageFetch('/api/places?region=fixture');
  assert.equal(network.mock.callCount(), 1);
  finish(response({ places: [{ id: 'tourapi:fixture' }] }));
  const [a, b] = await Promise.all([first, second]);
  assert.notEqual(a, b);
  assert.deepEqual(await a.json(), await b.json());
  assert.deepEqual(
    await (await pageFetch('/api/places?region=fixture')).json(),
    {
      places: [{ id: 'tourapi:fixture' }],
    },
  );
  assert.equal(network.mock.callCount(), 1);
});

test('unmounting one consumer does not abort another consumer of the shared request', async (t) => {
  let finish;
  const network = t.mock.method(
    globalThis,
    'fetch',
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const controller = new AbortController();
  const first = pageFetch('/api/places?region=shared', {
    signal: controller.signal,
    headers: { Accept: 'application/json' },
  });
  const second = pageFetch('/api/places?region=shared');
  controller.abort();
  const [, options] = network.mock.calls[0].arguments;
  assert.equal(options.signal, undefined);
  assert.equal(options.cache, 'no-store');
  assert.equal(new Headers(options.headers).get('Accept'), 'application/json');
  finish(response({ ok: true }));
  assert.deepEqual(await (await first).json(), { ok: true });
  assert.deepEqual(await (await second).json(), { ok: true });
  assert.equal(network.mock.callCount(), 1);
});

test('distinct POST resolution bodies and GET requests do not reuse each other', async (t) => {
  const network = t.mock.method(globalThis, 'fetch', async (_url, init) =>
    response({ method: init.method || 'GET', body: init.body || '' }),
  );
  const input = '/api/places/resolve';
  const a = { method: 'POST', body: JSON.stringify({ ids: ['tourapi:1'] }) };
  const b = { method: 'POST', body: JSON.stringify({ ids: ['tourapi:2'] }) };
  const first = await (await pageFetch(input, a)).json();
  assert.deepEqual(await (await pageFetch(input, a)).json(), first);
  assert.notDeepEqual(await (await pageFetch(input, b)).json(), first);
  assert.equal((await (await pageFetch(input)).json()).method, 'GET');
  assert.equal(network.mock.callCount(), 3);
});

test('explicit refresh replaces a cached HTTP failure with the recovered response', async (t) => {
  let calls = 0;
  const network = t.mock.method(globalThis, 'fetch', async () =>
    ++calls === 1
      ? response({ mode: 'unavailable' }, 503)
      : response({ mode: 'live' }),
  );
  assert.equal((await pageFetch('/api/weather?region=fixture')).status, 503);
  const fresh = await pageFetch(
    '/api/weather?region=fixture',
    {},
    { refresh: true },
  );
  assert.equal(fresh.status, 200);
  assert.deepEqual(await fresh.json(), { mode: 'live' });
  assert.deepEqual(
    await (await pageFetch('/api/weather?region=fixture')).json(),
    { mode: 'live' },
  );
  assert.equal(network.mock.callCount(), 2);
});

test('a superseded in-flight failure cannot evict the successful refreshed request', async (t) => {
  let failOld;
  let calls = 0;
  const network = t.mock.method(globalThis, 'fetch', () =>
    ++calls === 1
      ? new Promise((_resolve, reject) => {
          failOld = reject;
        })
      : Promise.resolve(response({ version: 2 })),
  );
  const stale = pageFetch('/api/places?region=race');
  const rejected = assert.rejects(stale, /offline/);
  assert.deepEqual(
    await (
      await pageFetch('/api/places?region=race', {}, { refresh: true })
    ).json(),
    { version: 2 },
  );
  failOld(new Error('offline'));
  await rejected;
  assert.deepEqual(await (await pageFetch('/api/places?region=race')).json(), {
    version: 2,
  });
  assert.equal(network.mock.callCount(), 2);
});

test('network rejection is evicted so the next call can recover', async (t) => {
  let calls = 0;
  const network = t.mock.method(globalThis, 'fetch', async () => {
    if (++calls === 1) throw new TypeError('network offline');
    return response({ recovered: true });
  });
  await assert.rejects(
    pageFetch('/api/places?region=offline'),
    /network offline/,
  );
  assert.deepEqual(
    await (await pageFetch('/api/places?region=offline')).json(),
    { recovered: true },
  );
  assert.equal(network.mock.callCount(), 2);
});

test('selective clearing refreshes the requested endpoint and preserves other page data', async (t) => {
  let calls = 0;
  const network = t.mock.method(globalThis, 'fetch', async () =>
    response({ request: ++calls }),
  );
  const places = await (await pageFetch('/api/places?region=fixture')).json();
  await pageFetch('/api/weather?region=fixture');
  clearPageCache('/api/weather');
  assert.deepEqual(
    await (await pageFetch('/api/places?region=fixture')).json(),
    places,
  );
  assert.equal(
    (await (await pageFetch('/api/weather?region=fixture')).json()).request,
    3,
  );
  clearPageCache();
  await pageFetch('/api/places?region=fixture');
  assert.equal(network.mock.callCount(), 4);
});

test('finite maxAge expires a response without relying on a real timer', async (t) => {
  let now = 1000;
  t.mock.method(Date, 'now', () => now);
  const network = t.mock.method(globalThis, 'fetch', async () =>
    response({ fetchedAt: now }),
  );
  await pageFetch('/api/groups', {}, { maxAge: 60000 });
  now += 59999;
  assert.equal(
    (await (await pageFetch('/api/groups', {}, { maxAge: 60000 })).json())
      .fetchedAt,
    1000,
  );
  now += 1;
  assert.equal(
    (await (await pageFetch('/api/groups', {}, { maxAge: 60000 })).json())
      .fetchedAt,
    61000,
  );
  assert.equal(network.mock.callCount(), 2);
});
