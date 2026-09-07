export const TEST_COOKIE = 'gangwon_test_session';
export const SESSION_SECONDS = 60 * 60 * 12;
const encoder = new TextEncoder();
function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
async function signature(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
}
export function equalText(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
export async function createTestSession(secret: string, now = Date.now()) {
  if (secret.length < 32) throw new Error('TEST_ACCESS_UNCONFIGURED');
  const payload = 'v1.' + (Math.floor(now / 1000) + SESSION_SECONDS);
  return payload + '.' + (await signature(payload, secret));
}
export async function validTestSession(
  token: string | undefined,
  secret: string,
  now = Date.now(),
) {
  if (!token || secret.length < 32 || !/^v1\.\d{10}\.[a-f0-9]{64}$/.test(token))
    return false;
  const [version, expiry, mac] = token.split('.');
  const seconds = Math.floor(now / 1000);
  if (Number(expiry) <= seconds || Number(expiry) > seconds + SESSION_SECONDS)
    return false;
  return equalText(mac, await signature(version + '.' + expiry, secret));
}
export function cookieValue(cookie: string | null) {
  return cookie
    ?.split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith(TEST_COOKIE + '='))
    ?.slice(TEST_COOKIE.length + 1);
}
export function sessionCookie(token: string, secure: boolean, clear = false) {
  return `${TEST_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : SESSION_SECONDS}${secure ? '; Secure' : ''}`;
}
