import { env } from 'cloudflare:workers';
import { publicDataKey } from '@/lib/api-config';
import { fetchWeather, WeatherError, countyGrids } from '@/lib/weather';
export async function GET(request: Request) {
  const region = new URL(request.url).searchParams.get('region') || '철원군';
  if (!Object.hasOwn(countyGrids, region))
    return Response.json({ error: 'INVALID_REGION' }, { status: 400 });
  try {
    return Response.json(
      await fetchWeather(
        publicDataKey(env as Record<string, unknown>, 'KMA_SERVICE_KEY'),
        region,
      ),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return Response.json(
      {
        mode: 'unavailable',
        condition: 'unknown',
        error: e instanceof WeatherError ? e.code : 'UNKNOWN',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
