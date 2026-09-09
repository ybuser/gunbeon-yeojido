import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adviceProjection,
  validAdviceSnapshot,
  validSuggestion,
  applyAdvice,
  adviceIsApplied,
  adviceEntry,
  adviceReasons,
  suggestionIds,
} from '../lib/advice-model.ts';
const places = ['a', 'b', 'c', 'd'].map((id) => ({
  id,
  source: 'dmz_tourism',
  title: id,
  sigungu: '고성군',
}));
const entry = {
  recordId: 'private-id',
  title: '개인 이름 SECRET',
  region: '고성군',
  missionId: 'm',
  stamps: [],
  plan: {
    kind: 'custom',
    variant: '내 코스',
    originId: 'manual:meeting',
    departureAt: '2026-09-21T01:00:00Z',
    timeBudgetMinutes: 300,
    transport: 'car',
    manualPlaces: [{ id: 'manual:meeting', title: '정문', lat: 38, lon: 128 }],
    stops: [
      { placeId: 'manual:meeting', stay: 5, walk: 0 },
      { placeId: 'a', stay: 30, walk: 5 },
      { placeId: 'b', stay: 40, walk: 10 },
    ],
  },
};
const snapshot = { region: '고성군', question: 'change', placeIds: ['a', 'b'] };
const proposal = {
  id: 's1',
  kind: 'replace',
  targetId: 'b',
  placeId: 'c',
  reason: adviceReasons[0],
  status: 'pending',
};
test('public projection contains only explicit public references and question', () => {
  const p = adviceProjection(entry, places, 'change');
  assert.deepEqual(p, snapshot);
  const serialized = JSON.stringify(p);
  for (const privateText of [
    'SECRET',
    'private-id',
    '2026-09',
    'manual',
    'departure',
    'latitude',
    'returnAt',
  ])
    assert.equal(serialized.includes(privateText), false);
  assert.equal(
    validAdviceSnapshot({ ...snapshot, placeIds: ['manual:x'] }),
    false,
  );
  assert.equal(
    validAdviceSnapshot({ ...snapshot, placeIds: ['a', 'a'] }),
    false,
  );
});
test('concrete proposal rejects free text, invented targets and impossible 12-place add', () => {
  assert.equal(validSuggestion(proposal, snapshot), true);
  assert.equal(
    validSuggestion({ ...proposal, targetId: 'private' }, snapshot),
    false,
  );
  assert.equal(
    validSuggestion({ ...proposal, reason: '<script>' }, snapshot),
    false,
  );
  assert.equal(
    validSuggestion(
      { ...proposal, kind: 'add', targetId: '0' },
      {
        ...snapshot,
        placeIds: Array.from({ length: 12 }, (_, i) => String(i)),
      },
    ),
    false,
  );
  assert.equal(
    validSuggestion(
      { ...proposal, kind: 'remove', placeId: null },
      { ...snapshot, placeIds: ['b'] },
    ),
    false,
  );
});
test('advice review keeps private origin and schedule, never mutates original or completed travel', () => {
  const original = structuredClone(entry),
    result = applyAdvice(entry, proposal);
  assert.ok(result);
  assert.deepEqual(
    result.plan.stops.map((s) => s.placeId),
    ['manual:meeting', 'a', 'c'],
  );
  assert.equal(result.plan.departureAt, entry.plan.departureAt);
  assert.equal(result.plan.originId, entry.plan.originId);
  assert.deepEqual(entry, original);
  assert.equal(adviceIsApplied(result, proposal), true);
  assert.equal(adviceIsApplied(entry, proposal), false);
  assert.equal(
    applyAdvice({ ...entry, completedAt: '2026-09-09T00:00:00Z' }, proposal),
    null,
  );
  assert.equal(applyAdvice(entry, { ...proposal, targetId: 'gone' }), null);
  assert.equal(
    applyAdvice(entry, { ...proposal, targetId: entry.plan.originId }),
    null,
  );
});
test('public plan import starts a separate editable trip with no inherited private time, origin or stamps', () => {
  const copy = adviceEntry(snapshot);
  assert.notEqual(copy.recordId, entry.recordId);
  assert.deepEqual(copy.stamps, []);
  assert.equal(copy.plan.originId, '');
  assert.equal(copy.plan.departureAt, undefined);
  assert.equal(copy.completedAt, undefined);
  assert.equal(copy.adviceShareId, undefined);
  assert.deepEqual(
    copy.plan.stops.map((s) => s.placeId),
    snapshot.placeIds,
  );
});
test('adding has a precise position and stale/duplicate proposals cannot be applied twice', () => {
  const add = { ...proposal, kind: 'add' };
  const result = applyAdvice(entry, add);
  assert.deepEqual(
    result.plan.stops.map((s) => s.placeId),
    ['manual:meeting', 'a', 'b', 'c'],
  );
  assert.equal(applyAdvice(result, add), null);
  assert.equal(
    adviceIsApplied(
      {
        ...result,
        plan: { ...result.plan, stops: [...result.plan.stops].reverse() },
      },
      add,
    ),
    false,
  );
  assert.deepEqual(
    suggestionIds(['a', 'b'], { ...proposal, kind: 'remove', placeId: null }),
    ['a'],
  );
});
