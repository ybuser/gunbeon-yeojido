import library from './data/photo-library.json' with { type: 'json' };
import type { Place } from './domain.ts';
export const photoLibrary = library;
const normalize = (s: string) => s.replace(/\s|\([^)]*\)/g, '');
export function placePhoto(
  p: Pick<Place, 'title' | 'image_url'> &
    Partial<Pick<Place, 'source' | 'sigungu'>>,
) {
  if (p.source === 'manual') return undefined;
  return library.find(
    (photo) =>
      (!p.sigungu || p.sigungu === photo.region) &&
      photo.titles.some((t) => normalize(t) === normalize(p.title)),
  );
}
export function photoUrl(p: Parameters<typeof placePhoto>[0]) {
  return (
    placePhoto(p)?.url ||
    p.image_url?.replace(
      /^http:\/\/tong\.visitkorea\.or\.kr/,
      'https://tong.visitkorea.or.kr',
    ) ||
    ''
  );
}
export function withPhoto(p: Place): Place {
  return { ...p, image_url: photoUrl(p) };
}
