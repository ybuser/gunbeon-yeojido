import test from 'node:test';
import assert from 'node:assert/strict';
import { sharePlan, validSharedPlan, groupEntry } from '../lib/group-model.ts';

const manual = (id, title, overrides = {}) => ({
  id: 'manual:' + id,
  title,
  address: '개인이 입력한 만남 설명',
  lat: 38.18,
  lon: 127.28,
  sigungu: '철원군',
  category: 'other',
  ...overrides,
});
const gate = manual('gate', '개인 만남 장소');
const cafe = manual('cafe', '개인 카페');
const unused = manual('unused', '공유하지 않은 즐겨찾기');
function personalEntry() {
  return {
    recordId: 'private-record',
    missionId: 'custom:fixture',
    title: '가족과 함께 고른 여행',
    region: '철원군',
    stamps: ['입경'],
    completedAt: '2026-09-08T09:00:00Z',
    favorites: [unused],
    activeOuting: { startedAt: 'PRIVATE_ACTUAL_START' },
    returnAt: 'PRIVATE_RETURN',
    plan: {
      kind: 'custom',
      originId: gate.id,
      departureAt: '2026-09-10T01:00:00Z',
      timeBudgetMinutes: 240,
      transport: 'car',
      providerPayload: { overview: 'PRIVATE_PROVIDER_PAYLOAD' },
      stops: [
        {
          placeId: 'tourapi:1',
          stay: 45,
          walk: 10,
          overview: 'PRIVATE_STOP_PAYLOAD',
        },
        { placeId: cafe.id, stay: 30, walk: 5 },
        { placeId: 'tourapi:2', stay: 60, walk: 15 },
      ],
      manualPlaces: [
        { ...gate, privateNote: 'PRIVATE_NOTE', image_url: 'PRIVATE_IMAGE' },
        cafe,
        unused,
      ],
    },
  };
}
function validPlan() {
  return {
    title: '강원 여행',
    region: '철원군',
    departureAt: '2026-09-10T01:00:00Z',
    transport: 'car',
    meetingId: 'tourapi:1',
    stops: [{ placeId: 'tourapi:2', stay: 45, walk: 10 }],
    manualPlaces: [],
  };
}

test('default sharing uses a whitelist and excludes manual places, private time and provider payloads', () => {
  const entry = personalEntry();
  const before = structuredClone(entry);
  const shared = sharePlan(entry);
  assert.deepEqual(
    Object.keys(shared).sort(),
    [
      'title',
      'region',
      'departureAt',
      'transport',
      'stops',
      'manualPlaces',
      'meetingId',
    ].sort(),
  );
  assert.deepEqual(shared.stops, [
    { placeId: 'tourapi:1', stay: 45, walk: 10 },
    { placeId: 'tourapi:2', stay: 60, walk: 15 },
  ]);
  assert.equal(shared.meetingId, '');
  assert.deepEqual(shared.manualPlaces, []);
  assert.equal(
    shared.departureAt,
    entry.plan.departureAt,
    'the chosen planning date is intentionally shared',
  );
  assert(validSharedPlan(shared));
  assert.deepEqual(sharePlan(entry, false), shared);
  const serialized = JSON.stringify(shared);
  for (const forbidden of [
    'PRIVATE_',
    'private-record',
    'manual:',
    'stamps',
    'completedAt',
    'activeOuting',
    'returnAt',
    'timeBudgetMinutes',
    'favorites',
  ])
    assert(!serialized.includes(forbidden), forbidden);
  assert.deepEqual(
    entry,
    before,
    'projection must not mutate the personal itinerary',
  );
});

test('explicit manual sharing includes only referenced definitions and strips extra fields', () => {
  const shared = sharePlan(personalEntry(), true);
  assert.equal(shared.meetingId, gate.id);
  assert.deepEqual(
    shared.stops.map((s) => s.placeId),
    ['tourapi:1', cafe.id, 'tourapi:2'],
  );
  assert.deepEqual(shared.manualPlaces, [gate, cafe]);
  for (const place of shared.manualPlaces)
    assert.deepEqual(
      Object.keys(place).sort(),
      ['id', 'title', 'address', 'lat', 'lon', 'sigungu', 'category'].sort(),
    );
  assert(!JSON.stringify(shared).includes(unused.title));
  assert(!JSON.stringify(shared).includes('PRIVATE_'));
  assert(validSharedPlan(shared));
});

test('empty group drafts and manual-only drafts without sharing consent remain valid empty plans', () => {
  const empty = { ...validPlan(), meetingId: '', stops: [] };
  assert(validSharedPlan(empty));
  const entry = personalEntry();
  entry.plan.stops = [{ placeId: cafe.id, stay: 30, walk: 5 }];
  const shared = sharePlan(entry);
  assert.deepEqual(shared.stops, []);
  assert.equal(shared.meetingId, '');
  assert.deepEqual(shared.manualPlaces, []);
  assert(validSharedPlan(shared));
  assert.throws(() => sharePlan({ ...entry, plan: undefined }), /계획/);
});

test('validation rejects malformed top-level values without throwing', () => {
  const baseline = validPlan();
  const cases = [
    null,
    undefined,
    false,
    0,
    '',
    [],
    { ...baseline, title: undefined },
    { ...baseline, title: '' },
    { ...baseline, title: ' 여행 ' },
    { ...baseline, title: '<script>' },
    { ...baseline, title: '가'.repeat(61) },
    { ...baseline, region: '서울특별시' },
    { ...baseline, departureAt: 0 },
    { ...baseline, departureAt: 'not-a-date' },
    { ...baseline, transport: 'plane' },
    { ...baseline, meetingId: null },
    { ...baseline, meetingId: '<invalid>' },
    { ...baseline, stops: null },
    { ...baseline, manualPlaces: null },
  ];
  for (const value of cases)
    assert.equal(validSharedPlan(value), false, JSON.stringify(value));
});

test('stop validation rejects missing objects, duplicates and invalid duration or walking values', () => {
  const baseline = validPlan();
  const stop = baseline.stops[0];
  const invalidStops = [
    [null],
    [undefined],
    [{}],
    [{ ...stop, placeId: '' }],
    [{ ...stop, placeId: 'a/b' }],
    [{ ...stop, stay: '45' }],
    [{ ...stop, stay: 0 }],
    [{ ...stop, stay: 1441 }],
    [{ ...stop, stay: 1.5 }],
    [{ ...stop, stay: Infinity }],
    [{ ...stop, walk: -1 }],
    [{ ...stop, walk: 241 }],
    [{ ...stop, walk: NaN }],
    [{ ...stop, walk: 1.5 }],
    [{ ...stop, stay: 10, walk: 11 }],
    [stop, { ...stop }],
    Array.from({ length: 13 }, (_, i) => ({
      ...stop,
      placeId: 'tourapi:' + i,
    })),
  ];
  for (const stops of invalidStops)
    assert.equal(
      validSharedPlan({ ...baseline, stops }),
      false,
      JSON.stringify(stops),
    );
  assert(
    validSharedPlan({
      ...baseline,
      stops: Array.from({ length: 12 }, (_, i) => ({
        ...stop,
        placeId: 'tourapi:' + i,
      })),
    }),
  );
  assert(
    validSharedPlan({
      ...baseline,
      stops: [{ ...stop, stay: 1440, walk: 240 }],
    }),
  );
});

test('manual references must resolve uniquely to valid manual definitions', () => {
  const baseline = validPlan();
  const referenced = { ...baseline, meetingId: gate.id, manualPlaces: [gate] };
  assert(validSharedPlan(referenced));
  assert.equal(validSharedPlan({ ...referenced, manualPlaces: [] }), false);
  assert.equal(
    validSharedPlan({
      ...baseline,
      stops: [{ placeId: cafe.id, stay: 30, walk: 5 }],
    }),
    false,
  );
  assert.equal(
    validSharedPlan({ ...referenced, manualPlaces: [gate, { ...gate }] }),
    false,
  );
  assert.equal(validSharedPlan({ ...referenced, manualPlaces: [null] }), false);
  assert.equal(
    validSharedPlan({
      ...referenced,
      manualPlaces: [{ ...gate, lat: null, lon: 127.28 }],
    }),
    false,
  );
  assert.equal(
    validSharedPlan({
      ...referenced,
      manualPlaces: [{ ...gate, lat: 0, lon: 0 }],
    }),
    false,
  );
  assert.equal(
    validSharedPlan({
      ...referenced,
      manualPlaces: Array.from({ length: 14 }, (_, i) => ({
        ...gate,
        id: 'manual:' + i,
      })),
    }),
    false,
  );
  assert(
    validSharedPlan({
      ...referenced,
      manualPlaces: [{ ...gate, lat: null, lon: null }],
    }),
    'an unresolved map location may remain an explicit draft',
  );
});

test('copying a shared plan creates a new private plan without importing completion state', () => {
  const shared = sharePlan(personalEntry(), true);
  const record = {
    id: 'group-plan',
    groupId: 'group',
    authorId: 'author',
    version: 3,
    updatedAt: '2026-09-08T00:00:00Z',
    plan: shared,
  };
  const first = groupEntry(record),
    second = groupEntry(record);
  assert.notEqual(first.recordId, second.recordId);
  assert.equal(first.plan.kind, 'custom');
  assert.deepEqual(first.plan.stops, shared.stops);
  assert.deepEqual(first.plan.manualPlaces, shared.manualPlaces);
  assert.equal(first.plan.originId, shared.meetingId);
  assert.equal(first.plan.departureAt, shared.departureAt);
  assert.deepEqual(first.stamps, []);
  assert.equal(first.completedAt, undefined);
});
