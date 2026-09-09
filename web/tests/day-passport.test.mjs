import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjustPlan,
  comparePlanAdjustment,
  dayRecord,
  dayRecordSvg,
  dayRecordText,
} from '../lib/day-passport.ts';
import {
  defaultSettings,
  createEntry,
  completeTrip,
  planningSettings,
  assessPlan,
} from '../lib/domain.ts';
const now = new Date('2026-09-09T01:00:00Z');
const place = (id, lat, lon) => ({
  id,
  source: 'fixture',
  source_id: id,
  title: id,
  lat,
  lon,
  sigungu: '고성군',
  category: 'attraction',
  reservation_required: null,
  id_check_required: null,
  opening_status: 'unknown',
  image_url: null,
});
const origin = place('만남', 38.3, 128.49);
const places = [
  place('A', 38.31, 128.5),
  place('B', 38.4, 128.51),
  place('C', 38.32, 128.49),
];
const mission = {
  id: 'm',
  title: '개인 제목 SECRET',
  region: '고성군',
  variant: '내 코스',
  custom: true,
  departureAt: '2026-09-20T01:00:00Z',
  timeBudgetMinutes: 360,
  stops: places.map((place) => ({
    place,
    stay: 45,
    walk: 15,
    walkVerified: false,
  })),
};
const settings = {
  ...defaultSettings(now),
  region: '고성군',
  walkLimit: 60,
  weather: 'rain',
  extraBuffer: 20,
};
for (const transport of ['car', 'transit', 'taxi'])
  test(`adjustment recalculates connected return legs (${transport}) without mutating the plan`, () => {
    const original = structuredClone(mission);
    const m = { ...mission, transport };
    const result = comparePlanAdjustment(
      m,
      settings,
      origin,
      { kind: 'remove', index: 1 },
      now,
    );
    assert.ok(result);
    assert.deepEqual(mission, original);
    assert.equal(result.adjusted.stops.length, 2);
    assert.equal(result.before.walk, 45);
    assert.equal(result.after.walk, 30);
    assert.equal(result.adjusted.departureAt, mission.departureAt);
    assert.equal(result.after.costs['날씨 여유(시나리오)'], 25);
    assert.equal(result.after.costs['추가 안전 버퍼'], 20);
    assert.notEqual(result.minutesGained, 45); // Detour, wait and congestion are also recomputed.
    assert.deepEqual(
      result.after,
      assessPlan(result.adjusted, settings, origin, now),
    );
    assert.deepEqual(
      result,
      comparePlanAdjustment(
        m,
        settings,
        origin,
        { kind: 'remove', index: 1 },
        new Date('2026-09-25T10:00:00Z'),
      ),
    );
  });
test('shorter stays preserve walking and reject unsupported values', () => {
  const adjusted = adjustPlan(mission, origin.id, {
    kind: 'stay',
    index: 0,
    minutes: 15,
  });
  assert.equal(adjusted.stops[0].walk, 15);
  assert.equal(adjusted.stops[0].stay, 15);
  for (const minutes of [0, 14, 45, 100, NaN, 20.5])
    assert.equal(
      adjustPlan(mission, origin.id, { kind: 'stay', index: 0, minutes }),
      null,
    );
});
test('meeting, reservations and last stop are not suggested for removal', () => {
  const m = {
    ...mission,
    stops: [
      { ...mission.stops[0], place: origin },
      {
        ...mission.stops[1],
        place: { ...places[1], reservation_required: true },
      },
    ],
  };
  for (const index of [0, 1, 99])
    assert.equal(adjustPlan(m, origin.id, { kind: 'remove', index }), null);
  assert.equal(
    adjustPlan({ ...mission, stops: [mission.stops[0]] }, origin.id, {
      kind: 'remove',
      index: 0,
    }),
    null,
  );
});
test('missing coordinates or dates do not produce an apparent positive margin', () => {
  for (const m of [
    { ...mission, departureAt: '' },
    { ...mission, timeBudgetMinutes: NaN },
    {
      ...mission,
      stops: [
        { ...mission.stops[0], place: { ...places[0], lat: null } },
        mission.stops[1],
      ],
    },
  ])
    assert.equal(
      comparePlanAdjustment(m, settings, origin, { kind: 'remove', index: 1 }),
      null,
    );
  assert.equal(
    comparePlanAdjustment(mission, settings, undefined, {
      kind: 'remove',
      index: 1,
    }),
    null,
  );
  assert.doesNotThrow(() =>
    planningSettings(
      { ...mission, departureAt: '' },
      { ...settings, startedAt: '' },
    ),
  );
});
test('completion records only explicitly chosen public plan references', () => {
  const manual = {
    ...places[2],
    id: 'manual:private',
    source: 'manual',
    title: 'SECRET 만남',
  };
  const entry = createEntry(
    {
      ...mission,
      stops: [
        mission.stops[0],
        mission.stops[1],
        { ...mission.stops[2], place: manual },
      ],
    },
    origin,
    'record',
  );
  const completed = completeTrip(entry, ['입경', '동행', 'SECRET'], now, [
    'B',
    'A',
    'B',
    'manual:private',
    'foreign',
  ]);
  assert.deepEqual(completed.visitedPlaceIds, ['B', 'A']);
  assert.deepEqual(
    dayRecord(completed, [...places, manual]).places.map((p) => p.id),
    ['A', 'B'],
  );
  assert.equal(entry.completedAt, undefined);
  assert.equal(entry.visitedPlaceIds, undefined);
  const output =
    dayRecordText(completed, [...places, manual]) +
    dayRecordSvg(completed, [...places, manual]);
  for (const secret of [
    'SECRET',
    'manual:private',
    mission.departureAt,
    now.toISOString(),
    '38.30',
    '128.49',
    'record',
  ])
    assert.ok(!output.includes(secret), secret);
  assert.ok(!dayRecord(completed, places).places.some((p) => p.id === 'C'));
});
test('legacy records, explicit no-place records and new copies stay distinct', () => {
  const entry = createEntry(mission, origin, 'old');
  const legacy = completeTrip(entry, ['복귀'], now);
  assert.equal(legacy.visitedPlaceIds, undefined);
  assert.equal(dayRecord(legacy, places).confirmed, false);
  assert.deepEqual(dayRecord(legacy, places).places, []);
  const noPlaces = completeTrip(entry, ['복귀'], now, []);
  assert.equal(dayRecord(noPlaces, places).confirmed, true);
  assert.deepEqual(dayRecord(noPlaces, places).places, []);
  const copy = createEntry(mission, origin, 'new');
  assert.equal(copy.completedAt, undefined);
  assert.equal(copy.visitedPlaceIds, undefined);
});
test('record SVG escapes public place text and contains no external resource', () => {
  const p = { ...places[0], title: '바다 <쉼> & 이야기 "카페"' };
  const entry = completeTrip(createEntry(mission, origin, 'x'), ['입경'], now, [
    'A',
  ]);
  const svg = dayRecordSvg(entry, [p]);
  assert.ok(svg.includes('&lt;쉼&gt; &amp;'));
  assert.ok(svg.includes('&quot;카페&quot;'));
  assert.ok(!svg.includes('<image'));
  assert.ok(!svg.includes('href='));
});
