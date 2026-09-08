import type { Place } from './domain';
export type RecordRow = Record<string, string | number>;
export class TourError extends Error {
  constructor(
    public code: string,
    public details: unknown = undefined,
  ) {
    super(code);
  }
}
export const API_BASE = 'https://apis.data.go.kr/B551011/';
export async function tourRequest(
  service: string,
  method: string,
  key: string,
  params: Record<string, string> = {},
  fetcher: typeof fetch = fetch,
) {
  if (!key) throw new TourError('KEY_MISSING');
  const url = new URL(API_BASE + service + '/' + method);
  let decoded = key.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {}
  Object.entries({
    serviceKey: decoded,
    MobileOS: 'ETC',
    MobileApp: 'GunbeonGangwon',
    _type: 'json',
    numOfRows: '100',
    pageNo: '1',
    ...params,
  }).forEach(([k, v]) => url.searchParams.set(k, v));
  // Only a rate-limit code and retry timestamp are persisted, never tourism content.
  const limits =
    fetcher === fetch
      ? await import('./provider-limit').catch(() => null)
      : null;
  const limitId = limits
    ? await limits.providerLimitId(service, method, decoded)
    : '';
  const blocked = limits ? await limits.readProviderLimit(limitId) : null;
  if (blocked) throw new TourError(blocked.error, { retryAt: blocked.retryAt });
  let response: Response;
  try {
    response = await fetcher(url, {
      signal: AbortSignal.timeout(9000),
      cache: 'no-store',
    });
  } catch {
    throw new TourError('NETWORK_OR_TIMEOUT');
  }
  if (!response.ok) {
    let providerCode = '';
    try {
      const body = (await response.json()) as {
        OpenAPI_ServiceResponse?: {
          cmmMsgHeader?: { returnReasonCode?: string };
        };
      };
      providerCode = String(
        body.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnReasonCode || '',
      );
    } catch {}
    if (response.status === 429 || providerCode === '22') {
      const code =
        providerCode === '22' ? 'DAILY_QUOTA_EXCEEDED' : 'RATE_LIMITED';
      if (limits) await limits.saveProviderLimit(limitId, code);
      throw new TourError(code);
    }
    throw new TourError('HTTP_' + response.status);
  }
  let json;
  try {
    json = await response.json();
  } catch {
    throw new TourError('NON_JSON_RESPONSE');
  }
  const envelopeCode = String(
    (
      json as {
        OpenAPI_ServiceResponse?: {
          cmmMsgHeader?: { returnReasonCode?: string };
        };
      }
    )?.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnReasonCode || '',
  );
  if (envelopeCode === '22') {
    if (limits) await limits.saveProviderLimit(limitId, 'DAILY_QUOTA_EXCEEDED');
    throw new TourError('DAILY_QUOTA_EXCEEDED');
  }
  const r = (
    json as {
      response?: {
        header?: { resultCode?: string };
        body?: {
          items?: { item?: RecordRow[] | RecordRow };
          totalCount?: number;
        };
      };
    }
  )?.response;
  if (!r || !['0000', '00'].includes(String(r.header?.resultCode)))
    throw new TourError(
      'PROVIDER_' +
        String(r?.header?.resultCode || 'UNKNOWN').replace(
          /[^a-zA-Z0-9_]/g,
          '',
        ),
    );
  const rows = r.body?.items?.item;
  return {
    items: (Array.isArray(rows) ? rows : rows ? [rows] : []) as RecordRow[],
    total: Number(r.body?.totalCount || 0),
  };
}
const text = (v: unknown) =>
  String(v || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
export function tourPlace(row: RecordRow, region: string): Place {
  const lat = Number(row.mapy),
    lon = Number(row.mapx);
  const types: Record<string, string> = {
    '12': 'attraction',
    '14': 'culture',
    '15': 'festival',
    '28': 'leisure',
    '32': 'accommodation',
    '38': 'shopping',
    '39': 'restaurant',
  };
  return {
    id: 'tourapi:' + row.contentid,
    source: 'tourapi',
    source_id: String(row.contentid),
    source_url: 'https://www.data.go.kr/data/15101578/openapi.do',
    title: text(row.title),
    address: text(row.addr1) + ' ' + text(row.addr2),
    lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
    lon: Number.isFinite(lon) && lon !== 0 ? lon : null,
    sigungu: region,
    chapter: ['춘천시', '속초시'].includes(region)
      ? region.replace(/시$/, '') + ' 관문'
      : region.replace(/군$/, '') + '장',
    category: types[String(row.contenttypeid)] || 'attraction',
    content_type_id: String(row.contenttypeid),
    theme_tags: [],
    military_context_tags: [],
    family_tags: [],
    access_tags: [],
    reward_tags: [],
    reservation_required: null,
    id_check_required: null,
    opening_status: 'unknown',
    image_url: row.firstimage
      ? String(row.firstimage).replace(/^http:/, 'https:')
      : null,
    overview: text(row.overview),
    data_quality_flags: [
      'operations_unverified',
      'reservation_unknown',
      'id_check_unknown',
      'walking_estimated',
    ],
    last_verified_at: null,
    ingested_at: new Date().toISOString(),
    telephone: text(row.tel),
  };
}
export async function discoverDistrict(
  key: string,
  region: string,
  fetcher: typeof fetch = fetch,
  service = 'KorService2',
) {
  const areas = await tourRequest(
    service,
    'ldongCode2',
    key,
    { lDongListYn: 'N' },
    fetcher,
  );
  const gangwon = areas.items.find((x) => String(x.name).includes('강원'));
  if (!gangwon) throw new TourError('GANGWON_NOT_FOUND');
  const districts = await tourRequest(
    service,
    'ldongCode2',
    key,
    { lDongRegnCd: String(gangwon.code), lDongListYn: 'N' },
    fetcher,
  );
  const district = districts.items.find((x) => String(x.name) === region);
  if (!district) throw new TourError('DISTRICT_NOT_FOUND');
  return {
    lDongRegnCd: String(gangwon.code),
    lDongSignguCd: String(district.code),
  };
}
export async function fetchRegion(
  key: string,
  region: string,
  fetcher: typeof fetch = fetch,
) {
  const codes = await discoverDistrict(key, region, fetcher);
  const requestCategory = async (contentTypeId: string) => {
    try {
      const r = await tourRequest(
        'KorService2',
        'areaBasedList2',
        key,
        { ...codes, contentTypeId, arrange: 'C', numOfRows: '100' },
        fetcher,
      );
      return { contentTypeId, ...r, error: null as string | null };
    } catch (e) {
      return {
        contentTypeId,
        items: [] as RecordRow[],
        total: 0,
        error: e instanceof TourError ? e.code : 'UNKNOWN',
      };
    }
  };
  // Probe one category before fan-out so a known daily quota does not spend five requests.
  const first = await requestCategory('12');
  const rest = ['14', '15', '32', '39'];
  const results = [
    first,
    ...(first.error === 'DAILY_QUOTA_EXCEEDED' || first.error === 'RATE_LIMITED'
      ? rest.map((contentTypeId) => ({
          contentTypeId,
          items: [] as RecordRow[],
          total: 0,
          error: first.error,
        }))
      : await Promise.all(rest.map(requestCategory))),
  ];
  if (results.every((x) => x.error))
    throw new TourError(
      results.some((x) => x.error === 'DAILY_QUOTA_EXCEEDED')
        ? 'DAILY_QUOTA_EXCEEDED'
        : results.some((x) => x.error === 'RATE_LIMITED')
          ? 'RATE_LIMITED'
          : 'ALL_CATEGORIES_FAILED',
      results.map(({ contentTypeId, error }) => ({ contentTypeId, error })),
    );
  return {
    ...codes,
    places: results.flatMap((x) =>
      x.items.map((row) => tourPlace(row, region)),
    ),
    categories: results.map(({ contentTypeId, total, error, items }) => ({
      contentTypeId,
      total,
      error,
      fetched: items.length,
    })),
    fetchedAt: new Date().toISOString(),
    mode: 'live',
    source: '출처: ⓒ한국관광공사',
    pagination: '유형별 첫 100개; 전체 수집은 검증 스크립트에서 실행',
  };
}

export async function fetchAccessibility(
  key: string,
  region: string,
  fetcher: typeof fetch = fetch,
) {
  const codes = await discoverDistrict(key, region, fetcher, 'KorWithService2');
  const listing = await tourRequest(
    'KorWithService2',
    'areaBasedList2',
    key,
    { ...codes, arrange: 'C' },
    fetcher,
  );
  // Inspect selected public tourism candidates, preserving unknown fields instead of guessing accessibility.
  const candidates = listing.items
    .filter((x) => ['12', '14'].includes(String(x.contenttypeid)))
    .slice(0, 4);
  const items = await Promise.all(
    candidates.map(async (row) => {
      const place = tourPlace(row, region);
      place.source_url = 'https://www.data.go.kr/data/15101897/openapi.do';
      try {
        const detail = await tourRequest(
          'KorWithService2',
          'detailWithTour2',
          key,
          { contentId: String(row.contentid) },
          fetcher,
        );
        return {
          place,
          results: [
            { service: '무장애 정보', status: 'fulfilled', data: detail.items },
          ],
        };
      } catch (e) {
        return {
          place,
          results: [
            {
              service: '무장애 정보',
              status: 'rejected',
              data: [],
              error: e instanceof TourError ? e.code : 'UNKNOWN',
            },
          ],
        };
      }
    }),
  );
  return {
    mode: 'live',
    ...codes,
    total: listing.total,
    fetched: listing.items.length,
    items,
    fetchedAt: new Date().toISOString(),
    source: '출처: ⓒ한국관광공사',
  };
}
