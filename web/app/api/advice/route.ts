import { database } from "@/lib/db";
import { validAdviceSnapshot } from "@/lib/advice-model";
import {
  adviceSession,
  adviceBody,
  adviceReply,
  adviceError,
  adviceRateLimit,
  AdviceProblem,
  randomId,
  validatePublicIds,
  findShare,
  shareDetail,
} from "@/lib/advice-server";
export async function GET(r: Request) {
  try {
    const session = await adviceSession(r);
    const id = new URL(r.url).searchParams.get("id");
    if (id) {
      const row = await findShare(id, true);
      if (row.owner_hash !== session.hash)
        throw new AdviceProblem(
          403,
          "이 공유를 관리할 수 없어요. 만든 계정 또는 브라우저에서 열어주세요.",
        );
      return adviceReply(
        await shareDetail(
          row,
          session.hash,
          Math.max(1, Math.min(5, Number(new URL(r.url).searchParams.get("page")) || 1)),
          session.accountId,
        ),
      );
    }
    if (!session.hash) return adviceReply({ shares: [] });
    const rows = await database()
      .prepare(
        "SELECT id,payload,status,expires_at AS expiresAt FROM advice_shares WHERE owner_hash=? AND expires_at>? ORDER BY created_at DESC",
      )
      .bind(session.hash, new Date().toISOString())
      .all<{
        id: string;
        payload: string;
        status: string;
        expiresAt: string;
      }>();
    return adviceReply({
      shares: rows.results.map(({ payload, ...s }) => ({
        ...s,
        snapshot: JSON.parse(payload),
      })),
    });
  } catch (e) {
    return adviceError(e);
  }
}
export async function POST(r: Request) {
  try {
    const b = await adviceBody(r),
      session = await adviceSession(r, b.action === "create"),
      db = database();
    if (b.action === "create") {
      await adviceRateLimit(r, "publish", 12, 10);
      if (!validAdviceSnapshot(b.snapshot))
        throw new AdviceProblem(400, "공개할 관광지와 질문을 확인해 주세요.");
      const s = b.snapshot;
      await validatePublicIds(s.placeIds);
      const count = await db
        .prepare("SELECT COUNT(*) AS n FROM advice_shares WHERE owner_hash=? AND expires_at>?")
        .bind(session.hash, new Date().toISOString())
        .first<{ n: number }>();
      if ((count?.n || 0) >= 30)
        throw new AdviceProblem(
          400,
          "공유 중인 여행이 30개예요. 지난 공유를 정리한 뒤 다시 만들어 주세요.",
        );
      const id = randomId(),
        snapshot = {
          region: s.region,
          question: s.question,
          placeIds: s.placeIds,
        };
      await db
        .prepare(
          "INSERT INTO advice_shares(id,owner_hash,payload,status,created_at,expires_at) VALUES(?,?,?,'open',?,?)",
        )
        .bind(
          id,
          session.hash,
          JSON.stringify(snapshot),
          new Date().toISOString(),
          new Date(Date.now() + 30 * 86400000).toISOString(),
        )
        .run();
      return adviceReply({ id, snapshot }, 201, session.cookie);
    }
    const row = await findShare(b.id, true);
    if (!session.hash || row.owner_hash !== session.hash)
      throw new AdviceProblem(
        403,
        "이 공유를 관리할 수 없어요. 만든 계정 또는 브라우저에서 열어주세요.",
      );
    if (b.action === "delete") {
      await db.batch([
        db
          .prepare(
            "DELETE FROM advice_reports WHERE suggestion_id IN (SELECT id FROM advice_suggestions WHERE share_id=?)",
          )
          .bind(row.id),
        db.prepare("DELETE FROM advice_suggestions WHERE share_id=?").bind(row.id),
        db
          .prepare("DELETE FROM advice_shares WHERE id=? AND owner_hash=?")
          .bind(row.id, session.hash),
      ]);
      return adviceReply({ deleted: true });
    }
    if (b.action === "close" || b.action === "reopen") {
      if (b.action === "reopen" && row.expires_at <= new Date().toISOString())
        throw new AdviceProblem(
          409,
          "공유 기간이 끝났어요. 기존 링크를 삭제한 뒤 새로 공유해 주세요.",
        );
      await db
        .prepare("UPDATE advice_shares SET status=? WHERE id=? AND owner_hash=?")
        .bind(b.action === "close" ? "closed" : "open", row.id, session.hash)
        .run();
      return adviceReply({ ok: true });
    }
    if (["adopt", "unmark", "hide"].includes(String(b.action))) {
      const s = await db
        .prepare("SELECT id,status FROM advice_suggestions WHERE id=? AND share_id=?")
        .bind(String(b.suggestionId || ""), row.id)
        .first<{ id: string; status: string }>();
      if (!s) throw new AdviceProblem(404, "제안을 찾을 수 없어요.");
      if (s.status === "hidden" && b.action === "adopt")
        throw new AdviceProblem(409, "숨긴 제안은 반영할 수 없어요.");
      const updated = await db
        .prepare("UPDATE advice_suggestions SET status=? WHERE id=? AND share_id=?")
        .bind(
          b.action === "adopt" ? "adopted" : b.action === "hide" ? "hidden" : "pending",
          s.id,
          row.id,
        )
        .run();
      if (!updated.meta.changes)
        throw new AdviceProblem(409, "제안이 삭제되었어요. 새로 확인해 주세요.");
      return adviceReply({ ok: true });
    }
    throw new AdviceProblem(400, "요청을 확인해 주세요.");
  } catch (e) {
    return adviceError(e);
  }
}
