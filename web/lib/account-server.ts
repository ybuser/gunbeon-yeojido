import { database, hashSecret } from './db';
import { env } from 'cloudflare:workers';
export const ACCOUNT_COOKIE = 'gunbeon_account';
export type Account = {
  id: string;
  nickname: string;
  handle: string | null;
  profileId: string;
};
export class AccountProblem extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const randomToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
export function readCookie(r: Request, name: string) {
  return (
    r.headers
      .get('cookie')
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith(name + '='))
      ?.slice(name.length + 1) || ''
  );
}
export function authCookie(
  r: Request,
  name: string,
  value: string,
  maxAge = 1209600,
) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(r.url).protocol === 'https:' ? '; Secure' : ''}`;
}
export async function currentAccount(r: Request): Promise<Account | null> {
  const token = readCookie(r, ACCOUNT_COOKIE);
  if (!/^[a-f0-9]{64}$/.test(token)) {
    const expected = r.headers.get('X-Gunbeon-Account');
    if (expected && expected !== 'guest')
      throw new AccountProblem(
        401,
        '로그인이 변경되었어요. 현재 내용을 백업하고 다시 로그인해 주세요.',
      );
    return null;
  }
  const a = await database()
    .prepare(
      'SELECT a.id,a.nickname,a.handle,a.profile_id AS profileId FROM accounts a JOIN account_sessions s ON s.account_id=a.id WHERE s.token_hash=? AND s.expires_at>?',
    )
    .bind(await hashSecret(token), Date.now())
    .first<Account>();
  const expected = r.headers.get('X-Gunbeon-Account');
  if (expected && expected !== (a?.id || 'guest'))
    throw new AccountProblem(
      409,
      '다른 창에서 로그인 계정이 바뀌었어요. 현재 내용을 백업한 뒤 화면을 새로 열어 주세요.',
    );
  return a;
}
export async function requireAccount(r: Request) {
  const a = await currentAccount(r);
  if (!a)
    throw new AccountProblem(
      401,
      '로그인이 만료되었어요. 다시 로그인해 주세요.',
    );
  return a;
}
export const accountAdviceHash = (id: string) =>
  hashSecret('account-advice:' + id);
export async function createAccount(
  nickname: string,
  handle: string | null = null,
  password: string | null = null,
  identity?: { provider: string; subject: string },
) {
  const id = crypto.randomUUID(),
    profileId = crypto.randomUUID(),
    now = new Date().toISOString();
  await database().batch([
    database()
      .prepare(
        'INSERT INTO profiles(id,token_hash,nickname,created_at) VALUES(?,?,?,?)',
      )
      .bind(profileId, 'account:' + id, nickname, now),
    database()
      .prepare(
        'INSERT INTO accounts(id,nickname,handle,password_hash,profile_id,created_at) VALUES(?,?,?,?,?,?)',
      )
      .bind(id, nickname, handle, password, profileId, now),
    ...(identity
      ? [
          database()
            .prepare(
              'INSERT INTO account_identities(provider,subject,account_id) VALUES(?,?,?)',
            )
            .bind(identity.provider, identity.subject, id),
        ]
      : []),
  ]);
  return { id, nickname, handle, profileId };
}
export async function newSession(r: Request, a: Account) {
  const token = randomToken(),
    db = database();
  await db.batch([
    db
      .prepare(
        'DELETE FROM account_sessions WHERE expires_at<? OR token_hash=?',
      )
      .bind(Date.now(), await hashSecret(readCookie(r, ACCOUNT_COOKIE))),
    db
      .prepare(
        'INSERT INTO account_sessions(token_hash,account_id,expires_at) VALUES(?,?,?)',
      )
      .bind(await hashSecret(token), a.id, Date.now() + 1209600000),
  ]);
  return authCookie(r, ACCOUNT_COOKIE, token);
}
export async function accountBody(
  r: Request,
  max = 8192,
): Promise<Record<string, any>> {
  if (
    r.headers.get('origin') !== new URL(r.url).origin ||
    !r.headers.get('content-type')?.includes('application/json')
  )
    throw new AccountProblem(403, '원래 화면에서 다시 시도해 주세요.');
  const reader = r.body?.getReader();
  if (!reader) throw new AccountProblem(400, '입력을 확인해 주세요.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new AccountProblem(413, '저장할 내용이 너무 큽니다.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let pos = 0;
  for (const c of chunks) {
    bytes.set(c, pos);
    pos += c.length;
  }
  try {
    const v = JSON.parse(new TextDecoder().decode(bytes));
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error();
    return v;
  } catch {
    throw new AccountProblem(400, '입력을 확인해 주세요.');
  }
}
export function accountReply(
  data: unknown,
  status = 200,
  cookies: string[] = [],
) {
  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'same-origin',
  });
  for (const c of cookies) headers.append('Set-Cookie', c);
  return Response.json(data, { status, headers });
}
export function accountError(e: unknown) {
  return accountReply(
    {
      message:
        e instanceof AccountProblem
          ? e.message
          : '계정 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
    },
    e instanceof AccountProblem ? e.status : 503,
  );
}
export async function authRate(
  r: Request,
  kind: string,
  max: number,
  actor = '',
) {
  // Hash with a server secret; raw network addresses never enter the database.
  const secret = String(
    (env as Record<string, unknown>).TEST_SESSION_SECRET || '',
  );
  if (secret.length < 32)
    throw new AccountProblem(503, '로그인 연결을 준비 중입니다.');
  const time = Date.now(),
    window = Math.floor(time / 900000);
  const id = await hashSecret(
    secret +
      ':auth:' +
      kind +
      ':' +
      window +
      ':' +
      (actor || r.headers.get('cf-connecting-ip') || 'local-edge'),
  );
  const row = await database()
    .prepare(
      'INSERT INTO advice_rate(id,count,expires_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count',
    )
    .bind(id, time + 900000)
    .first<{ count: number }>();
  await database()
    .prepare('DELETE FROM advice_rate WHERE expires_at<?')
    .bind(time)
    .run();
  if ((row?.count || 0) > max)
    throw new AccountProblem(
      429,
      '시도가 잠시 몰렸어요. 15분 뒤 다시 시도해 주세요.',
    );
}
