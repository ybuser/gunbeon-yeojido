import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from 'cloudflare:workers';
import { database, hashSecret } from './db';
import {
  AccountProblem,
  authCookie,
  currentAccount,
  createAccount,
  newSession,
  randomToken,
  readCookie,
  type Account,
} from './account-server';
const googleKeys = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
);
type Provider = 'google' | 'naver';
export function providerName(v: unknown): Provider {
  if (v !== 'google' && v !== 'naver')
    throw new AccountProblem(400, '로그인 제공자를 확인해 주세요.');
  return v;
}
function config(provider: Provider) {
  const e = env as Record<string, unknown>,
    prefix = provider.toUpperCase();
  return {
    id: String(e[prefix + '_CLIENT_ID'] || ''),
    secret: String(e[prefix + '_CLIENT_SECRET'] || ''),
    origin: String(e.AUTH_BASE_URL || '').replace(/\/$/, ''),
  };
}
export function providerReady(provider: Provider) {
  const c = config(provider);
  return !!(
    c.id &&
    c.secret &&
    /^https:\/\/[^/?#]+$|^http:\/\/localhost:3000$/.test(c.origin)
  );
}
export function safeReturnTo(v: unknown) {
  if (
    typeof v !== 'string' ||
    !v.startsWith('/') ||
    v.startsWith('//') ||
    /[\\\r\n]/.test(v) ||
    v.length > 300
  )
    return '/';
  return /^\/(?:\?|#|$)|^\/(?:account|guide)(?:\?|#|$)/.test(v) ? v : '/';
}
const callbackUrl = (p: Provider) =>
  config(p).origin + '/api/auth/callback/' + p;
export async function startOAuth(
  r: Request,
  p: Provider,
  link: boolean,
  returnTo: unknown,
) {
  if (!providerReady(p) || config(p).origin !== new URL(r.url).origin)
    throw new AccountProblem(
      503,
      '소셜 로그인 연결을 준비 중입니다. 지금은 아이디로 로그인해 주세요.',
    );
  const a = await currentAccount(r);
  if (link && !a)
    throw new AccountProblem(401, '먼저 연결할 여행 계정에 로그인해 주세요.');
  const state = randomToken(),
    cookie = randomToken(),
    verifier = randomToken(),
    c = config(p),
    db = database();
  await db.batch([
    db.prepare('DELETE FROM oauth_flows WHERE expires_at<?').bind(Date.now()),
    db
      .prepare(
        'INSERT INTO oauth_flows(state_hash,cookie_hash,provider,verifier,account_id,return_to,expires_at) VALUES(?,?,?,?,?,?,?)',
      )
      .bind(
        await hashSecret(state),
        await hashSecret(cookie),
        p,
        verifier,
        link ? a!.id : null,
        safeReturnTo(returnTo),
        Date.now() + 600000,
      ),
  ]);
  const url = new URL(
    p === 'google'
      ? 'https://accounts.google.com/o/oauth2/v2/auth'
      : 'https://nid.naver.com/oauth2.0/authorize',
  );
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', c.id);
  url.searchParams.set('redirect_uri', callbackUrl(p));
  url.searchParams.set('state', state);
  if (p === 'google') {
    url.searchParams.set('scope', 'openid');
    url.searchParams.set('nonce', state);
    url.searchParams.set('prompt', 'select_account');
    url.searchParams.set('code_challenge_method', 'S256');
    const bytes = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
    );
    url.searchParams.set(
      'code_challenge',
      btoa(String.fromCharCode(...bytes))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/, ''),
    );
  }
  return {
    url: url.href,
    cookie: authCookie(r, 'gunbeon_oauth_' + p, cookie, 600),
  };
}
export async function finishOAuth(r: Request, p: Provider) {
  const params = new URL(r.url).searchParams,
    state = params.get('state') || '',
    browser = readCookie(r, 'gunbeon_oauth_' + p);
  if (
    !providerReady(p) ||
    config(p).origin !== new URL(r.url).origin ||
    !/^[a-f0-9]{64}$/.test(state) ||
    !/^[a-f0-9]{64}$/.test(browser)
  )
    throw new AccountProblem(400, '로그인 요청을 다시 시작해 주세요.');
  // Consume only this browser's unexpired flow, atomically; replay never creates a session.
  const flow = await database()
    .prepare(
      'DELETE FROM oauth_flows WHERE state_hash=? AND cookie_hash=? AND provider=? AND expires_at>? RETURNING verifier,account_id AS accountId,return_to AS returnTo',
    )
    .bind(await hashSecret(state), await hashSecret(browser), p, Date.now())
    .first<{ verifier: string; accountId: string | null; returnTo: string }>();
  if (!flow || params.has('error') || !params.get('code'))
    throw new AccountProblem(
      400,
      '소셜 로그인이 완료되지 않았어요. 다시 시도해 주세요.',
    );
  const signedIn = await currentAccount(r);
  if (flow.accountId && signedIn?.id !== flow.accountId)
    throw new AccountProblem(
      401,
      '계정 연결 중 로그인이 변경됐어요. 내 계정에서 다시 연결해 주세요.',
    );
  const c = config(p),
    body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: c.id,
      client_secret: c.secret,
      code: params.get('code')!,
      redirect_uri: callbackUrl(p),
    });
  if (p === 'google') body.set('code_verifier', flow.verifier);
  else body.set('state', state);
  const response = await fetch(
    p === 'google'
      ? 'https://oauth2.googleapis.com/token'
      : 'https://nid.naver.com/oauth2.0/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(12000),
    },
  );
  const tokens = (await response.json()) as {
    access_token?: string;
    id_token?: string;
  };
  if (!response.ok || !tokens.access_token)
    throw new AccountProblem(
      502,
      '로그인 제공자의 응답을 확인하지 못했어요. 다시 시도해 주세요.',
    );
  let googleSubject: string | undefined;
  if (p === 'google') {
    if (!tokens.id_token)
      throw new AccountProblem(502, '로그인 토큰을 확인하지 못했어요.');
    const { payload } = await jwtVerify(tokens.id_token, googleKeys, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: c.id,
      algorithms: ['RS256'],
      requiredClaims: ['sub', 'exp', 'iat'],
    });
    if (payload.nonce !== state)
      throw new AccountProblem(400, '로그인 요청이 일치하지 않아요.');
    googleSubject = payload.sub;
  }
  // UserInfo subject must match the verified Google ID token; Naver supplies its app-scoped ID.
  const profileResponse = await fetch(
    p === 'google'
      ? 'https://openidconnect.googleapis.com/v1/userinfo'
      : 'https://openapi.naver.com/v1/nid/me',
    {
      headers: { Authorization: 'Bearer ' + tokens.access_token },
      signal: AbortSignal.timeout(12000),
    },
  );
  const profile = (await profileResponse.json()) as {
    sub?: string;
    resultcode?: string;
    response?: { id?: string };
  };
  const subject =
    p === 'google'
      ? profile.sub
      : profile.resultcode === '00'
        ? profile.response?.id
        : null;
  if (p === 'google' && subject !== googleSubject)
    throw new AccountProblem(502, '로그인 정보가 일치하지 않아요.');
  if (
    !profileResponse.ok ||
    typeof subject !== 'string' ||
    !subject ||
    subject.length > 255
  )
    throw new AccountProblem(502, '로그인 식별자를 확인하지 못했어요.');
  const identity = await database()
    .prepare(
      'SELECT account_id AS accountId FROM account_identities WHERE provider=? AND subject=?',
    )
    .bind(p, subject)
    .first<{ accountId: string }>();
  let a: Account;
  if (flow.accountId) {
    if (identity && identity.accountId !== flow.accountId)
      throw new AccountProblem(
        409,
        '이미 다른 여행 계정에 연결된 소셜 계정입니다.',
      );
    a = signedIn!;
  } else if (identity) {
    const found = await database()
      .prepare(
        'SELECT id,nickname,handle,profile_id AS profileId FROM accounts WHERE id=?',
      )
      .bind(identity.accountId)
      .first<Account>();
    if (!found)
      throw new AccountProblem(503, '연결된 계정을 확인하지 못했어요.');
    a = found;
  } else {
    try {
      a = await createAccount('강원 여행자', null, null, {
        provider: p,
        subject,
      });
    } catch (e) {
      const raced = await database()
        .prepare(
          'SELECT a.id,a.nickname,a.handle,a.profile_id AS profileId FROM accounts a JOIN account_identities i ON i.account_id=a.id WHERE i.provider=? AND i.subject=?',
        )
        .bind(p, subject)
        .first<Account>();
      if (!raced) throw e;
      a = raced;
    }
  }
  if (!identity && flow.accountId)
    await database()
      .prepare(
        'INSERT INTO account_identities(provider,subject,account_id) VALUES(?,?,?)',
      )
      .bind(p, subject, a.id)
      .run();
  return {
    returnTo: flow.accountId
      ? '/account?connected=' + p
      : safeReturnTo(flow.returnTo),
    cookies: [
      await newSession(r, a),
      authCookie(r, 'gunbeon_oauth_' + p, '', 0),
    ],
  };
}
