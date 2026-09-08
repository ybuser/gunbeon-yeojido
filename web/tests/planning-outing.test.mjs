import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultSettings,
  manualToPlace,
  createEntry,
  resolveEntry,
  withPlan,
  assessPlan,
  planSchedule,
  assessOuting,
  completeTrip,
  hasVisitRecord,
  familyProjection,
  publicCard,
} from '../lib/domain.ts';
const morning = new Date('2026-09-08T01:00:00Z');
const settings = {
  ...defaultSettings(morning),
  walkLimit: 120,
  weather: 'clear',
};
const origin = manualToPlace({
  id: 'manual:gate',
  title: '정문 앞',
  address: '늘 만나는 지점',
  lat: 38.18,
  lon: 127.28,
  sigungu: '철원군',
  category: 'other',
});
const cafe = manualToPlace({
  id: 'manual:cafe',
  title: '우리 카페',
  address: '',
  lat: 38.19,
  lon: 127.29,
  sigungu: '철원군',
  category: 'cafe',
});
const mission = withPlan(
  {
    id: 'custom:outing',
    custom: true,
    title: '함께 보내는 하루',
    region: '철원군',
    variant: '내 코스',
    brief: '',
    stops: [{ place: cafe, stay: 45, walk: 10, walkVerified: false }],
  },
  settings,
);
const entry = createEntry(mission, origin, 'record');
test('planning stays fixed while only the current outing loses elapsed minutes', () => {
  const later = new Date(morning.getTime() + 30 * 60000);
  assert.equal(
    assessPlan(mission, settings, origin, morning).margin,
    assessPlan(mission, settings, origin, later).margin,
  );
  assert.equal(
    planSchedule(mission, settings, origin).start,
    morning.getTime(),
  );
  const active = {
    entry,
    startedAt: morning.toISOString(),
    timeBudgetMinutes: 240,
    completedStops: 0,
    settings: {
      transport: 'car',
      companion: '부모님',
      walkLimit: 120,
      extraBuffer: 15,
    },
  };
  assert.equal(
    assessOuting(active, [], later).score.margin,
    assessOuting(active, [], morning).score.margin - 30,
  );
  const visited = assessOuting({ ...active, completedStops: 1 }, [], later);
  assert.equal(visited.current.id, cafe.id);
  assert.equal(visited.remaining.stops.length, 0);
  assert(visited.score.km > 0);
  assert.equal(entry.plan.departureAt, morning.toISOString());
});
test('empty drafts survive storage without a meeting place and never become completed', () => {
  const draft = createEntry({ ...mission, stops: [] }, undefined, 'empty');
  const restored = resolveEntry(JSON.parse(JSON.stringify(draft)), []);
  assert(restored);
  assert.equal(restored.mission.stops.length, 0);
  assert.equal(restored.origin, undefined);
  const score = assessPlan(restored.mission, settings, origin, morning);
  assert.equal(score.margin, null);
  assert.equal(score.conditionsConfirmed, false);
  assert.equal(completeTrip(draft, ['입경']).completedAt, undefined);
  assert(!hasVisitRecord(draft));
});
test('favorite edits or removal cannot alter a saved itinerary snapshot', () => {
  const edited = manualToPlace({
    ...origin,
    title: '다른 만남 장소',
    lat: 37.6,
    lon: 127.1,
  });
  const before = resolveEntry(entry, [edited]);
  const removed = resolveEntry(entry, []);
  assert.equal(before.origin.title, '정문 앞');
  assert.equal(before.origin.lat, 38.18);
  assert.equal(removed.origin.title, '정문 앞');
});
test('each saved plan restores its own departure and budget rather than the last opened plan', () => {
  const next = createEntry(
    { ...mission, departureAt: '2026-09-10T03:00:00Z', timeBudgetMinutes: 480 },
    origin,
  );
  const a = resolveEntry(entry, []).mission,
    b = resolveEntry(next, []).mission;
  assert.equal(assessPlan(a, settings, origin, morning).available, 240);
  assert.equal(assessPlan(b, settings, origin, morning).available, 480);
  assert.equal(
    planSchedule(b, settings, origin).start,
    Date.parse('2026-09-10T03:00:00Z'),
  );
});
test('only explicit completion records stamps and shared data excludes personal meeting details', () => {
  assert(!hasVisitRecord(entry));
  const done = completeTrip(entry, ['입경', '복귀', 'bad'], morning);
  assert(hasVisitRecord(done));
  assert.equal(done.completedAt, morning.toISOString());
  assert(!done.stamps.includes('bad'));
  assert.equal(entry.stamps.length, 0);
  const family = {
    code: 'TEST',
    expiresAt: morning.getTime() + 1000,
    scopes: {
      passport: true,
      schedule: true,
      meal: false,
      propose: true,
      stamp: true,
    },
  };
  const text = JSON.stringify([
    publicCard(done),
    familyProjection(family, 'TEST', [done], mission, '', morning.getTime()),
  ]);
  for (const value of [
    '정문 앞',
    '늘 만나는 지점',
    '우리 카페',
    '38.18',
    'timeBudgetMinutes',
    'startedAt',
    'departureAt',
  ])
    assert(!text.includes(value));
});
test('forecast age uses real observation time while visit schedule uses plan departure', () => {
  const s = {
    ...settings,
    weather: 'rain',
    weatherForecast: {
      region: '철원군',
      fetchedAt: morning.toISOString(),
      validUntil: '2026-09-09T01:00:00Z',
      baseDate: '20260908',
      baseTime: '0800',
    },
  };
  const fresh = assessPlan(mission, s, origin, morning),
    stale = assessPlan(
      mission,
      s,
      origin,
      new Date(morning.getTime() + 4 * 3600000),
    );
  assert.equal(fresh.available, stale.available);
  assert(stale.issues.some((x) => x.includes('만료')));
  assert.equal(stale.costs['출발 전 대기'], 0);
});
