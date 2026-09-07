import places from '@/lib/data/places.json';
export function GET() {
  // Only the separately licensed DMZ/MPVA sources are stored here; never a cached TourAPI response.
  return Response.json(
    { places, source: '통일부·국가보훈부 공개 원천', version: '2026-09-07' },
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  );
}
