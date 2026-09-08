import verifiedConditions from './data/verified-conditions.json' with { type: 'json' };
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
  weatherForecast?: {
    region: string;
    fetchedAt: string;
    validUntil: string;
    baseDate: string;
    baseTime: string;
  };
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
  custom?: boolean;
  departureAt?: string;
  transport?: Settings['transport'];
  timeBudgetMinutes?: number;
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
  춘천시: '국립춘천박물관',
  속초시: '속초관광수산시장',
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
    nodes.find((p) => p.id === settings.originId && validCoord(p)) ||
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
  const list = regionPlaces(nodes, s.region)
    .filter((p) => p.source !== 'manual')
    .sort((a, b) => distance(origin, a) - distance(origin, b));
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
        ].includes(p.category) &&
        p.id !== origin.id &&
        !/도서관|관광정보센터|관광안내소/.test(p.title),
    )
    .sort(
      (a, b) =>
        (b.source === 'tourapi' ? 1 : 0) - (a.source === 'tourapi' ? 1 : 0),
    );
  const peace = near.filter(
    (p) =>
      (p.category === 'memorial' &&
        p.access_tags?.includes('public_access_verified')) ||
      (['attraction', 'culture'].includes(p.category) &&
        /평화|통일|DMZ|디엠지|전적|호국|비목|백마고지/.test(p.title)),
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
      variant: peace.length ? '평화' : '탐방',
      name: peace.length
        ? '기억을 따라 걷는 오후'
        : '지역의 이야기를 만나는 하루',
      brief: peace.length
        ? '평화·호국 장소 한 곳과 쉬어갈 곳을 연결했습니다. 방문 조건을 먼저 확인하세요.'
        : '가까운 문화·관광 장소와 쉬어갈 곳을 연결한 지역 탐방입니다.',
      places: [
        peace[0] || indoor[0] || attractions[0] || origin,
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
      title:
        (chapters[regions.indexOf(s.region as (typeof regions)[number])] ||
          s.region) +
        ': ' +
        x.name,
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
export function routeSchedule(
  m: Mission,
  s: Settings,
  origin: Place,
  now = new Date(),
  returnPoint = origin,
) {
  const planned = m.departureAt ? Date.parse(m.departureAt) : now.getTime();
  const start = Number.isFinite(planned)
    ? Math.max(planned, now.getTime())
    : now.getTime();
  const transport = m.transport || s.transport;
  const speed = transport === 'car' ? 35 : transport === 'taxi' ? 30 : 20;
  const points = [origin, ...m.stops.map((x) => x.place), returnPoint];
  let cursor = start,
    travel = 0,
    wait = 0;
  const legs = points.slice(1).map((p, i) => {
    const km = distance(points[i], p);
    const moving = km > 0.01;
    const minutes = Math.ceil(((km * 1.6) / speed) * 60);
    const waiting =
      transport === 'car'
        ? i < m.stops.length
          ? 8
          : 0
        : moving
          ? transport === 'taxi'
            ? 20
            : 30
          : 0;
    travel += minutes;
    wait += waiting;
    cursor += (minutes + waiting) * 60000;
    const arrival = cursor;
    if (i < m.stops.length) cursor += m.stops[i].stay * 60000;
    return {
      place: p,
      travel: minutes,
      wait: waiting,
      arrival,
      departure: cursor,
    };
  });
  return {
    start,
    shifted: Boolean(m.departureAt && planned < now.getTime()),
    beforeStart: Math.max(0, Math.ceil((start - now.getTime()) / 60000)),
    travel,
    wait,
    legs,
    returnedAt: cursor,
  };
}
export function assess(
  m: Mission,
  s: Settings,
  origin: Place,
  now = new Date(),
  observedNow = now,
  returnPoint = origin,
): Assessment {
  const end = Date.parse(s.returnAt),
    t = now.getTime();
  const weather = effectiveWeather(s, observedNow);
  const available = Math.floor((end - t) / 60000);
  const invalid =
    !Number.isFinite(available) ||
    !Number.isFinite(s.duration) ||
    s.duration <= 0 ||
    !Number.isFinite(s.extraBuffer) ||
    s.extraBuffer < 0;
  const points = [origin, ...m.stops.map((x) => x.place), returnPoint];
  let km = 0;
  for (let i = 1; i < points.length; i++)
    km += distance(points[i - 1], points[i]);
  const transport = m.transport || s.transport;
  const schedule = routeSchedule(m, s, origin, now, returnPoint);
  const roadKm = km * 1.6;
  const travel = schedule.travel,
    wait = schedule.wait;
  const costs = {
    '출발 전 대기': schedule.beforeStart,
    '장소 체류': m.stops.reduce((sum, x) => sum + x.stay, 0),
    '구간·거점 이동 추정': travel,
    '교통 대기 추정': wait,
    '혼잡 여유(추정)': Math.ceil(travel * 0.2),
    '날씨 여유(시나리오)':
      weather.condition === 'snow'
        ? 45
        : weather.condition === 'rain'
          ? 25
          : weather.condition === 'wind'
            ? 35
            : weather.condition === 'unknown'
              ? 15
              : 0,
    '동행 여유': /부모|가족/.test(s.companion) ? 20 : 10,
    '추가 안전 버퍼': Math.ceil(s.extraBuffer),
    '숙박·휴식 확보': !m.custom && s.duration > 600 ? 600 : 0,
  };
  const total = Object.values(costs).reduce((a, b) => a + b, 0);
  const margin = invalid || !Number.isFinite(total) ? null : available - total;
  const walk = m.stops.reduce((a, b) => a + b.walk, 0);
  const issues: string[] = [];
  if (weather.reason) issues.push(weather.reason);
  const closures: string[] = [];
  m.stops.forEach((stop, i) => {
    if (!Number.isFinite(schedule.legs[i].arrival)) return;
    const restriction = visitRestriction(
      stop.place,
      new Date(schedule.legs[i].arrival),
      stop.stay,
    );
    if (restriction) closures.push(stop.place.title + ': ' + restriction);
  });
  issues.push(...closures);
  if (m.variant === '실내')
    issues.push('실내 여부는 장소명·분류 기반 후보이며 미검증');
  if (!m.custom && s.duration > 600)
    issues.push('숙소·야간 운영·다음 날 일정 미확인');
  if (transport !== 'car') issues.push('시간표·환승·막차 미검증');
  if (m.stops.some((x) => x.place.source === 'manual'))
    issues.push('직접 지정한 장소: 위치·운영 정보 확인 필요');
  if (schedule.shifted)
    issues.push('계획한 출발시각이 지나 현재 시각부터 다시 계산');
  if (weather.condition === 'unknown') issues.push('실제 날씨 확인 필요');
  else issues.push('선택한 날씨 조건의 추정 버퍼 적용 · 현지 기상은 별도 확인');
  if (weather.condition === 'snow')
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
  const closed =
    closures.length > 0 ||
    m.stops.some((x) => x.place.opening_status === 'closed');
  if (closed) issues.push('방문 시간에 운영 제한이 있는 장소 포함');
  const band =
    margin === null
      ? 'unknown'
      : margin < 15 ||
          closed ||
          walk > s.walkLimit ||
          (['wind', 'snow'].includes(weather.condition) && m.variant !== '실내')
        ? 'avoid'
        : margin < 45 || transport !== 'car'
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
export type ManualPlace = {
  id: string;
  title: string;
  address: string;
  lat: number | null;
  lon: number | null;
  sigungu: string;
  category: string;
  publicPlaceDeclared?: boolean;
};
export const sensitivePlaceText = (text: string) =>
  /군번|부대|위병소|사단|여단|대대|중대|소대|작전|근무표|휴가증|신분증|탄약|사격장|훈련장|복무지|초소|[0-9]{2}-[0-9]{5,}/.test(
    text,
  );
export function validManualPlace(value: unknown): value is ManualPlace {
  if (!value || typeof value !== 'object') return false;
  const p = value as ManualPlace;
  return (
    typeof p.id === 'string' &&
    /^manual:[\w-]{1,80}$/.test(p.id) &&
    typeof p.title === 'string' &&
    p.title.trim().length >= 1 &&
    p.title.length <= 60 &&
    typeof p.address === 'string' &&
    p.address.length <= 160 &&
    regions.includes(p.sigungu as (typeof regions)[number]) &&
    ['attraction', 'restaurant', 'cafe', 'culture', 'other'].includes(
      p.category,
    ) &&
    ((p.lat === null && p.lon === null) ||
      (typeof p.lat === 'number' &&
        typeof p.lon === 'number' &&
        p.lat > 33 &&
        p.lat < 39.5 &&
        p.lon > 124 &&
        p.lon < 132))
  );
}
export function manualReference(p: Place): ManualPlace {
  return {
    id: p.id,
    title: p.title,
    address: p.address,
    lat: p.lat,
    lon: p.lon,
    sigungu: p.sigungu,
    category: p.category,
  };
}
export function manualToPlace(p: ManualPlace): Place {
  return {
    ...p,
    source: 'manual',
    source_id: p.id,
    chapter: chapters[regions.indexOf(p.sigungu as (typeof regions)[number])],
    theme_tags: [],
    military_context_tags: [],
    family_tags: [],
    access_tags: [],
    reward_tags: [],
    reservation_required: null,
    id_check_required: null,
    opening_status: 'unknown',
    image_url: null,
    overview:
      '사용자가 직접 지정한 장소입니다. 위치와 운영 정보는 직접 확인해 주세요.',
    data_quality_flags: [
      'user_entered',
      'operations_unverified',
      ...(p.lat === null
        ? ['coordinates_missing']
        : ['coordinates_user_selected']),
    ],
    last_verified_at: null,
  };
}
export type Entry = {
  recordId?: string;
  plan?: {
    originId: string;
    variant: string;
    stops: { placeId: string; stay: number; walk: number }[];
    kind?: 'custom';
    departureAt?: string;
    transport?: Settings['transport'];
    timeBudgetMinutes?: number;
    manualPlaces?: ManualPlace[];
  };
  missionId: string;
  title: string;
  region: string;
  stamps: string[];
  completedAt?: string;
};
export type Family = { code: string; expiresAt: number; scopes: Scopes };
export function publicCard(entry: Entry) {
  return {
    region: regions.includes(entry.region as (typeof regions)[number])
      ? entry.region
      : '강원특별자치도',
    mission: entry.plan?.kind === 'custom' ? '나만의 강원 여행' : entry.title,
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
        ? {
            id: mission.id,
            title: mission.custom ? '나만의 강원 여행' : mission.title,
            region: mission.region,
            placeNames: mission.stops.map((s) =>
              s.place.source === 'manual' ? '개인 장소' : s.place.title,
            ),
          }
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

/** Personal itinerary references only; never persist provider payloads or return times. */
export function createEntry(
  mission: Mission,
  origin: Place | undefined,
  recordId = crypto.randomUUID(),
): Entry {
  return {
    recordId,
    missionId: mission.id,
    title: mission.title,
    region: mission.region,
    stamps: [],
    plan: {
      ...(mission.custom ? { kind: 'custom' as const } : {}),
      departureAt: mission.departureAt,
      timeBudgetMinutes: mission.timeBudgetMinutes,
      transport: mission.transport,
      manualPlaces: [
        ...new Map(
          [...(origin ? [origin] : []), ...mission.stops.map((s) => s.place)]
            .filter((p) => p.source === 'manual')
            .map((p) => [p.id, manualReference(p)]),
        ).values(),
      ],
      originId: origin?.id || '',
      variant: mission.variant,
      stops: mission.stops.map(({ place, stay, walk }) => ({
        placeId: place.id,
        stay,
        walk,
      })),
    },
  };
}
export const entryKey = (entry: Entry) => entry.recordId || entry.missionId;
export const hasVisitRecord = (entry: Entry) =>
  !(entry.plan && !entry.plan.stops.length) &&
  (Boolean(entry.completedAt) ||
    entry.stamps.some((s) => ['입경', '전환', '복귀', '동행'].includes(s)));
export const planSignature = (entry: Entry) =>
  entry.plan ? JSON.stringify([entry.missionId, entry.plan]) : '';
export function resolveEntry(
  entry: Entry,
  places: Place[],
): { mission: Mission; origin: Place | undefined } | null {
  const plan = entry.plan;
  if (
    !plan ||
    !Array.isArray(plan.stops) ||
    plan.stops.length < (plan.kind === 'custom' ? 0 : 2) ||
    plan.stops.length > (plan.kind === 'custom' ? 12 : 4)
  )
    return null;
  const candidates = [
    ...(plan.manualPlaces || []).filter(validManualPlace).map(manualToPlace),
    ...places,
  ];
  const origin = candidates.find(
    (p) => p.id === plan.originId && validCoord(p),
  );
  const stops = plan.stops.map((s) => ({
    ...s,
    place: candidates.find(
      (p) => p.id === s.placeId && (validCoord(p) || plan.kind === 'custom'),
    ),
  }));
  if (
    (!origin && plan.kind !== 'custom') ||
    stops.some(
      (s) =>
        !s.place ||
        !Number.isFinite(s.stay) ||
        !Number.isFinite(s.walk) ||
        s.stay <= 0 ||
        s.walk < 0,
    )
  )
    return null;
  return {
    origin,
    mission: {
      id: entry.missionId,
      title: entry.title,
      region: entry.region,
      variant: plan.variant,
      custom: plan.kind === 'custom',
      departureAt: plan.departureAt,
      timeBudgetMinutes: plan.timeBudgetMinutes,
      transport: plan.transport,
      brief:
        '저장한 장소와 순서입니다. 출발 계획 기준으로 시간과 방문 조건을 확인하세요.',
      stops: stops.map((s) => ({
        place: s.place!,
        stay: s.stay,
        walk: s.walk,
        walkVerified: false,
      })),
    },
  };
}
export function effectiveWeather(
  s: Settings,
  now = new Date(),
): { condition: Settings['weather']; reason?: string } {
  const f = s.weatherForecast;
  if (!f) return { condition: s.weather };
  if (f.region !== s.region)
    return {
      condition: 'unknown',
      reason: '다른 지역의 예보입니다. 현 지역 날씨를 다시 확인하세요.',
    };
  if (
    !(Date.parse(f.validUntil) > now.getTime()) ||
    !(Date.parse(f.fetchedAt) <= now.getTime()) ||
    now.getTime() - Date.parse(f.fetchedAt) > 3 * 3600000
  )
    return {
      condition: 'unknown',
      reason: '적용한 예보가 만료됐습니다. 날씨를 다시 확인하세요.',
    };
  if (Date.parse(s.returnAt) > Date.parse(f.validUntil))
    return {
      condition: 'unknown',
      reason:
        '여행 시간이 예보 범위를 넘습니다. 전체 날씨는 미확인으로 계산합니다.',
    };
  return { condition: s.weather };
}
/** Only confirmed fields can reject a visit; absence never means open. */
export function visitRestriction(
  place: Place,
  arrival: Date,
  stay = 0,
): string | null {
  if (place.source === 'manual') return null;
  if (place.sigungu !== '철원군' || !Number.isFinite(arrival.getTime()))
    return null;
  const normal = (s: string) => s.replace(/\s/g, '');
  const item = verifiedConditions.places.find(
    (x) =>
      x.place_id === place.id ||
      normal(x.title) === normal(place.title) ||
      (x.title === '고석정국민관광지' &&
        ['고석정', '고석정관광지'].includes(normal(place.title))),
  );
  if (!item) return null;
  const fields = item.fields as Record<
    string,
    { status: string; value: unknown } | undefined
  >;
  const field = (key: string) =>
    fields[key]?.status === 'confirmed' ? fields[key]!.value : null;
  const kst = new Date(arrival.getTime() + 9 * 3600000);
  const date = kst.toISOString().slice(0, 10);
  const weekdays = field('closed_weekdays');
  if (
    Array.isArray(weekdays) &&
    weekdays.includes(
      ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][kst.getUTCDay()],
    )
  )
    return '공식 정기 휴무일 · 예외 운영은 시설에 확인';
  const season = field('operating_season') as {
    start?: string;
    end?: string;
  } | null;
  if (season?.start && season.end && (date < season.start || date > season.end))
    return '확인된 운영기간 밖 · 다음 운영계획 확인 필요';
  const h = field('opening_hours') as {
    mode?: string;
    open?: string;
    close?: string;
    last_ticket?: string;
    summer_months?: number[];
    summer_open?: string;
    summer_close?: string;
    winter_open?: string;
    winter_close?: string;
  } | null;
  if (!h || h.mode === 'always_open') return null;
  const summer = h.summer_months?.includes(kst.getUTCMonth() + 1);
  const open = h.open || (summer ? h.summer_open : h.winter_open),
    close = h.close || (summer ? h.summer_close : h.winter_close);
  const minutes = (v: string) =>
    Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
  const at = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  if (
    open &&
    close &&
    (at < minutes(open) || at + stay > minutes(close) || at >= minutes(close))
  )
    return '예상 방문이 공식 운영시간 밖 · 시간 또는 장소 변경 필요';
  if (h.last_ticket && at >= minutes(h.last_ticket))
    return '예상 도착이 공식 매표 종료 이후 · 입장 가능 여부 확인';
  return null;
}

/** Planning stays anchored to the selected departure; only active outings use wall time. */
export function planningSettings(
  m: Mission | null | undefined,
  settings: Settings,
): Settings {
  const startedAt = m?.departureAt || settings.startedAt;
  const duration =
    m?.timeBudgetMinutes && m.timeBudgetMinutes > 0
      ? m.timeBudgetMinutes
      : settings.duration;
  const returnAt = m?.timeBudgetMinutes
    ? new Date(Date.parse(startedAt) + duration * 60000).toISOString()
    : settings.returnAt;
  return {
    ...settings,
    startedAt,
    duration,
    returnAt,
    transport: m?.transport || settings.transport,
  };
}
export function assessPlan(
  m: Mission,
  s: Settings,
  origin: Place,
  observedNow = new Date(),
): Assessment {
  const plan = planningSettings(m, s);
  const result = assess(m, plan, origin, new Date(plan.startedAt), observedNow);
  return m.stops.length
    ? result
    : {
        ...result,
        margin: null,
        band: 'unknown',
        conditionsConfirmed: false,
        issues: ['장소를 담으면 여행 시간을 계산할 수 있어요.'],
      };
}
export function planSchedule(m: Mission, s: Settings, origin: Place) {
  const plan = planningSettings(m, s);
  return routeSchedule(m, plan, origin, new Date(plan.startedAt));
}
export function withPlan(m: Mission, s: Settings): Mission {
  return {
    ...m,
    departureAt: m.departureAt || s.startedAt,
    transport: m.transport || s.transport,
    timeBudgetMinutes:
      m.timeBudgetMinutes ||
      Math.max(
        1,
        Math.round((Date.parse(s.returnAt) - Date.parse(s.startedAt)) / 60000),
      ),
  };
}
export type ActiveOuting = {
  entry: Entry;
  startedAt: string;
  timeBudgetMinutes: number;
  completedStops: number;
  settings: Pick<
    Settings,
    'transport' | 'companion' | 'walkLimit' | 'extraBuffer'
  > &
    Partial<Pick<Settings, 'weather' | 'weatherForecast'>>;
};
export function validOuting(v: unknown): v is ActiveOuting {
  if (!v || typeof v !== 'object') return false;
  const a = v as ActiveOuting;
  return (
    !!a.entry?.plan?.stops?.length &&
    Number.isFinite(Date.parse(a.startedAt)) &&
    Number.isFinite(a.timeBudgetMinutes) &&
    a.timeBudgetMinutes > 0 &&
    a.timeBudgetMinutes <= 10080 &&
    Number.isInteger(a.completedStops) &&
    a.completedStops >= 0 &&
    a.completedStops <= a.entry.plan.stops.length &&
    !!a.settings &&
    ['car', 'transit', 'taxi', 'unknown'].includes(a.settings.transport) &&
    Number.isFinite(a.settings.extraBuffer)
  );
}
export function assessOuting(
  a: ActiveOuting,
  places: Place[],
  now = new Date(),
) {
  const resolved = resolveEntry(a.entry, places);
  if (!resolved?.origin) return null;
  const { mission, origin } = resolved;
  const current = a.completedStops
    ? mission.stops[a.completedStops - 1].place
    : origin;
  const remaining = {
    ...mission,
    custom: true,
    departureAt: a.startedAt,
    stops: mission.stops.slice(a.completedStops),
  };
  const settings = {
    ...defaultSettings(now),
    ...a.settings,
    region: mission.region,
    duration: a.timeBudgetMinutes,
    startedAt: a.startedAt,
    returnAt: new Date(
      Date.parse(a.startedAt) + a.timeBudgetMinutes * 60000,
    ).toISOString(),
  };
  return {
    mission,
    origin,
    current,
    remaining,
    settings,
    score: assess(remaining, settings, current, now, now, origin),
  };
}
export function completeTrip(
  entry: Entry,
  stamps: string[],
  now = new Date(),
): Entry {
  if (!entry.plan?.stops.length) return entry;
  const chosen = stamps.filter((v) =>
    ['입경', '전환', '복귀', '동행'].includes(v),
  );
  return {
    ...entry,
    completedAt: now.toISOString(),
    stamps: [...new Set([...entry.stamps, ...chosen])],
  };
}
