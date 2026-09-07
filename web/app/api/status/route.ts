import { env } from 'cloudflare:workers';
import { publicDataKey } from '@/lib/api-config';
export function GET() {
  return Response.json(
    {
      tourApiConfigured: Boolean(
        publicDataKey(
          env as Record<string, unknown>,
          'TOUR_API_KOR_SERVICE_KEY',
        ),
      ),
      kakaoMapKey: String(
        (env as Record<string, unknown>).KAKAO_MAP_JAVASCRIPT_KEY || '',
      ),
      version: '0.1.0',
      storage: 'local-demo',
      gpsCollected: false,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
