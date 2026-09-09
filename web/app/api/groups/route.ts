import { currentAccount } from "@/lib/account-server";
import { database, hashSecret } from "@/lib/db";
import { cleanName, validSharedPlan, groupKinds } from "@/lib/group-model";
const COOKIE = "gunbeon_member";
type Profile = { id: string; nickname: string };
class Problem extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const random = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
function reply(data: unknown, status = 200, cookie?: string) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      ...(cookie ? { "Set-Cookie": cookie } : {}),
    },
  });
}
function tokenFrom(r: Request) {
  return (
    r.headers
      .get("cookie")
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(COOKIE + "="))
      ?.slice(COOKIE.length + 1) || ""
  );
}
async function profile(r: Request) {
  const a = await currentAccount(r);
  if (a) return { id: a.profileId, nickname: a.nickname };
  const token = tokenFrom(r);
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  return database()
    .prepare(
      "SELECT id,nickname FROM profiles WHERE token_hash=? AND id NOT IN (SELECT profile_id FROM accounts)",
    )
    .bind(await hashSecret(token))
    .first<Profile>();
}
async function requireMember(groupId: string, userId: string) {
  const g = await database()
    .prepare(
      "SELECT g.id,g.name,g.kind,g.owner_id AS ownerId FROM travel_groups g JOIN group_members m ON g.id=m.group_id WHERE g.id=? AND m.user_id=?",
    )
    .bind(groupId, userId)
    .first<{ id: string; name: string; kind: string; ownerId: string }>();
  if (!g)
    throw new Problem(403, "이 그룹에 접근할 수 없습니다. 초대 또는 참여 상태를 확인해 주세요.");
  return g;
}
async function detail(id: string, userId: string) {
  const g = await requireMember(id, userId),
    db = database();
  const members = await db
    .prepare(
      "SELECT p.id,p.nickname FROM profiles p JOIN group_members m ON m.user_id=p.id WHERE m.group_id=? ORDER BY m.joined_at",
    )
    .bind(id)
    .all();
  const plans = await db
    .prepare(
      "SELECT id,group_id AS groupId,author_id AS authorId,payload,version,updated_at AS updatedAt FROM group_plans WHERE group_id=? ORDER BY updated_at DESC",
    )
    .bind(id)
    .all<{
      id: string;
      groupId: string;
      authorId: string;
      payload: string;
      version: number;
      updatedAt: string;
    }>();
  return {
    ...g,
    members: members.results,
    memberCount: members.results.length,
    planCount: plans.results.length,
    plans: plans.results.map(({ payload, ...p }) => ({
      ...p,
      plan: JSON.parse(payload),
    })),
  };
}
export async function GET(r: Request) {
  try {
    const p = await profile(r);
    if (!p) return reply({ profile: null, groups: [] });
    const id = new URL(r.url).searchParams.get("id");
    if (id) return reply({ profile: p, group: await detail(id, p.id) });
    const groups = await database()
      .prepare(
        "SELECT g.id,g.name,g.kind,g.owner_id AS ownerId,(SELECT COUNT(*) FROM group_members WHERE group_id=g.id) AS memberCount,(SELECT COUNT(*) FROM group_plans WHERE group_id=g.id) AS planCount FROM travel_groups g JOIN group_members m ON m.group_id=g.id WHERE m.user_id=? ORDER BY g.created_at DESC",
      )
      .bind(p.id)
      .all();
    return reply({ profile: p, groups: groups.results });
  } catch (e) {
    return reply(
      {
        message:
          e instanceof Problem
            ? e.message
            : "그룹을 불러오지 못했습니다. 연결 상태를 확인해 주세요.",
      },
      e instanceof Problem ? e.status : 503,
    );
  }
}
export async function POST(r: Request) {
  let cookie: string | undefined;
  try {
    if (
      r.headers.get("origin") !== new URL(r.url).origin ||
      !r.headers.get("content-type")?.includes("application/json")
    )
      throw new Problem(403, "올바른 화면에서 다시 시도해 주세요.");
    const text = await r.text();
    if (text.length > 60000) throw new Problem(413, "공유할 내용이 너무 큽니다.");
    let b: Record<string, any>;
    try {
      b = JSON.parse(text);
      if (!b || typeof b !== "object" || Array.isArray(b)) throw new Error();
    } catch {
      throw new Problem(400, "입력을 확인해 주세요.");
    }
    const db = database(),
      now = new Date().toISOString();
    let p = await profile(r);
    if (!p && ["create", "join"].includes(b.action)) {
      const nickname = cleanName(b.nickname, 20);
      if (!nickname) throw new Problem(400, "그룹에서 사용할 이름을 입력해 주세요.");
      const token = random();
      p = { id: crypto.randomUUID(), nickname };
      await db
        .prepare("INSERT INTO profiles(id,token_hash,nickname,created_at) VALUES(?,?,?,?)")
        .bind(p.id, await hashSecret(token), nickname, now)
        .run();
      cookie = `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=15552000${new URL(r.url).protocol === "https:" ? "; Secure" : ""}`;
    }
    if (b.action === "preview") {
      const token = String(b.code || "")
        .trim()
        .toLowerCase();
      if (!/^[a-f0-9]{48}$/.test(token)) throw new Problem(404, "초대코드를 확인해 주세요.");
      const i = await db
        .prepare(
          "SELECT g.id,g.name,g.kind FROM group_invitations i JOIN travel_groups g ON g.id=i.group_id WHERE i.token_hash=? AND i.revoked=0 AND i.expires_at>?",
        )
        .bind(await hashSecret(token), now)
        .first();
      if (!i) throw new Problem(404, "만료되었거나 취소된 초대입니다.");
      return reply({ invitation: i });
    }
    if (!p) throw new Problem(401, "그룹을 만들거나 초대코드로 먼저 참여해 주세요.");
    if (b.action === "create") {
      const name = cleanName(b.name);
      if (!name || !Object.hasOwn(groupKinds, b.kind))
        throw new Problem(400, "그룹 이름과 유형을 선택해 주세요.");
      const count = await db
        .prepare("SELECT COUNT(*) AS n FROM group_members WHERE user_id=?")
        .bind(p.id)
        .first<{ n: number }>();
      if ((count?.n || 0) >= 20) throw new Problem(400, "그룹은 20개까지 참여할 수 있어요.");
      const id = crypto.randomUUID();
      await db.batch([
        db
          .prepare("INSERT INTO travel_groups(id,name,kind,owner_id,created_at) VALUES(?,?,?,?,?)")
          .bind(id, name, b.kind, p.id, now),
        db
          .prepare("INSERT INTO group_members(group_id,user_id,joined_at) VALUES(?,?,?)")
          .bind(id, p.id, now),
      ]);
      return reply({ group: await detail(id, p.id), profile: p }, 201, cookie);
    }
    if (b.action === "join") {
      const code = String(b.code || "")
        .trim()
        .toLowerCase();
      if (!/^[a-f0-9]{48}$/.test(code)) throw new Problem(404, "초대코드를 확인해 주세요.");
      const inv = await db
        .prepare(
          "SELECT group_id AS groupId,created_at AS createdAt FROM group_invitations WHERE token_hash=? AND revoked=0 AND expires_at>?",
        )
        .bind(await hashSecret(code), now)
        .first<{ groupId: string; createdAt: string }>();
      if (!inv) throw new Problem(404, "만료되었거나 취소된 초대입니다.");
      const former = await db
        .prepare(
          "SELECT removed_at AS removedAt FROM former_members WHERE group_id=? AND user_id=?",
        )
        .bind(inv.groupId, p.id)
        .first<{ removedAt: string }>();
      if (former && former.removedAt >= inv.createdAt)
        throw new Problem(
          403,
          "이전에 받은 초대로는 다시 참여할 수 없습니다. 관리자에게 새 초대를 요청해 주세요.",
        );
      await db
        .prepare(
          "INSERT OR IGNORE INTO group_members(group_id,user_id,joined_at) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM group_members WHERE group_id=?)<30 AND (SELECT COUNT(*) FROM group_members WHERE user_id=?)<20 AND EXISTS(SELECT 1 FROM group_invitations i WHERE i.token_hash=? AND i.revoked=0 AND i.expires_at>? AND NOT EXISTS(SELECT 1 FROM former_members f WHERE f.group_id=i.group_id AND f.user_id=? AND f.removed_at>=i.created_at))",
        )
        .bind(inv.groupId, p.id, now, inv.groupId, p.id, await hashSecret(code), now, p.id)
        .run();
      const group = await detail(inv.groupId, p.id);
      return reply({ group, profile: p }, 200, cookie);
    }
    const id = typeof b.groupId === "string" ? b.groupId : "";
    const g = await requireMember(id, p.id);
    if (b.action === "invite") {
      if (g.ownerId !== p.id) throw new Problem(403, "그룹 관리자만 초대할 수 있어요.");
      const code = random(),
        expiresAt = new Date(Date.now() + 72 * 3600000).toISOString();
      await db.batch([
        db.prepare("UPDATE group_invitations SET revoked=1 WHERE group_id=?").bind(id),
        db
          .prepare(
            "INSERT INTO group_invitations(id,group_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)",
          )
          .bind(crypto.randomUUID(), id, await hashSecret(code), expiresAt, now),
      ]);
      return reply({ code, expiresAt });
    }
    if (b.action === "revoke") {
      if (g.ownerId !== p.id) throw new Problem(403, "관리자만 초대를 취소할 수 있어요.");
      await db.prepare("UPDATE group_invitations SET revoked=1 WHERE group_id=?").bind(id).run();
      return reply({ ok: true });
    }
    if (b.action === "leave" || b.action === "remove") {
      const userId = b.action === "leave" ? p.id : String(b.userId || "");
      if (userId === g.ownerId) throw new Problem(400, "관리자는 그룹 삭제를 사용해 주세요.");
      if (b.action === "remove" && g.ownerId !== p.id)
        throw new Problem(403, "관리자만 멤버를 제외할 수 있어요.");
      await db.batch([
        db
          .prepare(
            "INSERT INTO former_members(group_id,user_id,removed_at) VALUES(?,?,?) ON CONFLICT(group_id,user_id) DO UPDATE SET removed_at=excluded.removed_at",
          )
          .bind(id, userId, now),
        db.prepare("DELETE FROM group_members WHERE group_id=? AND user_id=?").bind(id, userId),
      ]);
      return reply({ ok: true });
    }
    if (b.action === "deleteGroup") {
      if (g.ownerId !== p.id) throw new Problem(403, "관리자만 그룹을 삭제할 수 있어요.");
      await db.batch(
        [
          "DELETE FROM group_plans WHERE group_id=?",
          "DELETE FROM group_invitations WHERE group_id=?",
          "DELETE FROM group_members WHERE group_id=?",
          "DELETE FROM former_members WHERE group_id=?",
          "DELETE FROM travel_groups WHERE id=?",
        ].map((sql) => db.prepare(sql).bind(id)),
      );
      return reply({ ok: true });
    }
    if (b.action === "savePlan") {
      if (!validSharedPlan(b.plan)) throw new Problem(400, "여행 이름·날짜·장소를 확인해 주세요.");
      // Serialize the explicit model, ignoring arbitrary caller-supplied properties.
      const raw = b.plan;
      const payload = JSON.stringify({
        title: raw.title,
        region: raw.region,
        departureAt: raw.departureAt,
        transport: raw.transport,
        meetingId: raw.meetingId,
        stops: raw.stops.map((s: any) => ({
          placeId: s.placeId,
          stay: s.stay,
          walk: s.walk,
        })),
        manualPlaces: raw.manualPlaces.map((m: any) => ({
          id: m.id,
          title: m.title,
          address: m.address,
          lat: m.lat,
          lon: m.lon,
          sigungu: m.sigungu,
          category: m.category,
        })),
      });
      let planId = typeof b.planId === "string" ? b.planId : "";
      if (planId) {
        const result = await db
          .prepare(
            "UPDATE group_plans SET payload=?,version=version+1,updated_at=? WHERE id=? AND group_id=? AND version=? AND EXISTS(SELECT 1 FROM group_members WHERE group_id=? AND user_id=?)",
          )
          .bind(payload, now, planId, id, Number(b.version), id, p.id)
          .run();
        if (!result.meta.changes)
          throw new Problem(
            409,
            "다른 멤버가 먼저 수정했습니다. 최신 내용을 확인한 뒤 다시 편집해 주세요.",
          );
      } else {
        const count = await db
          .prepare("SELECT COUNT(*) AS n FROM group_plans WHERE group_id=?")
          .bind(id)
          .first<{ n: number }>();
        if ((count?.n || 0) >= 100)
          throw new Problem(400, "그룹 여행은 100개까지 저장할 수 있어요.");
        planId = crypto.randomUUID();
        await db
          .prepare(
            "INSERT INTO group_plans(id,group_id,author_id,payload,version,updated_at) SELECT ?,?,?,?,1,? WHERE EXISTS(SELECT 1 FROM group_members WHERE group_id=? AND user_id=?)",
          )
          .bind(planId, id, p.id, payload, now, id, p.id)
          .run();
      }
      return reply({ group: await detail(id, p.id), planId });
    }
    if (b.action === "deletePlan") {
      const plan = await db
        .prepare("SELECT author_id AS authorId FROM group_plans WHERE id=? AND group_id=?")
        .bind(String(b.planId), id)
        .first<{ authorId: string }>();
      if (!plan) throw new Problem(404, "이미 삭제된 여행입니다.");
      if (g.ownerId !== p.id && plan.authorId !== p.id)
        throw new Problem(403, "작성자와 관리자만 삭제할 수 있어요.");
      await db
        .prepare(
          "DELETE FROM group_plans WHERE id=? AND group_id=? AND EXISTS(SELECT 1 FROM group_members WHERE group_id=? AND user_id=?)",
        )
        .bind(String(b.planId), id, id, p.id)
        .run();
      return reply({ group: await detail(id, p.id) });
    }
    throw new Problem(400, "지원하지 않는 요청입니다.");
  } catch (e) {
    return reply(
      {
        message:
          e instanceof Problem
            ? e.message
            : "저장하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.",
      },
      e instanceof Problem ? e.status : 503,
      cookie,
    );
  }
}
