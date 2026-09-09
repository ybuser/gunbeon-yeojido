import { database } from '@/lib/db';
import { validSuggestion } from '@/lib/advice-model';
import type { AdviceSnapshot } from '@/lib/advice-model';
import { GET as tourismSearch } from '@/app/api/places/search/route';
import {
  randomId,
  adviceSession,
  adviceBody,
  adviceReply,
  adviceError,
  adviceRateLimit,
  AdviceProblem,
  validatePublicIds,
  findShare,
  shareDetail,
  publicPlace,
} from '@/lib/advice-server';
import type { Place } from '@/lib/domain';
const idFrom = (r: Request) => new URL(r.url).pathname.split('/').pop();
export async function GET(r: Request) {
  try {
    const row = await findShare(idFrom(r)),
      session = await adviceSession(r, true),
      url = new URL(r.url);
    if (url.searchParams.has('q')) {
      if (row.status !== 'open')
        throw new AdviceProblem(409, '이 여행의 제안은 마감됐어요.');
      await adviceRateLimit(r, 'search', 45);
      const snapshot = JSON.parse(row.payload) as AdviceSnapshot;
      const query = new URL('/api/places/search', url);
      query.searchParams.set('region', snapshot.region);
      query.searchParams.set('q', url.searchParams.get('q') || '');
      query.searchParams.set('page', url.searchParams.get('page') || '1');
      const response = await tourismSearch(new Request(query)),
        data = (await response.json()) as {
          places?: Place[];
          message?: string;
          error?: string;
          total?: number;
          page?: number;
        };
      return adviceReply(
        {
          ...data,
          ...(!response.ok
            ? {
                message:
                  '관광정보 검색을 연결하지 못했어요. 잠시 후 다시 검색하거나 지역 장소 후보에서 골라주세요.',
              }
            : {}),
          places: (data.places || []).map(publicPlace),
        },
        response.status,
        session.cookie,
      );
    }
    await adviceRateLimit(r, 'public-read', 60);
    return adviceReply(
      await shareDetail(
        row,
        session.hash,
        Math.max(1, Math.min(5, Number(url.searchParams.get('page')) || 1)),
      ),
      200,
      session.cookie,
    );
  } catch (e) {
    return adviceError(e);
  }
}
export async function POST(r: Request) {
  try {
    const b = await adviceBody(r),
      row = await findShare(
        idFrom(r),
        b.action === 'withdraw' || b.action === 'withdrawMine',
      ),
      session = await adviceSession(r),
      db = database();
    if (!session.hash)
      throw new AdviceProblem(401, '페이지를 새로 열고 다시 제안해 주세요.');
    if (row.owner_hash === session.hash && b.action === 'suggest')
      throw new AdviceProblem(
        400,
        '내 여행은 직접 수정하고, 다른 사람의 한 수를 기다려보세요.',
      );
    if (b.action === 'withdrawMine') {
      await db.batch([
        db
          .prepare(
            'DELETE FROM advice_reports WHERE suggestion_id IN (SELECT id FROM advice_suggestions WHERE share_id=? AND visitor_hash=?)',
          )
          .bind(row.id, session.hash),
        db
          .prepare(
            'DELETE FROM advice_suggestions WHERE share_id=? AND visitor_hash=?',
          )
          .bind(row.id, session.hash),
      ]);
      return adviceReply({ ok: true });
    }
    if (b.action === 'suggest') {
      if (row.status !== 'open')
        throw new AdviceProblem(409, '이 여행의 제안은 마감됐어요.');
      await adviceRateLimit(r, 'suggest', 20, 10);
      const snapshot = JSON.parse(row.payload) as AdviceSnapshot;
      if (!validSuggestion(b.suggestion, snapshot))
        throw new AdviceProblem(400, '대상 장소와 제안 이유를 확인해 주세요.');
      const s = b.suggestion,
        id = randomId();
      // One active proposal per visitor/share; a new proposal after withdrawal gets a fresh ID.
      const existing = await db
        .prepare(
          'SELECT id FROM advice_suggestions WHERE share_id=? AND visitor_hash=?',
        )
        .bind(row.id, session.hash)
        .first();
      if (existing)
        return adviceReply({
          id: (existing as { id: string }).id,
          existing: true,
        });
      if (s.placeId) await validatePublicIds([s.placeId]);
      const result = await db
        .prepare(
          "INSERT OR IGNORE INTO advice_suggestions(id,share_id,visitor_hash,kind,target_id,place_id,reason,status,created_at) SELECT ?,?,?,?,?,?,?,'pending',? WHERE EXISTS(SELECT 1 FROM advice_shares WHERE id=? AND status='open' AND expires_at>?) AND (SELECT COUNT(*) FROM advice_suggestions WHERE share_id=?)<60",
        )
        .bind(
          id,
          row.id,
          session.hash,
          s.kind,
          s.targetId,
          s.placeId,
          s.reason,
          new Date().toISOString(),
          row.id,
          new Date().toISOString(),
          row.id,
        )
        .run();
      if (!result.meta.changes) {
        const retried = await db
          .prepare(
            'SELECT id FROM advice_suggestions WHERE share_id=? AND visitor_hash=?',
          )
          .bind(row.id, session.hash)
          .first<{ id: string }>();
        if (retried) return adviceReply({ id: retried.id, existing: true });
        throw new AdviceProblem(
          409,
          '제안이 마감되었거나 충분히 모였어요. 페이지를 새로 확인해 주세요.',
        );
      }
      return adviceReply({ id }, 201);
    }
    const suggestionId = String(b.suggestionId || '');
    const s = await db
      .prepare(
        'SELECT id,visitor_hash AS visitorHash,status FROM advice_suggestions WHERE id=? AND share_id=?',
      )
      .bind(suggestionId, row.id)
      .first<{ id: string; visitorHash: string; status: string }>();
    if (!s) throw new AdviceProblem(404, '제안을 찾을 수 없어요.');
    if (b.action === 'withdraw') {
      if (s.visitorHash !== session.hash)
        throw new AdviceProblem(403, '내가 남긴 제안만 지울 수 있어요.');
      await db.batch([
        db
          .prepare('DELETE FROM advice_reports WHERE suggestion_id=?')
          .bind(s.id),
        db
          .prepare(
            'DELETE FROM advice_suggestions WHERE id=? AND visitor_hash=?',
          )
          .bind(s.id, session.hash),
      ]);
      return adviceReply({ ok: true });
    }
    if (b.action === 'report') {
      await adviceRateLimit(r, 'report', 20, 10);
      await db
        .prepare(
          'INSERT OR IGNORE INTO advice_reports(suggestion_id,visitor_hash) VALUES(?,?)',
        )
        .bind(s.id, session.hash)
        .run();
      return adviceReply({ ok: true });
    }
    throw new AdviceProblem(400, '요청을 확인해 주세요.');
  } catch (e) {
    return adviceError(e);
  }
}
