import { env } from 'cloudflare:workers';
import { createTestSession, equalText, sessionCookie } from '@/lib/test-access';
function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}
export async function POST(request: Request) {
  if (
    !sameOrigin(request) ||
    !request.headers.get('content-type')?.includes('application/json')
  )
    return Response.json({ error: 'INVALID_REQUEST' }, { status: 403 });
  const bindings = env as Record<string, unknown>;
  const password = String(bindings.TEST_ACCESS_PASSWORD || '');
  const secret = String(bindings.TEST_SESSION_SECRET || '');
  if (!password || secret.length < 32)
    return Response.json(
      { message: '테스트 입장을 준비 중입니다. 잠시 후 다시 시도해 주세요.' },
      { status: 503 },
    );
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json(
      { message: '비밀번호를 다시 입력해 주세요.' },
      { status: 400 },
    );
  }
  const submitted = (input as { password?: unknown })?.password;
  if (
    typeof submitted !== 'string' ||
    submitted.length > 100 ||
    !equalText(submitted, password)
  )
    return Response.json(
      { message: '비밀번호가 맞지 않습니다.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  return Response.json(
    { ok: true },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Set-Cookie': sessionCookie(
          await createTestSession(secret),
          new URL(request.url).protocol === 'https:',
        ),
      },
    },
  );
}
export function DELETE(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: 'INVALID_REQUEST' }, { status: 403 });
  return Response.json(
    { ok: true },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Set-Cookie': sessionCookie(
          '',
          new URL(request.url).protocol === 'https:',
          true,
        ),
      },
    },
  );
}
