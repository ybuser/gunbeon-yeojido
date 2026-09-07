export type ForecastRow = {
  category: string;
  fcstDate: string;
  fcstTime: string;
  fcstValue: string | number | null;
};
export const countyGrids: Record<string, [number, number]> = {
  철원군: [65, 139],
  화천군: [72, 139],
  양구군: [77, 139],
  인제군: [80, 138],
  고성군: [85, 145],
  춘천시: [73, 134],
  속초시: [87, 141],
};
export class WeatherError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
/** 2026-07 guide: short forecast is published at HH:00, available after HH:10 KST. */
export function weatherBase(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600000 - 11 * 60000);
  const hour = kst.getUTCHours();
  let base = [2, 5, 8, 11, 14, 17, 20, 23].filter((h) => h <= hour).at(-1);
  if (base === undefined) {
    kst.setUTCDate(kst.getUTCDate() - 1);
    base = 23;
  }
  return {
    base_date: kst.toISOString().slice(0, 10).replaceAll('-', ''),
    base_time: String(base).padStart(2, '0') + '00',
  };
}
export function summarizeWeather(rows: ForecastRow[], now = new Date()) {
  const slots = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const v = Number(row.fcstValue);
    if (
      row.fcstValue == null ||
      String(row.fcstValue).trim() === '' ||
      !Number.isFinite(v) ||
      Math.abs(v) >= 900
    )
      continue;
    const time = `${row.fcstDate.slice(0, 4)}-${row.fcstDate.slice(4, 6)}-${row.fcstDate.slice(6)}T${row.fcstTime.slice(0, 2)}:${row.fcstTime.slice(2)}:00+09:00`;
    const ms = Date.parse(time);
    if (
      !Number.isFinite(ms) ||
      ms <= now.getTime() ||
      ms > now.getTime() + 8 * 3600000
    )
      continue;
    const slot = slots.get(time) || {};
    slot[row.category] = v;
    slots.set(time, slot);
  }
  const hours = [...slots]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, values]) => ({ time, ...values }));
  const expectedTimes = Array.from(
    { length: 8 },
    (_, i) => (Math.floor(now.getTime() / 3600000) + i + 1) * 3600000,
  );
  const missingTimes = expectedTimes
    .filter((time) => {
      const slot = [...slots].find(([t]) => Date.parse(t) === time)?.[1];
      return (
        !slot || !['POP', 'PTY', 'WSD'].every((k) => slot[k] !== undefined)
      );
    })
    .map((time) => new Date(time).toISOString());
  const coverageComplete = missingTimes.length === 0;
  const samples = [...slots.values()];
  const maximum = (field: string) => {
    const values = samples.map((x) => x[field]).filter((x) => x !== undefined);
    return values.length ? Math.max(...values) : null;
  };
  const pop = maximum('POP'),
    wind = maximum('WSD'),
    pty = maximum('PTY');
  // This is an app planning threshold, never a KMA warning or guarantee.
  const snow = samples.some((x) => x.PTY === 2 || x.PTY === 3);
  const condition = snow
    ? 'snow'
    : wind !== null && wind >= 8
      ? 'wind'
      : (pty !== null && pty > 0) || (pop !== null && pop >= 60)
        ? 'rain'
        : coverageComplete
          ? 'clear'
          : 'unknown';
  return {
    hours,
    coverageComplete,
    missingTimes,
    condition,
    maxRainProbability: pop,
    maxWindSpeed: wind,
    precipitationType: pty,
  };
}
export async function fetchWeather(
  key: string,
  region: string,
  now = new Date(),
  fetcher: typeof fetch = fetch,
) {
  if (!key) throw new WeatherError('KEY_MISSING');
  const grid = countyGrids[region];
  if (!grid) throw new WeatherError('INVALID_REGION');
  const base = weatherBase(now);
  let decoded = key.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {}
  const url = new URL(
    'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst',
  );
  Object.entries({
    serviceKey: decoded,
    pageNo: '1',
    numOfRows: '1000',
    dataType: 'JSON',
    ...base,
    nx: String(grid[0]),
    ny: String(grid[1]),
  }).forEach(([k, v]) => url.searchParams.set(k, v));
  let response: Response;
  try {
    response = await fetcher(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new WeatherError('NETWORK_OR_TIMEOUT');
  }
  if (!response.ok) throw new WeatherError('HTTP_' + response.status);
  let json;
  try {
    json = await response.json();
  } catch {
    throw new WeatherError('NON_JSON_RESPONSE');
  }
  const r = (
    json as {
      response?: {
        header?: { resultCode?: string };
        body?: { items?: { item?: ForecastRow[] } };
      };
    }
  ).response;
  if (!['00', '0'].includes(String(r?.header?.resultCode)))
    throw new WeatherError(
      'PROVIDER_' +
        String(r?.header?.resultCode || 'UNKNOWN').replace(
          /[^a-zA-Z0-9_]/g,
          '',
        ),
    );
  const summary = summarizeWeather(r?.body?.items?.item || [], now);
  if (!summary.hours.length) throw new WeatherError('FORECAST_MISSING');
  return {
    mode: 'live',
    region,
    ...base,
    ...summary,
    fetchedAt: now.toISOString(),
    scope: '시군청 대표 격자 · 향후 8시간',
    source: '출처: 기상청',
  };
}
