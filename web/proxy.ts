import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { cookieValue, validTestSession } from './lib/test-access';

export async function proxy(request: Request) {
  const url = new URL(request.url);
  const publicPaths = [
    '/login',
    '/api/test-access',
    '/icon.svg',
    '/manifest.webmanifest',
    '/sw.js',
    '/offline.html',
    '/favicon.ico',
  ];
  if (
    publicPaths.includes(url.pathname) ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/')
  )
    return NextResponse.next();
  const secret = String(
    (env as Record<string, unknown>).TEST_SESSION_SECRET || '',
  );
  if (
    await validTestSession(cookieValue(request.headers.get('cookie')), secret)
  ) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  }
  if (url.pathname.startsWith('/api/'))
    return Response.json(
      {
        error: 'TEST_LOGIN_REQUIRED',
        message: '테스트 비밀번호로 먼저 입장해 주세요.',
      },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  const login = new URL('/login', url);
  const join = url.searchParams.get('join');
  if (join && /^[a-f0-9]{48}$/.test(join)) login.searchParams.set('join', join);
  return NextResponse.redirect(login, 307);
}
