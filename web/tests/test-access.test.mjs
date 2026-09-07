import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestSession, validTestSession, sessionCookie, cookieValue } from '../lib/test-access.ts';
const secret = 'test-only-signing-key-which-is-over-32-characters';
test('test gate rejects tampered, expired and missing-key sessions', async () => {
  const now = Date.now(), token = await createTestSession(secret, now);
  assert(await validTestSession(token, secret, now));
  assert.equal(await validTestSession(token, 'other-signing-key-over-thirty-two-characters', now), false);
  assert.equal(await validTestSession(token, secret, now + 13 * 3600000), false);
  assert.equal(await validTestSession(token.replace('v1.', 'v2.'), secret, now), false);
  assert.equal(await validTestSession(undefined, secret), false);
  assert.equal(await validTestSession(token, ''), false);
  assert.equal(cookieValue('a=b; gangwon_test_session=' + token), token);
  const cookie = sessionCookie(token, true);
  assert(cookie.includes('HttpOnly; SameSite=Lax; Max-Age=43200; Secure'));
});
