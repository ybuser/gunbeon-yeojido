import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assess,
  createEntry,
  defaultSettings,
  manualToPlace,
  publicCard,
  familyProjection,
  resolveEntry,
  routeSchedule,
  validManualPlace,
  visitRestriction,
} from '../lib/domain.ts';
const now = new Date('2026-09-07T01:00:00Z');
const origin = {
  ...manualToPlace({
    id: 'manual:origin',
    title: '공개 관광 거점',
    address: '강원특별자치도 철원군',
    lat: 38.186,
    lon: 127.287,
    sigungu: '철원군',
    category: 'attraction',
    publicPlaceDeclared: true,
  }),
  id: 'tourapi:1',
  source: 'tourapi',
  source_id: '1',
  image_url: 'https://example.invalid/photo.jpg',
};
const manual = {
  id: 'manual:cafe',
  title: '새로 찾은 카페',
  address: '강원특별자치도 철원군 공개 상호',
  lat: 38.189,
  lon: 127.29,
  sigungu: '철원군',
  category: 'cafe',
  publicPlaceDeclared: true,
};
const settings = {
  ...defaultSettings(now),
  returnAt: '2026-09-07T13:00:00Z',
  walkLimit: 120,
};
const mission = {
  id: 'custom:m',
  custom: true,
  title: '우리끼리 쓰는 이름',
  brief: '',
  region: '철원군',
  variant: '내 코스',
  departureAt: '2026-09-07T02:00:00Z',
  transport: 'car',
  stops: [
    { place: manualToPlace(manual), stay: 45, walk: 10, walkVerified: false },
  ],
};
test('custom plans restore one through twelve stops with manual definitions and no provider payload', () => {
  for (const size of [1, 2, 3, 4, 5, 12]) {
    const m = {
      ...mission,
      stops: Array.from({ length: size }, (_, i) => ({
        ...mission.stops[0],
        place: manualToPlace({
          ...manual,
          id: 'manual:' + i,
          title: '공개 장소 ' + i,
        }),
      })),
    };
    const entry = createEntry(m, origin, 'record');
    assert.equal(entry.plan.stops.length, size);
    assert.equal(entry.plan.manualPlaces.length, size);
    assert.equal(resolveEntry(entry, [origin]).mission.stops.length, size);
    assert(!JSON.stringify(entry).includes('photo.jpg'));
    assert(!JSON.stringify(entry).includes('returnAt'));
    assert.equal(entry.plan.departureAt, mission.departureAt);
  }
});
test('unknown manual coordinates keep their place and never produce a safe margin', () => {
  const m = {
    ...mission,
    stops: [
      {
        ...mission.stops[0],
        place: manualToPlace({ ...manual, lat: null, lon: null }),
      },
    ],
  };
  const resolved = resolveEntry(createEntry(m, origin), [origin]);
  assert(resolved);
  assert.equal(resolved.mission.stops[0].place.title, manual.title);
  assert.equal(assess(resolved.mission, settings, origin, now).margin, null);
  assert.equal(assess(resolved.mission, settings, origin, now).band, 'unknown');
});
test('schedule and assessment share travel, waiting, departure delay and final return leg', () => {
  const route = routeSchedule(mission, settings, origin, now),
    a = assess(mission, settings, origin, now);
  assert.equal(route.beforeStart, 60);
  assert.equal(route.legs.length, 2);
  assert.equal(a.costs['구간·거점 이동 추정'], route.travel);
  assert.equal(a.costs['교통 대기 추정'], route.wait);
  assert.equal(
    (route.returnedAt - now.getTime()) / 60000,
    route.beforeStart + route.travel + route.wait + 45,
  );
  const longer = assess(
    { ...mission, stops: [{ ...mission.stops[0], stay: 75 }] },
    settings,
    origin,
    now,
  );
  assert.equal(longer.margin, a.margin - 30);
});
test('free text and manual coordinates never escape into public or family projections', () => {
  const entry = createEntry(mission, origin);
  const card = publicCard(entry);
  assert.equal(card.mission, '나만의 강원 여행');
  const family = {
    code: 'ABCDEFGH',
    expiresAt: now.getTime() + 1000,
    scopes: {
      passport: true,
      schedule: true,
      meal: false,
      propose: true,
      stamp: true,
    },
  };
  const projection = familyProjection(
    family,
    family.code,
    [entry],
    mission,
    '',
    now.getTime(),
  );
  const serialized = JSON.stringify(projection);
  for (const text of [
    manual.title,
    manual.address,
    mission.title,
    '38.189',
    'departureAt',
    'returnAt',
  ])
    assert(!serialized.includes(text));
  assert(projection.mission.placeNames.includes('직접 추가한 공개 장소'));
});
test('manual military terms and out-of-region coordinates are rejected; matching names do not gain official status', () => {
  assert(validManualPlace(manual));
  assert(!validManualPlace({ ...manual, title: '우리 부대 위병소' }));
  assert(!validManualPlace({ ...manual, lat: 37, lon: 126 }));
  assert(!validManualPlace({ ...manual, publicPlaceDeclared: false }));
  const flower = manualToPlace({ ...manual, title: '고석정꽃밭' });
  assert.equal(
    visitRestriction(flower, new Date('2026-09-08T03:00:00Z'), 60),
    null,
  );
});
test('custom clock does not inherit an old overnight duration preset', () => {
  const short = assess(mission, { ...settings, duration: 240 }, origin, now);
  const overnight = assess(
    mission,
    { ...settings, duration: 1440 },
    origin,
    now,
  );
  assert.equal(short.margin, overnight.margin);
  assert.equal(overnight.costs['숙박·휴식 확보'], 0);
});
test('custom provider places with missing coordinates restore without claiming a margin', () => {
  const place = {
    ...origin,
    id: 'tourapi:2',
    source_id: '2',
    lat: null,
    lon: null,
  };
  const m = { ...mission, stops: [{ ...mission.stops[0], place }] };
  const resolved = resolveEntry(createEntry(m, origin), [origin, place]);
  assert(resolved);
  assert.equal(resolved.mission.stops[0].place.id, place.id);
  assert.equal(assess(resolved.mission, settings, origin, now).margin, null);
});
