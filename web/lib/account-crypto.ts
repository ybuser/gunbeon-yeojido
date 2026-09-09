import { scrypt, timingSafeEqual, randomBytes } from 'node:crypto';
const hex = (v: Uint8Array) =>
  Array.from(v, (n) => n.toString(16).padStart(2, '0')).join('');
const derive = (password: string, salt: string) =>
  new Promise<Uint8Array>((resolve, reject) => {
    // OWASP's 16 MiB / p=5 scrypt profile fits the Workers memory budget.
    scrypt(
      password,
      salt,
      32,
      { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
export async function passwordHash(password: string) {
  const salt = hex(randomBytes(16));
  return `scrypt:16384:8:5:${salt}:${hex(await derive(password, salt))}`;
}
export async function passwordMatches(password: string, stored: string) {
  const fields = stored.split(':');
  if (
    fields.length !== 6 ||
    fields.slice(0, 4).join(':') !== 'scrypt:16384:8:5' ||
    !/^[a-f0-9]{32}$/.test(fields[4]) ||
    !/^[a-f0-9]{64}$/.test(fields[5])
  )
    return false;
  return timingSafeEqual(
    await derive(password, fields[4]),
    Buffer.from(fields[5], 'hex'),
  );
}
export const validHandle = (v: unknown): v is string =>
  typeof v === 'string' && /^[a-z0-9][a-z0-9_-]{3,29}$/.test(v);
export const validPassword = (v: unknown): v is string =>
  typeof v === 'string' && v.length >= 10 && v.length <= 128;
