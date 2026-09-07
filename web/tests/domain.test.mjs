import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultSettings,
  assess,
  regionPlaces,
  makeMissions,
  familyProjection,
  publicCard,
  parseKoreaInput,
} from '../lib/domain.ts';
import { tourRequest, fetchRegion, tourPlace } from '../lib/tour-api.ts';
import fs from 'node:fs';
const nodes = JSON.parse(
  fs.readFileSync(new URL('../lib/data/places.json', import.meta.url)),
);
const now = new Date('2026-09-07T03:00:00Z');
const place = (id, lat = 38.18, lon = 127.28) => ({
  id,
  source: 'fixture',
  source_id: id,
  title: id,
  address: '강원특별자치도 철원군',
  lat,
  lon,
  sigungu: '철원군',
  category: 'attraction',
  opening_status: 'unknown',
  reservation_required: null,
  id_check_required: null,
  theme_tags: [],
  data_quality_flags: [],
});
const origin = place('거점'),
  a = place('A', 38.2, 127.3),
  b = place('B', 38.19, 127.27);
const mission = {
  id: 'm',
  title: '공개 장소 테스트',
  region: '철원군',
  variant: '회복',
  stops: [
    { place: a, stay: 30, walk: 10 },
    { place: b, stay: 30, walk: 10 },
  ],
};
const settings = { ...defaultSettings(now), walkLimit: 60 };
test('manual deadline is the single time constraint and elapsed time reduces margin', () => {
  const s = { ...settings, returnAt: '2026-09-07T09:00:00Z' };
  const r = assess(mission, s, origin, now);
  assert.equal(r.available, 360);
  const later = assess(mission, s, origin, new Date(now.getTime() + 60000));
  assert.equal(later.margin, r.margin - 1);
});
test('midnight is explicit Korea date', () => {
  assert.equal(parseKoreaInput('2026-09-08T01:00'), '2026-09-07T16:00:00.000Z');
  assert.equal(
    assess(
      mission,
      { ...settings, returnAt: '2026-09-06T23:00:00Z' },
      origin,
      now,
    ).band,
    'avoid',
  );
});
test('missing coordinate never becomes zero travel', () => {
  const m = {
    ...mission,
    stops: [{ place: { ...a, lat: null }, stay: 30, walk: 10 }],
  };
  assert.equal(assess(m, settings, origin, now).margin, null);
});
test('transit includes the last return leg and cannot be safe', () => {
  const r = assess(
    mission,
    { ...settings, transport: 'transit', returnAt: '2026-09-08T03:00:00Z' },
    origin,
    now,
  );
  assert.equal(r.costs['교통 대기 추정'], 90);
  assert.equal(r.band, 'caution');
});
test('walking excess, closure and wind override generous time', () => {
  const s = { ...settings, returnAt: '2026-09-08T03:00:00Z' };
  assert.equal(
    assess(mission, { ...s, walkLimit: 10 }, origin, now).band,
    'avoid',
  );
  const m = {
    ...mission,
    stops: [{ place: { ...a, opening_status: 'closed' }, stay: 1, walk: 1 }],
  };
  assert.equal(assess(m, s, origin, now).band, 'avoid');
  assert.equal(
    assess(mission, { ...s, weather: 'wind' }, origin, now).band,
    'avoid',
  );
});
test('unknown visit conditions remain visible even with time slack', () => {
  const r = assess(
    mission,
    { ...settings, returnAt: '2026-09-08T03:00:00Z' },
    origin,
    now,
  );
  assert.equal(r.conditionsConfirmed, false);
  assert(r.issues.some((x) => x.includes('예약')));
});
test('regional dedup preserves another region and valid fallback', () => {
  const valid = place('동명');
  assert.equal(
    regionPlaces(
      [
        { ...valid, id: 'wrong', sigungu: '고성군' },
        { ...valid, id: 'bad', lat: null, source: 'tourapi' },
        valid,
      ],
      '철원군',
    )[0].id,
    '동명',
  );
});
test('all five border regions have generated 2–4 node drafts from real source records', () => {
  for (const region of ['철원군', '화천군', '양구군', '인제군', '고성군']) {
    const ms = makeMissions(nodes, { ...settings, region });
    assert(ms.length >= 2);
    assert(ms.every((m) => m.stops.length >= 2 && m.stops.length <= 4));
    assert(ms.every((m) => m.stops.every((s) => s.place.sigungu === region)));
  }
});
test('permission projection, expiry, revoke, and public card strip secrets', () => {
  const f = {
    code: 'ABCD2345',
    expiresAt: now.getTime() + 1000,
    scopes: {
      passport: true,
      schedule: false,
      meal: false,
      propose: false,
      stamp: false,
    },
  };
  const e = {
    missionId: 'm',
    title: '공개 관광 미션',
    region: '철원군',
    stamps: ['입경'],
    returnAt: 'secret',
    lat: 37,
    unit: 'secret',
    name: 'secret',
  };
  const projection = familyProjection(
    f,
    f.code,
    [e],
    mission,
    '국물',
    now.getTime(),
  );
  assert.equal(projection.mission, null);
  assert.equal(projection.meal, null);
  assert.equal(
    familyProjection(null, f.code, [e], mission, '', now.getTime()),
    null,
  );
  assert.equal(
    familyProjection(f, f.code, [e], mission, '', now.getTime() + 1001),
    null,
  );
  const out = JSON.stringify(publicCard(e));
  assert(!out.includes('secret'));
  assert.deepEqual(Object.keys(publicCard(e)), [
    'region',
    'mission',
    'stamps',
    'message',
  ]);
});
test('API handles encoded key once, no-store, XML failures, and missing key', async () => {
  let called;
  await tourRequest(
    'KorService2',
    'areaCode2',
    'key%2Bvalue',
    {},
    async (url, opts) => {
      called = { url, opts };
      return new Response(
        JSON.stringify({
          response: {
            header: { resultCode: '0000' },
            body: { items: { item: [] }, totalCount: 0 },
          },
        }),
      );
    },
  );
  assert.equal(called.url.searchParams.get('serviceKey'), 'key+value');
  assert.equal(called.opts.cache, 'no-store');
  await assert.rejects(
    () =>
      tourRequest('KorService2', 'areaCode2', '', {}, () => {
        throw Error('must not call');
      }),
    /KEY_MISSING/,
  );
  await assert.rejects(
    () =>
      tourRequest(
        'KorService2',
        'areaCode2',
        'key',
        {},
        async () => new Response('<xml>failure</xml>'),
      ),
    /NON_JSON_RESPONSE/,
  );
});
test('TourAPI discovers current Gangwon and district codes from responses', async () => {
  const calls = [];
  const mock = async (url) => {
    calls.push(url);
    let rows = url.pathname.endsWith('ldongCode2')
      ? url.searchParams.has('lDongRegnCd')
        ? [{ name: '철원군', code: '77' }]
        : [{ name: '강원특별자치도', code: '88' }]
      : [
          {
            contentid: '123',
            title: '장소',
            mapx: '127.28',
            mapy: '38.18',
            contenttypeid: url.searchParams.get('contentTypeId'),
          },
        ];
    return new Response(
      JSON.stringify({
        response: {
          header: { resultCode: '0000' },
          body: { items: { item: rows }, totalCount: rows.length },
        },
      }),
    );
  };
  const r = await fetchRegion('TEST', '철원군', mock);
  assert.equal(r.lDongRegnCd, '88');
  assert.equal(r.lDongSignguCd, '77');
  assert.equal(r.categories.length, 5);
  assert.equal(calls.length, 7);
  assert(
    calls
      .slice(2)
      .every(
        (u) =>
          u.searchParams.get('lDongRegnCd') === '88' &&
          u.searchParams.get('lDongSignguCd') === '77',
      ),
  );
});
test('tour place maps long/lat correctly and unknown conditions remain null', () => {
  const p = tourPlace(
    {
      contentid: '2',
      title: '<b>고석정</b>',
      mapx: '127.2',
      mapy: '38.1',
      contenttypeid: '39',
    },
    '철원군',
  );
  assert.equal(p.lat, 38.1);
  assert.equal(p.lon, 127.2);
  assert.equal(p.title, '고석정');
  assert.equal(p.category, 'restaurant');
  assert.equal(p.reservation_required, null);
});
