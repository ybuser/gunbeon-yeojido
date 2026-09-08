import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeRecommendations, recommendationEntry } from '../lib/discovery.ts';
const nodes = JSON.parse(
  fs.readFileSync(new URL('../lib/data/places.json', import.meta.url)),
);
test('each border county has three distinct, complete recommendation routes', () => {
  for (const region of ['철원군', '화천군', '양구군', '인제군', '고성군']) {
    const list = makeRecommendations(nodes, region);
    assert.equal(list.length, 3, region);
    assert.equal(new Set(list.map((m) => m.title)).size, 3);
    for (const m of list) {
      assert.ok(m.stops.length >= 2);
      assert.equal(
        new Set(m.stops.map((s) => s.place.id)).size,
        m.stops.length,
      );
      assert.ok(m.stops.every((s) => s.place.sigungu === region));
    }
  }
});
test('discovery stays date-free and creates an unassigned editable plan', () => {
  const m = makeRecommendations(nodes, '고성군')[0],
    e = recommendationEntry(m);
  assert.equal(e.plan.departureAt, undefined);
  assert.equal(e.plan.originId, '');
  assert.equal(e.region, '고성군');
  assert.deepEqual(
    e.plan.stops.map((s) => s.placeId),
    m.stops.map((s) => s.place.id),
  );
  const again = makeRecommendations(nodes, '고성군');
  assert.deepEqual(again[0], m);
});
test('matching live tourism information replaces base place without changing the route', () => {
  const m = makeRecommendations(nodes, '철원군')[0];
  const live = {
    ...m.stops[0].place,
    id: 'tourapi:verified',
    source: 'tourapi',
  };
  const replaced = makeRecommendations([...nodes, live], '철원군')[0];
  assert.equal(replaced.stops[0].place.id, live.id);
  assert.equal(replaced.sourceCount, 1);
  const manual = { ...live, id: 'manual:private', source: 'manual' };
  assert.ok(
    !makeRecommendations([...nodes, manual], '철원군')[0].stops.some(
      (s) => s.place.id === manual.id,
    ),
  );
});
