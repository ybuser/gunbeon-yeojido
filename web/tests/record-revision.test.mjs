import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reviseVisitRecord,
  restoreTravelPlan,
  hasVisitRecord,
  entryKey,
} from '../lib/domain.ts';
const entry = {
  recordId: 'own',
  missionId: 'm',
  title: '하루',
  region: '고성군',
  stamps: ['입경', '복귀', '휴가 씨앗'],
  completedAt: '2026-09-08T10:00:00Z',
  visitedPlaceIds: ['a', 'b'],
  plan: {
    kind: 'custom',
    originId: 'manual:private',
    variant: '내 코스',
    stops: [
      { placeId: 'a', stay: 30, walk: 5 },
      { placeId: 'b', stay: 40, walk: 10 },
    ],
  },
};
test('record correction replaces stamps and visits without changing original date or plan', () => {
  const copy = structuredClone(entry),
    changed = reviseVisitRecord(
      entry,
      '새 이름',
      ['전환'],
      ['b', 'b', 'manual:private', 'intruder'],
    );
  assert.equal(changed.title, '새 이름');
  assert.equal(changed.completedAt, entry.completedAt);
  assert.deepEqual(changed.plan, entry.plan);
  assert.deepEqual(changed.stamps, ['휴가 씨앗', '전환']);
  assert.deepEqual(changed.visitedPlaceIds, ['b']);
  assert.deepEqual(entry, copy);
});
test('legacy record stays a record after clearing every visit stamp without inventing a visit date', () => {
  const old = { ...entry, completedAt: undefined };
  const changed = reviseVisitRecord(old, '하루', [], []);
  assert.equal(hasVisitRecord(changed), true);
  assert.equal(changed.completedAt, undefined);
});
test('restoration keeps itinerary and identity, clears completion and preserves preparation seed', () => {
  const restored = restoreTravelPlan(
    reviseVisitRecord(entry, '수정', ['입경'], ['a']),
  );
  assert.equal(hasVisitRecord(restored), false);
  assert.equal(entryKey(restored), entryKey(entry));
  assert.deepEqual(restored.plan, entry.plan);
  assert.equal(restored.completedAt, undefined);
  assert.equal(restored.visitedPlaceIds, undefined);
  assert.deepEqual(restored.stamps, ['휴가 씨앗']);
});
