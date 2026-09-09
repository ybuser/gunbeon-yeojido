import { request } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
const base = process.env.QA_BASE_URL || 'http://localhost:3000',
  out = path.resolve(process.env.QA_OUT_DIR || '../tmp/qa/advice-live');
const catalog = JSON.parse(
  await fs.readFile(
    new URL('../lib/data/places.json', import.meta.url),
    'utf8',
  ),
);
const ids = catalog
  .filter((p) => p.sigungu === '고성군')
  .slice(0, 2)
  .map((p) => p.id);
const owner = await request.newContext({ baseURL: base }),
  guest = await request.newContext({ baseURL: base }),
  headers = { origin: base };
let id;
const report = {
  at: new Date().toISOString(),
  base,
  mode: 'actual server TourAPI search and detail validation, no route mocks; no provider payload persisted',
};
try {
  await owner.post('/api/test-access', {
    headers,
    data: { password: process.env.QA_PASSWORD || '1234' },
  });
  const r = await owner.post('/api/advice', {
    headers,
    data: {
      action: 'create',
      snapshot: { region: '고성군', question: 'meal', placeIds: ids },
    },
  });
  if (r.status() !== 201) throw new Error('QA publish failed: ' + r.status());
  id = (await r.json()).id;
  await guest.get('/api/public-advice/' + id);
  const search = await guest.get(
      '/api/public-advice/' + id + '?q=' + encodeURIComponent('카페'),
    ),
    data = await search.json();
  report.search = {
    status: search.status(),
    received: (data.places || []).length,
    total: data.total || 0,
    error: data.error || null,
  };
  if (search.ok() && data.places?.length) {
    const proposed = await guest.post('/api/public-advice/' + id, {
      headers,
      data: {
        action: 'suggest',
        suggestion: {
          kind: 'add',
          targetId: ids[0],
          placeId: data.places[0].id,
          reason: '식사 시간을 넣으면 좋겠어요',
        },
      },
    });
    report.detailValidation = { status: proposed.status() };
    const detail = await (await owner.get('/api/advice?id=' + id)).json();
    report.publicHydration = {
      suggestions: detail.suggestions?.length || 0,
      missing: detail.missing?.length || 0,
    };
  }
  report.status =
    report.search.status === 200 && report.detailValidation?.status === 201
      ? 'passed'
      : 'provider-unavailable';
} finally {
  if (id)
    await owner.post('/api/advice', {
      headers,
      data: { action: 'delete', id },
    });
  await owner.dispose();
  await guest.dispose();
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(out + '/results.json', JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
