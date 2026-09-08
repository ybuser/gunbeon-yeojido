import { database, hashSecret } from './db';
export async function providerLimitId(
  service: string,
  method: string,
  key: string,
) {
  return service + ':' + method + ':' + (await hashSecret(key)).slice(0, 16);
}
export async function readProviderLimit(id: string) {
  try {
    const row = await database()
      .prepare(
        'SELECT error,retry_at AS retryAt FROM provider_limits WHERE id=? AND retry_at>?',
      )
      .bind(id, Date.now())
      .first<{ error: string; retryAt: number }>();
    return row;
  } catch {
    return null;
  }
}
export async function saveProviderLimit(id: string, error: string) {
  try {
    await database()
      .prepare(
        'INSERT INTO provider_limits(id,error,retry_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET error=excluded.error,retry_at=excluded.retry_at',
      )
      .bind(id, error, Date.now() + 10 * 60000)
      .run();
  } catch {}
}
