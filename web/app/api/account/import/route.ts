import { database, hashSecret } from "@/lib/db";
import {
  accountBody,
  accountReply,
  accountError,
  accountAdviceHash,
  readCookie,
  requireAccount,
} from "@/lib/account-server";
import { legacyAdviceSession } from "@/lib/advice-server";
export async function POST(r: Request) {
  try {
    await accountBody(r);
    const a = await requireAccount(r),
      db = database();
    const token = readCookie(r, "gunbeon_member"),
      hash = await hashSecret(token);
    const p = /^[a-f0-9]{48}$/.test(token)
      ? await db
          .prepare(
            "SELECT id FROM profiles WHERE token_hash=? AND id NOT IN (SELECT profile_id FROM accounts)",
          )
          .bind(hash)
          .first<{ id: string }>()
      : null;
    const advice = await legacyAdviceSession(r),
      statements: D1PreparedStatement[] = [];
    if (p && p.id !== a.profileId) {
      statements.push(
        db
          .prepare(
            "INSERT INTO claimed_identities(kind,legacy_hash,account_id) VALUES('group',?,?)",
          )
          .bind(hash, a.id),
        db
          .prepare(
            "INSERT OR IGNORE INTO group_members(group_id,user_id,joined_at) SELECT group_id,?,joined_at FROM group_members WHERE user_id=?",
          )
          .bind(a.profileId, p.id),
        db.prepare("UPDATE travel_groups SET owner_id=? WHERE owner_id=?").bind(a.profileId, p.id),
        db.prepare("UPDATE group_plans SET author_id=? WHERE author_id=?").bind(a.profileId, p.id),
        db
          .prepare(
            "INSERT OR IGNORE INTO former_members(group_id,user_id,removed_at) SELECT group_id,?,removed_at FROM former_members WHERE user_id=?",
          )
          .bind(a.profileId, p.id),
        db.prepare("DELETE FROM group_members WHERE user_id=?").bind(p.id),
        db
          .prepare("UPDATE profiles SET token_hash=? WHERE id=?")
          .bind("claimed:" + a.id + ":" + p.id, p.id),
      );
    }
    if (advice.hash) {
      statements.push(
        db
          .prepare(
            "INSERT INTO claimed_identities(kind,legacy_hash,account_id) VALUES('advice',?,?)",
          )
          .bind(advice.hash, a.id),
        db
          .prepare("UPDATE advice_shares SET owner_hash=? WHERE owner_hash=?")
          .bind(await accountAdviceHash(a.id), advice.hash),
      );
    }
    if (statements.length) await db.batch(statements);
    return accountReply({ ok: true, groupsImported: !!p, sharesImported: !!advice.hash });
  } catch (e) {
    return accountError(e);
  }
}
