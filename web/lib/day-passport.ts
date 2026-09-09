import {
  assessPlan,
  validCoord,
  regions,
  publicCard,
  sensitivePlaceText,
  type Mission,
  type Place,
  type Settings,
  type Entry,
} from './domain.ts';

export type Adjustment =
  | { kind: 'remove'; index: number }
  | { kind: 'stay'; index: number; minutes: number };
export function adjustPlan(
  mission: Mission,
  originId: string,
  adjustment: Adjustment,
): Mission | null {
  const stop = mission.stops[adjustment.index];
  if (!stop || !Number.isInteger(adjustment.index)) return null;
  if (adjustment.kind === 'remove') {
    // Meeting points and known reservations are preserved by suggested adjustments.
    if (
      mission.stops.length < 2 ||
      stop.place.id === originId ||
      stop.place.reservation_required
    )
      return null;
    return {
      ...mission,
      stops: mission.stops.filter((_, i) => i !== adjustment.index),
    };
  }
  const stay = adjustment.minutes;
  if (
    !Number.isInteger(stay) ||
    stay < Math.max(5, stop.walk) ||
    stay >= stop.stay
  )
    return null;
  return {
    ...mission,
    stops: mission.stops.map((s, i) =>
      i === adjustment.index ? { ...s, stay } : s,
    ),
  };
}
export function comparePlanAdjustment(
  mission: Mission,
  settings: Settings,
  origin: Place | undefined,
  adjustment: Adjustment,
  observedNow = new Date(),
) {
  if (
    !origin ||
    !validCoord(origin) ||
    !mission.stops.length ||
    !Number.isFinite(Date.parse(mission.departureAt || '')) ||
    !Number.isFinite(mission.timeBudgetMinutes) ||
    mission.timeBudgetMinutes! <= 0 ||
    mission.stops.some(
      (s) =>
        !validCoord(s.place) ||
        !Number.isFinite(s.stay) ||
        s.stay < 5 ||
        !Number.isFinite(s.walk) ||
        s.walk < 0 ||
        s.walk > s.stay,
    )
  )
    return null;
  const adjusted = adjustPlan(mission, origin.id, adjustment);
  if (!adjusted) return null;
  const before = assessPlan(mission, settings, origin, observedNow);
  const after = assessPlan(adjusted, settings, origin, observedNow);
  if (before.margin === null || after.margin === null) return null;
  return {
    adjusted,
    before,
    after,
    minutesGained: after.margin - before.margin,
    walkReduced: before.walk - after.walk,
  };
}
export const stopSignature = (mission: Mission) =>
  JSON.stringify(mission.stops.map((s) => [s.place.id, s.stay, s.walk]));

/** One projection shared by card UI, copy text, and exported SVG. No personal plan fields. */
export function dayRecord(entry: Entry, places: Place[]) {
  const region = regions.includes(entry.region as (typeof regions)[number])
    ? entry.region
    : '강원특별자치도';
  const visited = new Set(
    Array.isArray(entry.visitedPlaceIds) ? entry.visitedPlaceIds : [],
  );
  const planIds = new Set(entry.plan?.stops.map((s) => s.placeId) || []);
  const stops = (entry.plan?.stops || [])
    .flatMap((stop) => {
      const place = places.find(
        (p) =>
          p.id === stop.placeId &&
          visited.has(p.id) &&
          planIds.has(p.id) &&
          p.source !== 'manual' &&
          !p.id.startsWith('manual:') &&
          !sensitivePlaceText(p.title),
      );
      return place ? [place] : [];
    })
    .filter((p, i, all) => all.findIndex((v) => v.id === p.id) === i);
  return {
    region,
    title: region.replace(/[군시]$/, '') + '에서 보낸 하루',
    places: stops.map((p) => ({
      id: p.id,
      title: p.title,
      image_url: p.image_url,
      source: p.source,
      sigungu: p.sigungu,
    })),
    stamps: publicCard(entry).stamps,
    confirmed: entry.visitedPlaceIds !== undefined,
    missingCount: [...visited].filter(
      (id) =>
        planIds.has(id) &&
        !id.startsWith('manual:') &&
        !places.some((p) => p.id === id),
    ).length,
  };
}
export function dayRecordText(entry: Entry, places: Place[]) {
  const card = dayRecord(entry, places);
  if (card.missingCount) throw new Error('RECORD_PLACES_UNRESOLVED');
  return [
    card.title,
    card.places.map((p) => p.title).join(' · '),
    card.stamps.join(' · '),
    '기다리던 하루를, 함께. 군번여지도 강원',
  ]
    .filter(Boolean)
    .join('\n');
}
export function dayRecordSvg(entry: Entry, places: Place[]) {
  const card = dayRecord(entry, places);
  if (card.missingCount) throw new Error('RECORD_PLACES_UNRESOLVED');
  const escape = (text: string) =>
    text.replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&apos;',
        })[c]!,
    );
  const names = card.places.slice(0, 4);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080" role="img"><title>${escape(card.title)}</title><rect width="1080" height="1080" fill="#fff"/><path d="M80 100H1000" stroke="#244f6e" stroke-width="4"/><g font-family="sans-serif" fill="#183249"><text x="80" y="185" font-size="32">군번여지도 강원</text><text x="80" y="310" font-size="24" fill="#556978">하루의 한 장 · 내가 직접 남긴 기록</text><text x="80" y="395" font-size="58">${escape(card.title)}</text>${names.length ? names.map((p, i) => `<circle cx="96" cy="${485 + i * 74}" r="12" fill="#2d6287"/><text x="134" y="${497 + i * 74}" font-size="30">${escape(p.title.length > 26 ? p.title.slice(0, 25) + '…' : p.title)}</text>`).join('') : '<text x="80" y="510" font-size="28" fill="#556978">다녀온 하루를 기록했어요.</text>'}<text x="80" y="845" font-size="28" fill="#2d6287">${escape(card.stamps.join(' · '))}</text><path d="M80 908H1000" stroke="#dce4eb"/><text x="80" y="970" font-size="27">기다리던 하루를, 함께.</text></g></svg>`;
}
