import { env } from 'cloudflare:workers';
import { publicDataKey } from '@/lib/api-config';
import { regions } from '@/lib/domain';
import { fetchAccessibility, TourError } from '@/lib/tour-api';
export async function GET(request: Request) {
  const region = new URL(request.url).searchParams.get('region') || '철원군';
  if (!regions.includes(region as (typeof regions)[number]))
    return Response.json({ error: 'INVALID_REGION' }, { status: 400 });
  try {
    const key =
      publicDataKey(
        env as Record<string, unknown>,
        'TOUR_API_WITH_SERVICE_KEY',
      ) ||
      publicDataKey(env as Record<string, unknown>, 'TOUR_API_KOR_SERVICE_KEY');
    return Response.json(await fetchAccessibility(key, region), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return Response.json(
      {
        mode: 'unavailable',
        items: [],
        error: e instanceof TourError ? e.code : 'UNKNOWN',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
