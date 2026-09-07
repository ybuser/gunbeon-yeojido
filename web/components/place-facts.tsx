import type { Place } from '@/lib/domain';
import conditions from '@/lib/data/verified-conditions.json';
const clean = (v: unknown) =>
  String(v || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim();
export function VerifiedFacts({ place }: { place: Place }) {
  const item = conditions.places.find(
    (x) =>
      x.place_id === place.id ||
      x.title === place.title ||
      (x.title === '고석정국민관광지' &&
        ['고석정', '고석정 관광지', '고석정국민관광지'].includes(place.title)),
  );
  if (!item) return null;
  const sources = Array.from(
    new Set(
      Object.values(item.fields)
        .filter((x) => x.status.startsWith('confirmed'))
        .map((x) => x.source_url),
    ),
  );
  return (
    <div className="verified-facts">
      <b>공식 운영정보 확인 · {conditions.verified_at}</b>
      <p>{item.ui_brief}</p>
      <span>당일 예외 운영은 별도 확인이 필요합니다.</span>
      <div>
        {sources.slice(0, 2).map((url, i) => (
          <a key={url} href={url} target="_blank" rel="noreferrer">
            공식 근거 {i + 1} ↗
          </a>
        ))}
      </div>
    </div>
  );
}
const labels: Record<string, string> = {
  overview: '장소 소개',
  infocenter: '문의',
  infocenterculture: '문의',
  infocenterfood: '문의',
  usetime: '이용 시간',
  usetimeculture: '이용 시간',
  opentimefood: '영업 시간',
  restdate: '쉬는 날',
  restdateculture: '쉬는 날',
  restdatefood: '쉬는 날',
  parking: '주차 안내',
  parkingculture: '주차 안내',
  parkingfood: '주차 안내',
  firstmenu: '대표 메뉴',
  treatmenu: '메뉴',
  reservationfood: '예약 안내',
  route: '접근 동선',
  publictransport: '대중교통',
  wheelchair: '휠체어',
  exit: '출입구',
  elevator: '엘리베이터',
  restroom: '화장실',
  stroller: '유모차',
  lactationroom: '수유실',
  room: '객실',
  blindhandicapetc: '시각 편의',
  handicapetc: '이동 편의 추가 안내',
};
export function ApiFacts({
  data,
  loading,
}: {
  data: unknown;
  loading: boolean;
}) {
  if (loading) return <p>관광·편의 정보를 확인하고 있어요.</p>;
  const response = data as {
    results?: {
      service: string;
      status: string;
      data: Record<string, unknown>[];
      error?: string;
    }[];
    error?: string;
  };
  if (!response?.results) return <p>상세 정보 연결을 다시 확인해 주세요.</p>;
  return (
    <div className="api-facts">
      {response.results.map((section) => {
        const row = section.data?.[0] || {};
        const fields = Object.entries(row).filter(
          ([k, v]) => labels[k] && Boolean(clean(v)),
        );
        return (
          <section key={section.service}>
            <h4>{section.service}</h4>
            {section.status === 'rejected' ? (
              <p>이 정보는 연결하지 못했습니다. 시설에 직접 확인해 주세요.</p>
            ) : !fields.length ? (
              <p>
                제공된 상세 항목이 없습니다. 편의시설이 없다는 의미는 아닙니다.
              </p>
            ) : (
              <dl>
                {fields.map(([k, v]) => (
                  <div key={k}>
                    <dt>{labels[k]}</dt>
                    <dd>{clean(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        );
      })}
      <p className="helper">
        출처: ⓒ한국관광공사 · 방금 조회한 응답. 현재 운영·빈자리·메뉴 적합성을
        보증하지 않습니다.
      </p>
    </div>
  );
}
