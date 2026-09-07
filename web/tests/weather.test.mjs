import test from 'node:test';
import assert from 'node:assert/strict';
import { weatherBase, summarizeWeather, fetchWeather } from '../lib/weather.ts';
import { publicDataKey } from '../lib/api-config.ts';
test('shared account key and per-service override do not require six copies', () => {
  const env = { DATA_GO_KR_SERVICE_KEY: 'common', KMA_SERVICE_KEY: 'weather' };
  assert.equal(publicDataKey(env, 'TOUR_API_KOR_SERVICE_KEY'), 'common');
  assert.equal(publicDataKey(env, 'KMA_SERVICE_KEY'), 'weather');
});
test('KST publication boundary selects previous issued cycle until available', () => {
  assert.deepEqual(weatherBase(new Date('2026-09-07T14:09:00+09:00')), {
    base_date: '20260907',
    base_time: '1100',
  });
  assert.deepEqual(weatherBase(new Date('2026-09-07T14:11:00+09:00')), {
    base_date: '20260907',
    base_time: '1400',
  });
  assert.deepEqual(weatherBase(new Date('2026-09-07T01:00:00+09:00')), {
    base_date: '20260906',
    base_time: '2300',
  });
});
test('missing forecast is unknown; rainy next eight hours add planning caution', () => {
  const now = new Date('2026-09-07T14:11:00+09:00');
  const row = (category, fcstValue) => ({
    category,
    fcstValue,
    fcstDate: '20260907',
    fcstTime: '1500',
  });
  assert.equal(summarizeWeather([], now).condition, 'unknown');
  assert.equal(
    summarizeWeather(
      [row('POP', null), row('PTY', null), row('WSD', null)],
      now,
    ).condition,
    'unknown',
  );
  assert.equal(
    summarizeWeather([row('POP', 0), row('PTY', 0), row('WSD', 2)], now)
      .condition,
    'unknown',
  );
  assert.equal(summarizeWeather([row('PTY', 3)], now).condition, 'snow');
  assert.equal(
    summarizeWeather(
      [row('POP', '-999'), row('PTY', ''), row('WSD', '999')],
      now,
    ).condition,
    'unknown',
  );
  const wet = summarizeWeather(
    [row('POP', '70'), row('PTY', '1'), row('WSD', '3')],
    now,
  );
  assert.equal(wet.condition, 'rain');
  assert.equal(wet.maxRainProbability, 70);
  assert.equal(summarizeWeather([row('WSD', '8')], now).condition, 'wind');
});
test('weather provider errors are never converted to clear conditions', async () => {
  await assert.rejects(() => fetchWeather('', '철원군'), /KEY_MISSING/);
  await assert.rejects(
    () =>
      fetchWeather(
        'test',
        '철원군',
        new Date(),
        async () =>
          new Response(
            JSON.stringify({ response: { header: { resultCode: '03' } } }),
          ),
      ),
    /PROVIDER_03/,
  );
});
