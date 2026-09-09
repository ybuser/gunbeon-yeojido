import { hasVisitRecord, type Entry, type Place, regions } from './domain.ts';
export const adviceQuestions = {
  change: '이 코스, 한 곳만 바꾼다면?',
  meal: '중간에 밥 한 끼, 어디가 좋을까요?',
  easy: '조금 덜 걷고 싶어요. 어디를 바꿀까요?',
} as const;
export const adviceReasons = [
  '제가 좋아하는 곳이에요',
  '식사 시간을 넣으면 좋겠어요',
  '실내에서 쉬어가면 좋겠어요',
  '이동을 줄이면 좋겠어요',
  '한 곳을 더 여유 있게 보고 싶어요',
] as const;
export type AdviceSnapshot = {
  region: string;
  question: keyof typeof adviceQuestions;
  placeIds: string[];
};
export type PublicPlace = Pick<
  Place,
  'id' | 'title' | 'image_url' | 'source' | 'sigungu'
>;
export type AdviceSuggestion = {
  id: string;
  kind: 'add' | 'replace' | 'remove';
  targetId: string;
  placeId: string | null;
  reason: string;
  status: 'pending' | 'adopted' | 'hidden';
  own?: boolean;
  reported?: boolean;
};
export type AdviceDetail = {
  page: number;
  hasMore: boolean;
  id: string;
  snapshot: AdviceSnapshot;
  status: 'open' | 'closed';
  owner: boolean;
  places: PublicPlace[];
  candidates: PublicPlace[];
  missing: string[];
  suggestions: AdviceSuggestion[];
  expiresAt: string;
};
export const adviceIdValid = (v: unknown): v is string =>
  typeof v === 'string' && /^[a-f0-9]{32}$/.test(v);
export function validAdviceSnapshot(v: unknown): v is AdviceSnapshot {
  if (!v || typeof v !== 'object') return false;
  const s = v as AdviceSnapshot;
  return (
    regions.includes(s.region as (typeof regions)[number]) &&
    Object.hasOwn(adviceQuestions, s.question) &&
    Array.isArray(s.placeIds) &&
    s.placeIds.length > 0 &&
    s.placeIds.length <= 12 &&
    new Set(s.placeIds).size === s.placeIds.length &&
    s.placeIds.every(
      (id) =>
        typeof id === 'string' && id.length <= 80 && !id.startsWith('manual:'),
    )
  );
}
export function adviceProjection(
  entry: Entry,
  places: Place[],
  question: AdviceSnapshot['question'],
): AdviceSnapshot {
  return {
    region: entry.region,
    question,
    placeIds: [
      ...new Set(
        (entry.plan?.stops || [])
          .filter(
            (s) =>
              s.placeId !== entry.plan?.originId &&
              !entry.plan?.manualPlaces?.some((p) => p.id === s.placeId),
          )
          .map((s) => s.placeId),
      ),
    ].filter(
      (id) =>
        !id.startsWith('manual:') &&
        places.some(
          (p) =>
            p.id === id &&
            ['tourapi', 'dmz_tourism', 'dmz_cafe', 'mpva_memorial'].includes(
              p.source,
            ),
        ),
    ),
  };
}
export function validSuggestion(
  v: unknown,
  snapshot: AdviceSnapshot,
): v is Omit<AdviceSuggestion, 'id' | 'status'> {
  if (!v || typeof v !== 'object') return false;
  const s = v as AdviceSuggestion;
  return (
    ['add', 'replace', 'remove'].includes(s.kind) &&
    (s.kind !== 'add' || snapshot.placeIds.length < 12) &&
    snapshot.placeIds.includes(s.targetId) &&
    adviceReasons.includes(s.reason as (typeof adviceReasons)[number]) &&
    (s.kind === 'remove'
      ? s.placeId === null && snapshot.placeIds.length > 1
      : typeof s.placeId === 'string' &&
        s.placeId.length <= 80 &&
        !s.placeId.startsWith('manual:') &&
        !snapshot.placeIds.includes(s.placeId))
  );
}
export function suggestionIds(
  ids: string[],
  s: AdviceSuggestion,
): string[] | null {
  const index = ids.indexOf(s.targetId);
  if (index < 0 || (s.placeId && ids.includes(s.placeId))) return null;
  const result = [...ids];
  if (s.kind === 'remove') result.splice(index, 1);
  else if (s.kind === 'replace' && s.placeId)
    result.splice(index, 1, s.placeId);
  else if (s.kind === 'add' && s.placeId)
    result.splice(index + 1, 0, s.placeId);
  else return null;
  return result.length > 0 && result.length <= 12 ? result : null;
}
export function applyAdvice(
  entry: Entry,
  suggestion: AdviceSuggestion,
): Entry | null {
  if (!entry.plan || hasVisitRecord(entry)) return null;
  const ids = suggestionIds(
    entry.plan.stops.map((s) => s.placeId),
    suggestion,
  );
  if (
    !ids ||
    suggestion.targetId === entry.plan.originId ||
    suggestion.placeId === entry.plan.originId
  )
    return null;
  return {
    ...entry,
    plan: {
      ...entry.plan,
      kind: 'custom',
      stops: ids.map(
        (id) =>
          entry.plan!.stops.find((s) => s.placeId === id) || {
            placeId: id,
            stay: 45,
            walk: 15,
          },
      ),
    },
  };
}
export function adviceIsApplied(entry: Entry, s: AdviceSuggestion) {
  const ids = entry.plan?.stops.map((x) => x.placeId) || [];
  return (
    !hasVisitRecord(entry) &&
    (s.kind === 'remove'
      ? !ids.includes(s.targetId)
      : s.kind === 'replace'
        ? !ids.includes(s.targetId) && !!s.placeId && ids.includes(s.placeId)
        : !!s.placeId &&
          ids.indexOf(s.placeId) === ids.indexOf(s.targetId) + 1 &&
          ids.includes(s.targetId))
  );
}
export function adviceEntry(snapshot: AdviceSnapshot): Entry {
  return {
    recordId: crypto.randomUUID(),
    missionId: 'custom:' + crypto.randomUUID(),
    title: snapshot.region.replace(/[군시]$/, '') + '에서 나의 하루',
    region: snapshot.region,
    stamps: [],
    plan: {
      kind: 'custom',
      variant: '한 수에서 시작한 여행',
      originId: '',
      stops: snapshot.placeIds.map((placeId) => ({
        placeId,
        stay: 45,
        walk: 15,
      })),
      transport: 'unknown',
      timeBudgetMinutes: 240,
    },
  };
}
