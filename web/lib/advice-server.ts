import { env } from 'cloudflare:workers';
import { database, hashSecret } from './db';
import { equalText } from './test-access';
import rawPlaces from './data/places.json';
import { regions, sensitivePlaceText, type Place } from './domain';
import { tourRequest, tourPlace } from './tour-api';
import { publicDataKey } from './api-config';
import {
  adviceIdValid,
  type AdviceSnapshot,
  type PublicPlace,
  type AdviceSuggestion,
} from './advice-model';
export class AdviceProblem extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const COOKIE = 'gunbeon_advice';
const secret = () =>
  String((env as Record<string, unknown>).TEST_SESSION_SECRET || '');
async function sign(value: string) {
  if (secret().length < 32)
    throw new AdviceProblem(503, '공유 연결을 준비 중입니다.');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)),
    ),
    (n) => n.toString(16).padStart(2, '0'),
  ).join('');
}
export const randomId = () => crypto.randomUUID().replaceAll('-', '');
export async function adviceSession(r: Request, create = false) {
  const raw =
    r.headers
      .get('cookie')
      ?.split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith(COOKIE + '='))
      ?.slice(COOKIE.length + 1) || '';
  if (/^[a-f0-9]{32}\.[a-f0-9]{64}$/.test(raw)) {
    const [id, mac] = raw.split('.');
    if (equalText(mac, await sign(id)))
      return { hash: await hashSecret(raw), cookie: undefined };
  }
  if (!create) return { hash: '', cookie: undefined };
  const id = randomId(),
    token = id + '.' + (await sign(id));
  return {
    hash: await hashSecret(token),
    cookie: `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=15552000${new URL(r.url).protocol === 'https:' ? '; Secure' : ''}`,
  };
}
export function adviceReply(value: unknown, status = 200, cookie?: string) {
  return Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      ...(cookie ? { 'Set-Cookie': cookie } : {}),
    },
  });
}
export function adviceError(e: unknown) {
  return adviceReply(
    {
      message:
        e instanceof AdviceProblem
          ? e.message
          : '연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.',
    },
    e instanceof AdviceProblem ? e.status : 503,
  );
}
export async function adviceBody(r: Request) {
  if (
    r.headers.get('origin') !== new URL(r.url).origin ||
    !r.headers.get('content-type')?.includes('application/json')
  )
    throw new AdviceProblem(403, '원래 화면에서 다시 시도해 주세요.');
  // Read a bounded stream, including when Content-Length is absent.
  const reader = r.body?.getReader();
  if (!reader) throw new AdviceProblem(400, '내용을 확인해 주세요.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) {
      await reader.cancel();
      throw new AdviceProblem(413, '내용이 너무 큽니다.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    const b = JSON.parse(new TextDecoder().decode(bytes));
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error();
    return b as Record<string, unknown>;
  } catch {
    throw new AdviceProblem(400, '내용을 확인해 주세요.');
  }
}
export async function adviceRateLimit(
  r: Request,
  kind: string,
  max: number,
  minutes = 1,
) {
  const time = Date.now(),
    window = Math.floor(time / (minutes * 60000));
  // Attribute ordinary use to a signed browser session, not a shared carrier/NAT address.
  // Fresh sessions have a broader edge burst guard; never store raw IPs or trust forwarding chains.
  const session = await adviceSession(r);
  const edge = r.headers.get('cf-connecting-ip') || 'local-edge';
  const actor = session.hash ? 'session:' + session.hash : 'entry:' + edge;
  const ceiling = session.hash ? max : max * 20;
  const id = await sign(kind + ':' + window + ':' + actor);
  const db = database();
  const row = await db
    .prepare(
      'INSERT INTO advice_rate(id,count,expires_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count',
    )
    .bind(id, time + minutes * 60000)
    .first<{ count: number }>();
  if ((row?.count || 0) > ceiling)
    throw new AdviceProblem(
      429,
      '요청이 잠시 몰렸어요. 잠깐 뒤 다시 시도해 주세요.',
    );
  await db
    .prepare('DELETE FROM advice_rate WHERE expires_at<?')
    .bind(time)
    .run();
}
export const catalog = (rawPlaces as Place[]).filter(
  (p) =>
    regions.includes(p.sigungu as (typeof regions)[number]) &&
    !sensitivePlaceText(p.title),
);
export const publicPlace = (p: Place): PublicPlace => ({
  id: p.id,
  title: p.title,
  image_url: p.image_url,
  source: p.source,
  sigungu: p.sigungu,
});
export async function resolvePublicPlace(id: string): Promise<Place | null> {
  const local = catalog.find((p) => p.id === id);
  if (local) return local;
  if (!/^tourapi:\d{1,12}$/.test(id)) return null;
  try {
    const key = publicDataKey(
      env as Record<string, unknown>,
      'TOUR_API_KOR_SERVICE_KEY',
    );
    const result = await tourRequest('KorService2', 'detailCommon2', key, {
      contentId: id.split(':')[1],
    });
    const row = result.items[0];
    const region = row && regions.find((r) => String(row.addr1).includes(r));
    if (!row || !region || !String(row.addr1).includes('강원')) return null;
    const p = tourPlace(row, region);
    return sensitivePlaceText(p.title) ? null : p;
  } catch {
    return null;
  }
}
export async function validatePublicIds(ids: string[]) {
  const results = await Promise.all(ids.map(resolvePublicPlace));
  if (results.some((p) => !p))
    throw new AdviceProblem(
      422,
      '일부 관광지를 확인하지 못했어요. 관광정보가 다시 연결되면 시도하거나 해당 장소를 제외해 주세요.',
    );
  return results as Place[];
}
export type ShareRow = {
  id: string;
  owner_hash: string;
  payload: string;
  status: 'open' | 'closed';
  expires_at: string;
};
export async function findShare(id: unknown, includeExpired = false) {
  if (!adviceIdValid(id))
    throw new AdviceProblem(404, '공유 링크를 찾을 수 없어요.');
  const row = await database()
    .prepare('SELECT * FROM advice_shares WHERE id=?')
    .bind(id)
    .first<ShareRow>();
  if (!row) throw new AdviceProblem(404, '끝났거나 삭제된 공유입니다.');
  if (!includeExpired && row.expires_at <= new Date().toISOString())
    throw new AdviceProblem(
      410,
      '공유 기간이 끝났어요. 작성자는 내 여행에서 링크를 삭제할 수 있습니다.',
    );
  return row;
}
export async function shareDetail(row: ShareRow, hash: string, page = 1) {
  const snapshot = JSON.parse(row.payload) as AdviceSnapshot,
    owner = row.owner_hash === hash;
  const db = database(),
    offset = (Math.max(1, Math.min(5, page)) - 1) * 12;
  const suggestions = await db
    .prepare(
      "SELECT id,kind,target_id AS targetId,place_id AS placeId,reason,status,visitor_hash AS visitorHash FROM advice_suggestions WHERE share_id=? AND (status<>'hidden' OR ?=1 OR visitor_hash=?) ORDER BY created_at DESC LIMIT 13 OFFSET ?",
    )
    .bind(row.id, owner ? 1 : 0, hash, offset)
    .all<AdviceSuggestion & { visitorHash: string }>();
  const reports = owner
    ? await db
        .prepare(
          'SELECT DISTINCT r.suggestion_id FROM advice_reports r JOIN advice_suggestions s ON r.suggestion_id=s.id WHERE s.share_id=?',
        )
        .bind(row.id)
        .all<{ suggestion_id: string }>()
    : hash
      ? await db
          .prepare(
            'SELECT suggestion_id FROM advice_reports WHERE visitor_hash=?',
          )
          .bind(hash)
          .all<{ suggestion_id: string }>()
      : { results: [] };
  const visible = suggestions.results.slice(0, 12);
  const own = hash
    ? await db
        .prepare(
          'SELECT id,kind,target_id AS targetId,place_id AS placeId,reason,status,visitor_hash AS visitorHash FROM advice_suggestions WHERE share_id=? AND visitor_hash=?',
        )
        .bind(row.id, hash)
        .first<AdviceSuggestion & { visitorHash: string }>()
    : null;
  if (own && !visible.some((s) => s.id === own.id)) visible.push(own);
  const ids = [
    ...new Set([
      ...snapshot.placeIds,
      ...visible.flatMap((s) => (s.placeId ? [s.placeId] : [])),
    ]),
  ];
  // A page receives only whitelisted public fields; provider responses stay transient.
  const resolved = await Promise.all(ids.map(resolvePublicPlace));
  return {
    page,
    hasMore: suggestions.results.length > 12,
    id: row.id,
    snapshot,
    status: row.status,
    owner,
    expiresAt: row.expires_at,
    places: resolved.flatMap((p) => (p ? [publicPlace(p)] : [])),
    missing: ids.filter((_, i) => !resolved[i]),
    candidates: catalog
      .filter(
        (p) =>
          p.sigungu === snapshot.region && !snapshot.placeIds.includes(p.id),
      )
      .map(publicPlace),
    suggestions: visible.map(({ visitorHash, ...s }) => ({
      ...s,
      own: visitorHash === hash,
      reported: reports.results.some((r) => r.suggestion_id === s.id),
    })),
  };
}
