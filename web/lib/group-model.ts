import { validManualPlace, regions } from './domain.ts';
import type { Entry, ManualPlace } from './domain.ts';
export const groupKinds = {
  family: '가족',
  partner: '연인',
  friends: '친구',
  others: '동행',
};
export type SharedPlan = {
  title: string;
  region: string;
  departureAt: string;
  transport: 'car' | 'transit' | 'taxi' | 'unknown';
  stops: { placeId: string; stay: number; walk: number }[];
  manualPlaces: ManualPlace[];
  meetingId: string;
};
export type GroupSummary = {
  id: string;
  name: string;
  kind: keyof typeof groupKinds;
  ownerId: string;
  memberCount: number;
  planCount: number;
};
export type GroupPlan = {
  id: string;
  groupId: string;
  authorId: string;
  version: number;
  updatedAt: string;
  plan: SharedPlan;
};
export type GroupDetail = GroupSummary & {
  plans: GroupPlan[];
  members: { id: string; nickname: string }[];
};
export function cleanName(v: unknown, max = 40) {
  return typeof v === 'string'
    ? v
        .replace(/[<>\x00-\x1f]/g, '')
        .trim()
        .slice(0, max)
    : '';
}
export function validSharedPlan(value: unknown): value is SharedPlan {
  const p = value as SharedPlan;
  return (
    !!p &&
    typeof p.title === 'string' &&
    typeof p.departureAt === 'string' &&
    cleanName(p.title, 60) === p.title &&
    p.title.length > 0 &&
    regions.includes(p.region as (typeof regions)[number]) &&
    Number.isFinite(Date.parse(p.departureAt)) &&
    ['car', 'transit', 'taxi', 'unknown'].includes(p.transport) &&
    typeof p.meetingId === 'string' &&
    /^[\w:-]{0,100}$/.test(p.meetingId) &&
    Array.isArray(p.stops) &&
    p.stops.length <= 12 &&
    p.stops.every(
      (s) =>
        !!s &&
        typeof s.placeId === 'string' &&
        /^[\w:-]{1,100}$/.test(s.placeId) &&
        Number.isInteger(s.stay) &&
        s.stay >= 1 &&
        s.stay <= 1440 &&
        Number.isInteger(s.walk) &&
        s.walk >= 0 &&
        s.walk <= 240 &&
        s.walk <= s.stay,
    ) &&
    new Set(p.stops.map((s) => s.placeId)).size === p.stops.length &&
    Array.isArray(p.manualPlaces) &&
    p.manualPlaces.length <= 13 &&
    p.manualPlaces.every(validManualPlace) &&
    new Set(p.manualPlaces.map((m) => m.id)).size === p.manualPlaces.length &&
    [...p.stops.map((s) => s.placeId), p.meetingId]
      .filter((id) => id.startsWith('manual:'))
      .every((id) => p.manualPlaces.some((m) => m.id === id))
  );
}
/** Whitelist only the chosen shared itinerary. Never upload an Entry/outing object. */
export function sharePlan(entry: Entry, includeManual = false): SharedPlan {
  const p = entry.plan;
  if (!p) throw new Error('계획을 먼저 저장해 주세요.');
  const stops = p.stops
    .filter((s) => includeManual || !s.placeId.startsWith('manual:'))
    .map((s) => ({ placeId: s.placeId, stay: s.stay, walk: s.walk }));
  const meetingId =
    includeManual || !p.originId.startsWith('manual:') ? p.originId : '';
  const used = new Set([...stops.map((s) => s.placeId), meetingId]);
  return {
    title: cleanName(entry.title, 60),
    region: entry.region,
    departureAt: p.departureAt || new Date().toISOString(),
    transport: p.transport || 'car',
    stops,
    meetingId,
    manualPlaces: includeManual
      ? (p.manualPlaces || [])
          .filter((m) => used.has(m.id))
          .map(({ id, title, address, lat, lon, sigungu, category }) => ({
            id,
            title,
            address,
            lat,
            lon,
            sigungu,
            category,
          }))
      : [],
  };
}
export function groupEntry(record: GroupPlan): Entry {
  const p = record.plan;
  return {
    recordId: 'group-copy:' + crypto.randomUUID(),
    missionId: 'custom:' + record.id,
    title: p.title,
    region: p.region,
    stamps: [],
    plan: {
      kind: 'custom',
      variant: '그룹 여행',
      originId: p.meetingId,
      stops: p.stops,
      manualPlaces: p.manualPlaces,
      departureAt: p.departureAt,
      transport: p.transport,
      timeBudgetMinutes: 240,
    },
  };
}
