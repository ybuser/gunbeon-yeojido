import {
  regions,
  validManualPlace,
  type Entry,
  type ManualPlace,
  type ActiveOuting,
} from './domain.ts';

export type TravelState = {
  version: 3;
  entries: Entry[];
  favorites: ManualPlace[];
  activeOuting: ActiveOuting | null;
  planning?: {
    region: string;
    startedAt: string;
    duration: number;
    originId: string;
    transport: 'car' | 'transit' | 'taxi' | 'unknown';
    meeting?: ManualPlace;
  };
};
const object = (v: unknown): Record<string, any> => {
  if (!v || typeof v !== 'object' || Array.isArray(v))
    throw new Error('INVALID_TRAVEL_STATE');
  return v;
};
const string = (v: unknown, max: number, empty = false): string => {
  if (typeof v !== 'string' || v.length > max || (!empty && !v.trim()))
    throw new Error('INVALID_TRAVEL_STATE');
  return v;
};
const number = (v: unknown, min: number, max: number) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max)
    throw new Error('INVALID_TRAVEL_STATE');
  return v;
};
const date = (v: unknown) => {
  const s = string(v, 40);
  if (!Number.isFinite(Date.parse(s))) throw new Error('INVALID_TRAVEL_STATE');
  return s;
};
const region = (v: unknown) => {
  if (!regions.includes(v as (typeof regions)[number]))
    throw new Error('INVALID_TRAVEL_STATE');
  return v as string;
};
const transport = (v: unknown): 'car' | 'transit' | 'taxi' | 'unknown' => {
  if (!['car', 'transit', 'taxi', 'unknown'].includes(v as string))
    throw new Error('INVALID_TRAVEL_STATE');
  return v as 'car';
};
const array = <T>(v: unknown, max: number, clean: (v: unknown) => T): T[] => {
  if (!Array.isArray(v) || v.length > max)
    throw new Error('INVALID_TRAVEL_STATE');
  return v.map(clean);
};
export function cleanManual(v: unknown): ManualPlace {
  if (!validManualPlace(v)) throw new Error('INVALID_TRAVEL_STATE');
  return {
    id: v.id,
    title: v.title,
    address: v.address,
    lat: v.lat,
    lon: v.lon,
    sigungu: v.sigungu,
    category: v.category,
  };
}
export function cleanEntry(value: unknown): Entry {
  const v = object(value);
  const e: Entry = {
    missionId: string(v.missionId, 160),
    title: string(v.title, 120),
    region: region(v.region),
    stamps: array(v.stamps, 5, (s) => {
      if (!['입경', '전환', '복귀', '동행', '휴가 씨앗'].includes(s as string))
        throw new Error('INVALID_TRAVEL_STATE');
      return s as string;
    }),
  };
  if (v.recordId !== undefined) e.recordId = string(v.recordId, 160);
  if (v.completedAt !== undefined) e.completedAt = date(v.completedAt);
  if (v.recordStatus === 'completed') e.recordStatus = 'completed';
  if (v.visitedPlaceIds !== undefined)
    e.visitedPlaceIds = array(v.visitedPlaceIds, 50, (x) => string(x, 160));
  if (v.adviceShareId !== undefined)
    e.adviceShareId = string(v.adviceShareId, 32);
  if (v.adviceReceipt) {
    const r = object(v.adviceReceipt);
    e.adviceReceipt = {
      shareId: string(r.shareId, 32),
      suggestionId: string(r.suggestionId, 32),
    };
  }
  if (v.plan !== undefined) {
    const p = object(v.plan);
    e.plan = {
      originId: string(p.originId, 160, true),
      variant: string(p.variant, 80, true),
      stops: array(p.stops, 50, (x) => {
        const s = object(x);
        return {
          placeId: string(s.placeId, 160),
          stay: number(s.stay, 0, 10080),
          walk: number(s.walk, 0, 1440),
        };
      }),
    };
    if (p.kind === 'custom') e.plan.kind = 'custom';
    if (p.departureAt !== undefined) e.plan.departureAt = date(p.departureAt);
    if (p.transport !== undefined) e.plan.transport = transport(p.transport);
    if (p.timeBudgetMinutes !== undefined)
      e.plan.timeBudgetMinutes = number(p.timeBudgetMinutes, 1, 10080);
    if (p.manualPlaces !== undefined)
      e.plan.manualPlaces = array(p.manualPlaces, 51, cleanManual);
  }
  return e;
}
/** Persist only user-authored data and place references, never provider payloads. */
export function cleanTravelState(value: unknown): TravelState {
  const v = object(value);
  if (![1, 2, 3].includes(v.version)) throw new Error('INVALID_TRAVEL_STATE');
  const state: TravelState = {
    version: 3,
    entries: array(v.entries || [], 300, cleanEntry),
    favorites: array(v.favorites || [], 50, cleanManual),
    activeOuting: null,
  };
  if (v.planning) {
    const p = object(v.planning);
    state.planning = {
      region: region(p.region),
      startedAt: date(p.startedAt),
      duration: number(p.duration, 1, 10080),
      originId: string(p.originId || '', 160, true),
      transport: transport(p.transport || 'unknown'),
    };
    if (p.meeting) state.planning.meeting = cleanManual(p.meeting);
  }
  if (v.activeOuting) {
    const a = object(v.activeOuting),
      s = object(a.settings),
      entry = cleanEntry(a.entry);
    const completedStops = number(
      a.completedStops,
      0,
      entry.plan?.stops.length || 0,
    );
    if (!entry.plan?.stops.length || !Number.isInteger(completedStops))
      throw new Error('INVALID_TRAVEL_STATE');
    state.activeOuting = {
      entry,
      startedAt: date(a.startedAt),
      timeBudgetMinutes: number(a.timeBudgetMinutes, 1, 10080),
      completedStops,
      settings: {
        transport: transport(s.transport),
        companion: string(s.companion || '혼자', 30),
        walkLimit: number(s.walkLimit, 0, 1440),
        extraBuffer: number(s.extraBuffer, 0, 1440),
        weather: 'unknown',
      },
    };
  }
  return state;
}
