export type Place = {
  id: string;
  source: string;
  source_id: string;
  source_url?: string;
  title: string;
  address: string;
  lat: number | null;
  lon: number | null;
  sigungu: string;
  chapter: string;
  category: string;
  theme_tags: string[];
  military_context_tags: string[];
  family_tags: string[];
  access_tags: string[];
  reward_tags: string[];
  reservation_required: boolean | null;
  id_check_required: boolean | null;
  opening_status: string;
  image_url: string | null;
  overview: string;
  data_quality_flags: string[];
  last_verified_at: string | null;
  telephone?: string | null;
  ingested_at?: string;
  source_version?: string;
  content_type_id?: string;
  accessibility?: Record<string, string>;
};
export const regions = [
  '철원군',
  '화천군',
  '양구군',
  '인제군',
  '고성군',
  '춘천시',
  '속초시',
] as const;
export const chapters = [
  '철원장',
  '화천장',
  '양구장',
  '인제장',
  '고성장',
  '춘천 관문',
  '속초 관문',
];
export const chapterStories = [
  '백마고지와 철원평야',
  '백암산과 비목',
  '두타연과 피의능선',
  '대곡리초소와 백두대간',
  '통일전망대와 해안 평화관광',
];
export type Settings = {
  role: string;
  situation: string;
  region: string;
  companion: string;
  duration: number;
  transport: 'car' | 'transit' | 'taxi' | 'unknown';
  returnAt: string;
  startedAt: string;
  originId: string;
  theme: string;
  walkLimit: number;
  weather: 'unknown' | 'clear' | 'rain' | 'wind' | 'snow';
  meal: string;
  extraBuffer: number;
};
export type Stop = {
  place: Place;
  stay: number;
  walk: number;
  walkVerified: false;
};
export type Mission = {
  id: string;
  title: string;
  brief: string;
  region: string;
  stops: Stop[];
  variant: string;
};
export type Assessment = {
  margin: number | null;
  available: number;
  total: number;
  band: 'safe' | 'caution' | 'avoid' | 'unknown';
  costs: Record<string, number>;
  km: number;
  issues: string[];
  walk: number;
  conditionsConfirmed: boolean;
};
export const validCoord = (p: Place) =>
  typeof p.lat === 'number' &&
  typeof p.lon === 'number' &&
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lon) &&
  p.lat > 33 &&
  p.lat < 39.5 &&
  p.lon > 124 &&
  p.lon < 132;
export function distance(a: Place, b: Place) {
  if (!validCoord(a) || !validCoord(b)) return NaN;
  const r = Math.PI / 180;
  const x = (b.lat! - a.lat!) * r;
  const y = (b.lon! - a.lon!) * r;
  const h =
    Math.sin(x / 2) ** 2 +
    Math.cos(a.lat! * r) * Math.cos(b.lat! * r) * Math.sin(y / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export function defaultSettings(now = new Date()): Settings {
  return {
    role: '현역 장병',
    situation: '외출',
    region: '철원군',
    companion: '부모님',
    duration: 240,
    transport: 'car',
    returnAt: new Date(now.getTime() + 240 * 60000).toISOString(),
    startedAt: now.toISOString(),
    originId: '',
    theme: '가족',
    walkLimit: 30,
    weather: 'unknown',
    meal: '한식',
    extraBuffer: 15,
  };
}
export function localInputDate(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(d)
    .replace(' ', 'T');
}
export function parseKoreaInput(value: string) {
  const d = new Date(value + ':00+09:00');
  return Number.isFinite(d.getTime()) ? d.toISOString() : '';
}
export function dedupePlaces(nodes: Place[]) {
  const seen = new Set<string>();
  return nodes.filter((p) => {
    const k = p.title.replace(/\s|\([^)]*\)/g, '').toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
const anchors: Record<string, string> = {
  철원군: '고석정국민관광지',
  화천군: '붕어섬',
  양구군: '양구근현대사박물관',
  인제군: '만해마을',
  고성군: '고성 왕곡마을',
};
export function regionPlaces(nodes: Place[], region: string) {
  return dedupePlaces(
    [...nodes]
      .filter((p) => p.sigungu === region && validCoord(p))
      .sort(
        (a, b) =>
          (b.source === 'tourapi' ? 1 : 0) - (a.source === 'tourapi' ? 1 : 0),
      ),
  );
}
export function chooseOrigin(nodes: Place[], settings: Settings) {
  const local = regionPlaces(nodes, settings.region);
  const anchor = anchors[settings.region] || '';
  const stem = anchor.replace('국민관광지', '');
  return (
    local.find((p) => p.id === settings.originId) ||
    local.find(
      (p) => p.source === 'tourapi' && stem && p.title.includes(stem),
    ) ||
    local.find((p) => p.title === anchor) ||
    local.find(
      (p) => p.category === 'attraction' || p.category === 'culture',
    ) ||
    local[0]
  );
}
export function makeMissions(nodes: Place[], s: Settings): Mission[] {
  const origin = chooseOrigin(nodes, s);
  if (!origin) return [];
  const list = regionPlaces(nodes, s.region).sort(
    (a, b) => distance(origin, a) - distance(origin, b),
  );
  const near = list.filter((p) => distance(origin, p) < 25);
  const cafes = near.filter(
    (p) => p.category === 'cafe' || p.category === 'restaurant',
  );
  const attractions = near
    .filter(
      (p) =>
        ![
          'cafe',
          'restaurant',
          'accommodation',
          'festival',
          'memorial',
        ].includes(p.category) && p.id !== origin.id,
    )
    .sort(
      (a, b) =>
        (b.source === 'tourapi' ? 1 : 0) - (a.source === 'tourapi' ? 1 : 0),
    );
  const memories = near.filter(
    (p) =>
      p.category === 'memorial' &&
      p.access_tags.includes('public_access_verified'),
  );
  const indoor = near.filter((p) =>
    /박물관|문학관|문화관|미술관/.test(p.title),
  );
  const companion = s.companion === '혼자' ? 0 : 5;
  const stop = (place: Place, short = false): Stop => ({
    place,
    stay:
      place.category === 'cafe' || place.category === 'restaurant'
        ? 40
        : short
          ? 30
          : 55,
    walk:
      /박물관|문학관|카페/.test(place.title) || place.category === 'cafe'
        ? 5
        : short
          ? 10
          : 20,
    walkVerified: false,
  });
  const picks = [
    {
      variant: '가족',
      name: '경계가 풍경이 되는 하루',
      brief: '풍경 한 곳, 쉬어가는 자리 한 곳. 함께 걷는 속도에 맞춘 미션.',
      places: [
        origin,
        cafes[0],
        attractions.find((p) => distance(origin, p) > 1),
      ],
    },
    {
      variant: '회복',
      name: '복귀 전, 잠시 숨 고르기',
      brief: '장소를 줄이고 쉬는 시간을 남긴 짧은 미션.',
      places: [origin, cafes[0] || attractions[0]],
    },
    {
      variant: '평화',
      name: '기억을 따라 걷는 오후',
      brief: '지역의 기억과 오늘의 일상을 잇는 호국·평화 미션.',
      places: [
        memories[0] || attractions[1] || origin,
        cafes[0],
        indoor[0] || origin,
      ],
    },
    {
      variant: '실내',
      name: '비가 오면 검토할 실내 후보',
      brief:
        '명칭과 분류로 고른 실내 후보 초안. 실내 공간·운영 여부 모두 확인 필요합니다.',
      places: [indoor[0], cafes[0] || cafes[1]],
    },
  ];
  return picks
    .map((x) => ({
      ...x,
      places: dedupePlaces(x.places.filter(Boolean) as Place[]),
    }))
    .filter((x) => x.places.length >= 2)
    .map((x) => ({
      id: s.region + '-' + x.variant,
      title: s.region.replace(/[군시]$/, '') + '장: ' + x.name,
      brief: x.brief,
      region: s.region,
      variant: x.variant,
      stops: x.places.slice(0, s.duration <= 120 ? 2 : 3).map((p) => {
        const a = stop(p, x.variant === '회복');
        return { ...a, stay: a.stay + companion };
      }),
    }))
    .sort(
      (a, b) =>
        (b.variant === (['호국', '보상'].includes(s.theme) ? '평화' : s.theme)
          ? 1
          : 0) -
        (a.variant === (['호국', '보상'].includes(s.theme) ? '평화' : s.theme)
          ? 1
          : 0),
    );
}
export function assess(
  m: Mission,
  s: Settings,
  origin: Place,
  now = new Date(),
): Assessment {
  const end = Date.parse(s.returnAt),
    start = Date.parse(s.startedAt),
    t = now.getTime();
  const available = Math.floor((end - t) / 60000);
  const invalid =
    !Number.isFinite(available) ||
    !Number.isFinite(s.duration) ||
    s.duration <= 0 ||
    !Number.isFinite(s.extraBuffer) ||
    s.extraBuffer < 0;
  const points = [origin, ...m.stops.map((x) => x.place), origin];
  let km = 0;
  for (let i = 1; i < points.length; i++)
    km += distance(points[i - 1], points[i]);
  const speed = s.transport === 'car' ? 35 : s.transport === 'taxi' ? 30 : 20;
  const roadKm = km * 1.6;
  const travel = Math.ceil((roadKm / speed) * 60);
  const movingLegs = points
    .slice(1)
    .filter((p, i) => distance(points[i], p) > 0.01).length;
  const wait =
    s.transport === 'transit'
      ? 30 * movingLegs
      : s.transport === 'taxi'
        ? 20 * movingLegs
        : s.transport === 'unknown'
          ? 30 * movingLegs
          : 8 * m.stops.length;
  const costs = {
    '장소 체류': m.stops.reduce((sum, x) => sum + x.stay, 0),
    '구간·거점 이동 추정': travel,
    '교통 대기 추정': wait,
    '혼잡 여유(추정)': Math.ceil(travel * 0.2),
    '날씨 여유(시나리오)':
      s.weather === 'snow'
        ? 45
        : s.weather === 'rain'
          ? 25
          : s.weather === 'wind'
            ? 35
            : s.weather === 'unknown'
              ? 15
              : 0,
    '동행 여유': /부모|가족/.test(s.companion) ? 20 : 10,
    '추가 안전 버퍼': Math.ceil(s.extraBuffer),
    '숙박·휴식 확보': s.duration > 600 ? 600 : 0,
  };
  const total = Object.values(costs).reduce((a, b) => a + b, 0);
  const margin = invalid || !Number.isFinite(total) ? null : available - total;
  const walk = m.stops.reduce((a, b) => a + b.walk, 0);
  const issues: string[] = [];
  if (m.variant === '실내')
    issues.push('실내 여부는 장소명·분류 기반 후보이며 미검증');
  if (s.duration > 600) issues.push('숙소·야간 운영·다음 날 일정 미확인');
  if (s.transport !== 'car') issues.push('시간표·환승·막차 미검증');
  if (s.weather === 'unknown') issues.push('실제 날씨 확인 필요');
  else issues.push('선택한 날씨 조건의 추정 버퍼 적용 · 현지 기상은 별도 확인');
  if (s.weather === 'snow')
    issues.push('눈·비눈 예보: 결빙·도로 통제 확인 필요');
  if (walk > s.walkLimit) issues.push('선택한 도보 상한 초과');
  issues.push('도보 시간은 장소 유형에 따른 추정');
  if (m.stops.some((x) => x.place.opening_status === 'unknown'))
    issues.push('운영 여부 확인 필요');
  if (
    m.stops.some(
      (x) =>
        x.place.reservation_required === null ||
        x.place.id_check_required === null,
    )
  )
    issues.push('예약·신분확인 조건 미확인');
  if (m.stops.some((x) => x.place.reservation_required))
    issues.push('예약 필요');
  if (m.stops.some((x) => x.place.id_check_required))
    issues.push('신분증 필요');
  const closed = m.stops.some((x) => x.place.opening_status === 'closed');
  if (closed) issues.push('운영 중단 장소 포함');
  const band =
    margin === null
      ? 'unknown'
      : margin < 15 ||
          closed ||
          walk > s.walkLimit ||
          (['wind', 'snow'].includes(s.weather) && m.variant !== '실내')
        ? 'avoid'
        : margin < 45 || s.transport !== 'car'
          ? 'caution'
          : 'safe';
  return {
    margin,
    available,
    total,
    band,
    costs,
    km: Math.round(roadKm * 10) / 10,
    issues,
    walk,
    conditionsConfirmed: !m.stops.some(
      (x) =>
        x.place.opening_status === 'unknown' ||
        x.place.reservation_required === null ||
        x.place.id_check_required === null,
    ),
  };
}
export type Scopes = {
  passport: boolean;
  schedule: boolean;
  meal: boolean;
  propose: boolean;
  stamp: boolean;
};
export const scopeLabels: Record<keyof Scopes, string> = {
  passport: '패스포트 보기',
  schedule: '미션 범위 보기',
  meal: '선호 식사 보기',
  propose: '미션 제안 가능',
  stamp: '동행 스탬프 가능',
};
export type Entry = {
  missionId: string;
  title: string;
  region: string;
  stamps: string[];
};
export type Family = { code: string; expiresAt: number; scopes: Scopes };
export function publicCard(entry: Entry) {
  return {
    region: regions.includes(entry.region as (typeof regions)[number])
      ? entry.region
      : '강원특별자치도',
    mission: entry.title,
    stamps: entry.stamps.filter((x) =>
      ['입경', '전환', '복귀', '동행', '휴가 씨앗'].includes(x),
    ),
    message: '복무 경험을 관광 경험으로. 군번여지도 강원',
  };
}
export function familyProjection(
  family: Family | null,
  code: string,
  entries: Entry[],
  mission: Mission | null,
  meal: string,
  now = Date.now(),
) {
  if (!family || family.code !== code || family.expiresAt < now) return null;
  return {
    scopes: family.scopes,
    passport: family.scopes.passport ? entries.map(publicCard) : [],
    mission:
      family.scopes.schedule && mission
        ? { id: mission.id, title: mission.title, region: mission.region }
        : null,
    meal: family.scopes.meal ? meal : null,
  };
}
export function createCode() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (x) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x % 32],
  ).join('');
}
export const kakaoLink = (p: Place) =>
  'https://map.kakao.com/link/to/' +
  encodeURIComponent(p.title) +
  ',' +
  p.lat +
  ',' +
  p.lon;
