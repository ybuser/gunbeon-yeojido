import { env } from 'cloudflare:workers';
import { tourRequest, TourError } from '@/lib/tour-api';
import { publicDataKey } from '@/lib/api-config';
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams,
    id = p.get('id') || '',
    type = p.get('type') || '12';
  if (
    !/^\d{1,12}$/.test(id) ||
    !['12', '14', '15', '28', '32', '38', '39'].includes(type)
  )
    return Response.json({ error: 'INVALID_ID' }, { status: 400 });
  const key = publicDataKey(
    env as Record<string, unknown>,
    'TOUR_API_KOR_SERVICE_KEY',
  );
  try {
    const results = await Promise.allSettled([
      tourRequest('KorService2', 'detailCommon2', key, { contentId: id }),
      tourRequest('KorService2', 'detailIntro2', key, {
        contentId: id,
        contentTypeId: type,
      }),
      tourRequest(
        'KorWithService2',
        'detailWithTour2',
        publicDataKey(
          env as Record<string, unknown>,
          'TOUR_API_WITH_SERVICE_KEY',
        ) || key,
        { contentId: id },
      ),
    ]);
    return Response.json(
      {
        id,
        source: '출처: ⓒ한국관광공사',
        fetchedAt: new Date().toISOString(),
        results: results.map((x, i) => ({
          service: ['관광 상세', '운영·이용 정보', '무장애 정보'][i],
          status: x.status,
          data: x.status === 'fulfilled' ? x.value.items : [],
          error:
            x.status === 'rejected'
              ? x.reason instanceof TourError
                ? x.reason.code
                : 'UNKNOWN'
              : null,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json({ error: 'DETAIL_UNAVAILABLE' }, { status: 503 });
  }
}
