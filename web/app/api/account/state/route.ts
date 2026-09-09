import { database } from "@/lib/db";
import {
  accountBody,
  accountError,
  accountReply,
  AccountProblem,
  requireAccount,
} from "@/lib/account-server";
import { cleanTravelState } from "@/lib/account-state";
export async function GET(r: Request) {
  try {
    const a = await requireAccount(r);
    const row = await database()
      .prepare(
        "SELECT payload,revision,updated_at AS updatedAt FROM account_travel_state WHERE account_id=?",
      )
      .bind(a.id)
      .first<{ payload: string; revision: number; updatedAt: string }>();
    return accountReply({
      state: row ? JSON.parse(row.payload) : null,
      revision: row?.revision || 0,
      updatedAt: row?.updatedAt || null,
    });
  } catch (e) {
    return accountError(e);
  }
}
export async function POST(r: Request) {
  try {
    const a = await requireAccount(r),
      b = await accountBody(r, 1500000);
    if (!Number.isInteger(b.revision) || b.revision < 0)
      throw new AccountProblem(400, "저장 버전을 확인해 주세요.");
    let state;
    try {
      state = cleanTravelState(b.state);
    } catch {
      throw new AccountProblem(
        400,
        "여행 데이터 형식을 확인해 주세요. 변경 내용은 현재 화면에 남아 있습니다.",
      );
    }
    const now = new Date().toISOString(),
      db = database();
    const query =
      b.revision === 0
        ? db
            .prepare(
              "INSERT INTO account_travel_state(account_id,payload,revision,updated_at) VALUES(?,?,1,?) ON CONFLICT(account_id) DO NOTHING RETURNING revision",
            )
            .bind(a.id, JSON.stringify(state), now)
        : db
            .prepare(
              "UPDATE account_travel_state SET payload=?,revision=revision+1,updated_at=? WHERE account_id=? AND revision=? RETURNING revision",
            )
            .bind(JSON.stringify(state), now, a.id, b.revision);
    const row = await query.first<{ revision: number }>();
    if (!row)
      throw new AccountProblem(
        409,
        "다른 창이나 기기에서 여행이 변경됐어요. 현재 내용을 백업한 뒤 최신 기록을 불러와 주세요.",
      );
    return accountReply({ revision: row.revision, updatedAt: now });
  } catch (e) {
    return accountError(e);
  }
}
