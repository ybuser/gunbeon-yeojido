import { env } from "cloudflare:workers";
import { database, hashSecret } from "@/lib/db";
import { passwordHash, passwordMatches, validHandle, validPassword } from "@/lib/account-crypto";
import {
  ACCOUNT_COOKIE,
  accountBody,
  accountReply,
  accountError,
  AccountProblem,
  currentAccount,
  requireAccount,
  createAccount,
  newSession,
  authCookie,
  readCookie,
  authRate,
} from "@/lib/account-server";
import { providerReady } from "@/lib/oauth-server";
import { cookieValue, validTestSession, equalText } from "@/lib/test-access";
export async function GET(r: Request) {
  try {
    const a = await currentAccount(r);
    const linked = a
      ? (
          await database()
            .prepare("SELECT provider FROM account_identities WHERE account_id=?")
            .bind(a.id)
            .all<{ provider: string }>()
        ).results.map((p) => p.provider)
      : [];
    return accountReply({
      account: a,
      providers: { google: providerReady("google"), naver: providerReady("naver") },
      linked,
    });
  } catch (e) {
    return accountError(e);
  }
}
export async function POST(r: Request) {
  try {
    const b = await accountBody(r),
      db = database();
    if (b.action === "logout") {
      await currentAccount(r);
      await db
        .prepare("DELETE FROM account_sessions WHERE token_hash=?")
        .bind(await hashSecret(readCookie(r, ACCOUNT_COOKIE)))
        .run();
      return accountReply(
        { ok: true },
        200,
        [ACCOUNT_COOKIE, "gunbeon_member", "gunbeon_advice", "gangwon_test_session"].map((c) =>
          authCookie(r, c, "", 0),
        ),
      );
    }
    if (b.action === "nickname") {
      const a = await requireAccount(r),
        nickname = String(b.nickname || "").trim();
      if (!nickname || nickname.length > 20)
        throw new AccountProblem(400, "별명을 1~20자로 입력해 주세요.");
      await db.batch([
        db.prepare("UPDATE accounts SET nickname=? WHERE id=?").bind(nickname, a.id),
        db.prepare("UPDATE profiles SET nickname=? WHERE id=?").bind(nickname, a.profileId),
      ]);
      return accountReply({ ok: true });
    }
    if (!["register", "login"].includes(b.action))
      throw new AccountProblem(400, "요청을 확인해 주세요.");
    const handle = String(b.handle || "")
      .trim()
      .toLowerCase();
    if (!validHandle(handle) || !validPassword(b.password))
      throw new AccountProblem(
        400,
        "아이디는 영문 소문자·숫자 4~30자, 비밀번호는 10~128자로 입력해 주세요.",
      );
    await authRate(r, "entry", 80);
    await authRate(r, "handle", 12, handle);
    let a;
    if (b.action === "register") {
      const vars = env as Record<string, unknown>,
        secret = String(vars.TEST_SESSION_SECRET || "");
      const admitted = await validTestSession(cookieValue(r.headers.get("cookie")), secret);
      if (
        !admitted &&
        (!vars.TEST_ACCESS_PASSWORD ||
          !equalText(String(b.testPassword || ""), String(vars.TEST_ACCESS_PASSWORD)))
      )
        throw new AccountProblem(403, "전달받은 체험 비밀번호를 입력해 주세요.");
      const nickname = String(b.nickname || "").trim();
      if (!nickname || nickname.length > 20)
        throw new AccountProblem(400, "별명을 1~20자로 입력해 주세요.");
      if (await db.prepare("SELECT id FROM accounts WHERE handle=?").bind(handle).first())
        throw new AccountProblem(409, "사용할 수 없는 아이디입니다. 다른 아이디를 입력해 주세요.");
      a = await createAccount(nickname, handle, await passwordHash(b.password));
    } else {
      const row = await db
        .prepare(
          "SELECT id,nickname,handle,profile_id AS profileId,password_hash AS passwordHash FROM accounts WHERE handle=?",
        )
        .bind(handle)
        .first<{
          id: string;
          nickname: string;
          handle: string;
          profileId: string;
          passwordHash: string;
        }>();
      // Unknown handles do the same expensive derivation as valid ones.
      const hash =
        row?.passwordHash ||
        "scrypt:16384:8:5:00000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000";
      const matches = await passwordMatches(b.password, hash);
      if (!row || !matches) throw new AccountProblem(401, "아이디 또는 비밀번호를 확인해 주세요.");
      a = { id: row.id, nickname: row.nickname, handle: row.handle, profileId: row.profileId };
    }
    return accountReply({ account: a }, 200, [await newSession(r, a)]);
  } catch (e) {
    return accountError(e);
  }
}
