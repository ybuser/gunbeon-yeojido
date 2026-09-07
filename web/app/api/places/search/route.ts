import { env } from 'cloudflare:workers';
import {
  discoverDistrict,
  tourRequest,
  tourPlace,
  TourError,
} from '@/lib/tour-api';
import { publicDataKey } from '@/lib/api-config';
import { regions, sensitivePlaceText } from '@/lib/domain';
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const region = params.get('region') || '',
    q = (params.get('q') || '').trim(),
    page = Math.max(1, Math.min(10, Number(params.get('page')) || 1));
  if (
    !regions.includes(region as (typeof regions)[number]) ||
    q.length < 2 ||
    q.length > 50 ||
    sensitivePlaceText(q)
  )
    return Response.json(
      { message: '강원 공개 관광장소 이름을 2자 이상 입력해 주세요.' },
      { status: 400 },
    );
  const key = publicDataKey(
    env as Record<string, unknown>,
    'TOUR_API_KOR_SERVICE_KEY',
  );
  try {
    const codes = await discoverDistrict(key, region);
    const result = await tourRequest('KorService2', 'searchKeyword2', key, {
      ...codes,
      keyword: q,
      numOfRows: '20',
      pageNo: String(page),
      arrange: 'A',
    });
    return Response.json(
      {
        places: result.items.map((row) => tourPlace(row, region)),
        total: result.total,
        page,
        mode: 'live',
        source: '출처: ⓒ한국관광공사',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return Response.json(
      {
        places: [],
        message:
          '관광정보 검색을 연결하지 못했습니다. 잠시 후 다시 검색하거나 직접 장소를 추가해 주세요.',
        error: e instanceof TourError ? e.code : 'UNAVAILABLE',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
