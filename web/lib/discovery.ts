import { dedupePlaces, distance, validCoord } from './domain.ts';
import type { Place, Mission, Entry } from './domain.ts';
export const discoveryThemes = {
  all: '전체',
  nature: '풍경·산책',
  culture: '문화·쉼',
  peace: '평화·기억',
} as const;
type Definition = {
  id: string;
  region: string;
  title: string;
  brief: string;
  theme: Exclude<keyof typeof discoveryThemes, 'all'>;
  titles: string[];
  stays: number[];
  walks: number[];
  note?: string;
};
const definitions: Definition[] = [
  {
    id: 'cw-river',
    region: '철원군',
    title: '고석정에서 주상절리까지',
    brief: '한탄강을 따라 서로 다른 풍경 세 곳을 만나는 코스.',
    theme: 'nature',
    titles: ['고석정국민관광지', '순담계곡', '송대소주상절리'],
    stays: [50, 40, 35],
    walks: [20, 20, 15],
    note: '계곡 산책과 유료 주상절리길 입장은 다릅니다. 이용할 구간을 일정에서 확인하세요.',
  },
  {
    id: 'cw-memory',
    region: '철원군',
    title: '철원에 남은 기억을 따라',
    brief: '노동당사와 백마고지에서 지역의 역사를 돌아보는 하루.',
    theme: 'peace',
    titles: ['철원 노동당사', '백마고지 위령비와 기념관'],
    stays: [40, 45],
    walks: [15, 20],
  },
  {
    id: 'cw-flowers',
    region: '철원군',
    title: '고석정 곁에서 천천히',
    brief: '고석정과 꽃밭, 장소를 줄이고 여유를 남기는 코스.',
    theme: 'nature',
    titles: ['고석정국민관광지', '고석정 꽃밭'],
    stays: [50, 60],
    walks: [20, 30],
    note: '꽃밭은 계절에 따라 개장·경관이 달라집니다. 방문 날짜를 정한 뒤 운영 여부를 확인하세요.',
  },
  {
    id: 'hc-river',
    region: '화천군',
    title: '북한강 곁의 작은 쉼표',
    brief: '붕어섬과 꺼먹다리를 거쳐 커피 이야기가 있는 곳으로.',
    theme: 'nature',
    titles: ['붕어섬', '꺼먹다리', '산천어커피박물관'],
    stays: [50, 25, 45],
    walks: [25, 15, 10],
  },
  {
    id: 'hc-peace',
    region: '화천군',
    title: '평화의 댐에서 비목공원으로',
    brief: '물길을 바라보고 평화와 기억의 공간을 돌아봅니다.',
    theme: 'peace',
    titles: ['평화의댐(화천)', '세계 평화의종 공원', '화천 비목공원'],
    stays: [40, 30, 30],
    walks: [15, 15, 15],
  },
  {
    id: 'hc-culture',
    region: '화천군',
    title: '커피와 나무를 만나는 오후',
    brief: '전시와 체험 공간을 중심으로 짜는 화천 문화 여행.',
    theme: 'culture',
    titles: ['산천어커피박물관', '화천 목재문화체험장'],
    stays: [50, 60],
    walks: [10, 15],
    note: '체험 프로그램과 실내 이용 범위는 운영처 확인이 필요합니다.',
  },
  {
    id: 'yg-water',
    region: '양구군',
    title: '호수와 꽃섬을 잇는 하루',
    brief: '전망대와 꽃섬을 보고 양구의 이야기를 만납니다.',
    theme: 'nature',
    titles: ['한반도섬전망대', '양구꽃섬', '양구근현대사박물관'],
    stays: [35, 45, 50],
    walks: [20, 25, 10],
  },
  {
    id: 'yg-dmz',
    region: '양구군',
    title: '두타연과 펀치볼의 풍경',
    brief: '접경지역의 자연과 마을을 함께 살펴보는 코스.',
    theme: 'peace',
    titles: ['두타연 (국가지질공원)', '양구 펀치볼마을'],
    stays: [80, 50],
    walks: [45, 20],
    note: '두타연은 출입·예약·신분 확인 조건과 당일 통제를 먼저 확인하세요. 즉시 입장 가능한 코스를 뜻하지 않습니다.',
  },
  {
    id: 'yg-culture',
    region: '양구군',
    title: '양구의 이야기를 읽는 오후',
    brief: '두 박물관을 중심으로 전시를 천천히 둘러봅니다.',
    theme: 'culture',
    titles: ['양구근현대사박물관', '양구인문학박물관'],
    stays: [55, 55],
    walks: [10, 10],
  },
  {
    id: 'ij-village',
    region: '인제군',
    title: '만해마을에서 백담마을로',
    brief: '문학과 마을 풍경, 용대리에서 쉬어가는 여행.',
    theme: 'culture',
    titles: ['만해마을', '백담마을', '용대 매바위 인공폭포'],
    stays: [55, 45, 25],
    walks: [15, 15, 10],
  },
  {
    id: 'ij-forest',
    region: '인제군',
    title: '비밀의정원과 방동약수',
    brief: '숲의 풍경을 감상하고 약수터에 잠시 들릅니다.',
    theme: 'nature',
    titles: ['비밀의정원', '방동약수'],
    stays: [35, 35],
    walks: [10, 15],
    note: '비밀의정원은 정해진 관람 지점에서 감상하세요. 숲 안으로 들어가는 코스가 아닙니다.',
  },
  {
    id: 'ij-river',
    region: '인제군',
    title: '합강정에서 강을 바라보며',
    brief: '정자와 강변 지형을 잇는 짧은 인제 산책.',
    theme: 'nature',
    titles: ['합강정', '소양강 하안단구'],
    stays: [35, 40],
    walks: [15, 20],
  },
  {
    id: 'gs-coast',
    region: '고성군',
    title: '능파대와 아야진의 바다',
    brief: '바위 해안과 해변을 보고 청간정에서 마무리합니다.',
    theme: 'nature',
    titles: ['능파대 (강원평화지역 국가지질공원)', '아야진해변', '청간정'],
    stays: [45, 50, 30],
    walks: [25, 20, 15],
    note: '바위 해안은 파도·강풍과 미끄럼에 주의하세요.',
  },
  {
    id: 'gs-village',
    region: '고성군',
    title: '왕곡마을에서 송지호까지',
    brief: '옛 마을과 호수, 해변의 풍경을 한 번에 만납니다.',
    theme: 'culture',
    titles: ['고성 왕곡마을', '송지호관망타워', '송지호 해수욕장'],
    stays: [60, 30, 45],
    walks: [25, 10, 20],
  },
  {
    id: 'gs-peace',
    region: '고성군',
    title: '고성의 북쪽 바다를 만나는 길',
    brief: '출입 절차를 확인하고 전망대와 화진포를 돌아봅니다.',
    theme: 'peace',
    titles: ['통일안보공원', '고성 통일전망타워', '화진포(화진포호)'],
    stays: [35, 60, 50],
    walks: [10, 20, 25],
    note: '출입 신고·신분 확인·당일 통제를 먼저 확인하세요. 절차 대기시간은 별도입니다.',
  },
];
const normalize = (s: string) => s.replace(/국민관광지|\([^)]*\)|\s/g, '');
export type Recommendation = Mission & {
  theme: Definition['theme'];
  note?: string;
  visitMinutes: number;
  walkMinutes: number;
  travelMinutes: number | null;
  sourceCount: number;
};
/** Date-free discovery: no personal departure, deadline, origin, weather or ranking by return margin. */
export function makeRecommendations(
  nodes: Place[],
  region: string,
): Recommendation[] {
  return definitions
    .filter((d) => d.region === region)
    .flatMap((d) => {
      const stops = d.titles
        .map((title, i) => {
          const matches = nodes.filter(
            (p) =>
              p.sigungu === region &&
              p.source !== 'manual' &&
              normalize(p.title) === normalize(title),
          );
          const place =
            matches.find((p) => p.source === 'tourapi' && validCoord(p)) ||
            matches.find(validCoord) ||
            matches[0];
          return place
            ? {
                place,
                stay: d.stays[i],
                walk: d.walks[i],
                walkVerified: false as const,
              }
            : null;
        })
        .filter((x) => x !== null);
      if (
        stops.length !== d.titles.length ||
        dedupePlaces(stops.map((s) => s.place)).length !== stops.length
      )
        return [];
      const kms = stops
        .slice(1)
        .map((s, i) => distance(stops[i].place, s.place));
      return [
        {
          id: 'discovery:' + d.id,
          title: d.title,
          brief: d.brief,
          region,
          variant: discoveryThemes[d.theme],
          theme: d.theme,
          note: d.note,
          stops,
          visitMinutes: stops.reduce((n, s) => n + s.stay, 0),
          walkMinutes: stops.reduce((n, s) => n + s.walk, 0),
          travelMinutes: kms.every(Number.isFinite)
            ? Math.ceil(((kms.reduce((a, b) => a + b, 0) * 1.4) / 35) * 60)
            : null,
          sourceCount: stops.filter((s) => s.place.source === 'tourapi').length,
        },
      ];
    });
}
export function recommendationEntry(m: Recommendation): Entry {
  const budget =
    Math.ceil((m.visitMinutes + (m.travelMinutes || 30) + 60) / 60) * 60;
  return {
    recordId: crypto.randomUUID(),
    missionId: 'custom:' + m.id,
    title: m.title,
    region: m.region,
    stamps: [],
    plan: {
      kind: 'custom',
      variant: m.variant,
      originId: '',
      stops: m.stops.map((s) => ({
        placeId: s.place.id,
        stay: s.stay,
        walk: s.walk,
      })),
      manualPlaces: [],
      timeBudgetMinutes: Math.max(180, budget),
    },
  };
}
