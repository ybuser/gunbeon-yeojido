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
        categories:
          e instanceof TourError && Array.isArray(e.details) ? e.details : [],
        places: [],
        message:
          e instanceof TourError && e.code === 'DAILY_QUOTA_EXCEEDED'
            ? '국문 관광정보의 일일 요청 한도를 모두 사용했습니다. 잠시 중복 재시도를 멈춥니다. 한도 초기화 또는 증설 반영 후 다시 확인할 수 있습니다.'
            : e instanceof TourError && e.code === 'RATE_LIMITED'
              ? '관광정보 요청이 잠시 몰렸습니다. 잠시 뒤 다시 조회해 주세요. 일일 한도 초과와는 다른 상태입니다.'
              : '한국관광공사 실시간 데이터를 연결하지 못했습니다. 아래 장소는 별도 공개 원천 자료입니다.',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
