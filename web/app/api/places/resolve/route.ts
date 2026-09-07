import { env } from 'cloudflare:workers';
import { tourRequest, tourPlace } from '@/lib/tour-api';
import { publicDataKey } from '@/lib/api-config';
import { regions } from '@/lib/domain';
export async function POST(request: Request) {
  let value: { ids?: unknown };
  try {
    value = (await request.json()) as typeof value;
  } catch {
    return Response.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }
  if (
    !Array.isArray(value.ids) ||
    value.ids.length > 13 ||
    !value.ids.every(
      (id) => typeof id === 'string' && /^tourapi:\d{1,12}$/.test(id),
    )
  )
    return Response.json({ error: 'INVALID_IDS' }, { status: 400 });
  const key = publicDataKey(
    env as Record<string, unknown>,
    'TOUR_API_KOR_SERVICE_KEY',
  );
  const results = await Promise.all(
    [...new Set(value.ids as string[])].map(async (id) => {
      try {
        const result = await tourRequest('KorService2', 'detailCommon2', key, {
          contentId: id.split(':')[1],
        });
        const row = result.items[0];
        const region =
          row && regions.find((r) => String(row.addr1).includes(r));
        if (!row || !region || !String(row.addr1).includes('강원'))
          return { id, place: null };
        return { id, place: tourPlace(row, region) };
      } catch {
        return { id, place: null };
      }
    }),
  );
  return Response.json(
    {
      places: results.flatMap((x) => (x.place ? [x.place] : [])),
      missing: results.filter((x) => !x.place).map((x) => x.id),
      source: '출처: ⓒ한국관광공사',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
