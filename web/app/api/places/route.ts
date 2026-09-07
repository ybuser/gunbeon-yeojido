import { env } from 'cloudflare:workers';
import { fetchRegion, TourError } from '@/lib/tour-api';
import { regions } from '@/lib/domain';
import { publicDataKey } from '@/lib/api-config';
export async function GET(request: Request) {
  const region = new URL(request.url).searchParams.get('region') || '철원군';
  if (!regions.includes(region as (typeof regions)[number]))
    return Response.json({ error: 'INVALID_REGION' }, { status: 400 });
  try {
    return Response.json(
      await fetchRegion(
        publicDataKey(
          env as Record<string, unknown>,
          'TOUR_API_KOR_SERVICE_KEY',
        ),
        region,
      ),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return Response.json(
      {
        mode: 'unavailable',
        error: e instanceof TourError ? e.code : 'UNKNOWN',
        places: [],
        message:
          '한국관광공사 실시간 데이터를 연결하지 못했습니다. 아래 장소는 별도 공개 원천 자료입니다.',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
