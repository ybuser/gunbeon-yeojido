import { currentAccount, accountError } from './lib/account-server';
import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { cookieValue, validTestSession } from './lib/test-access';

export async function proxy(request: Request) {
  const url = new URL(request.url);
  const publicPaths = [
    '/login',
    '/account',
    '/privacy',
    '/about',
    '/api/account',
    '/api/auth/start',
    '/api/test-access',
    '/icon.svg',
    '/brand/google-g.png',
    '/brand/naver-n.png',
    '/icon-512.png',
    '/photos/goseong-observatory.jpg',
    '/photos/cheorwon-memorial.jpg',
    '/photos/cheorwon-labor.jpg',
    '/photos/hwacheon-dam.jpg',
    '/photos/goseong-wanggok.jpg',
    '/photos/yanggu-dutayeon.jpg',
    '/manifest.webmanifest',
    '/sw.js',
    '/offline.html',
    '/favicon.ico',
  ];
  if (
    publicPaths.includes(url.pathname) ||
    /^\/api\/auth\/callback\/(google|naver)$/.test(url.pathname) ||
    /^\/p\/[a-f0-9]{32}$/.test(url.pathname) ||
    /^\/api\/public-advice\/[a-f0-9]{32}$/.test(url.pathname) ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/')
  )
    return NextResponse.next();
  const secret = String(
    (env as Record<string, unknown>).TEST_SESSION_SECRET || '',
  );
  let account;
  try {
    account = await currentAccount(request);
  } catch (e) {
    return accountError(e);
  }
  if (
    account ||
    (await validTestSession(cookieValue(request.headers.get('cookie')), secret))
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
  if (url.pathname === '/guide') login.searchParams.set('next', 'guide');
  const advice = url.searchParams.get('advice');
  if (advice && /^[a-f0-9]{32}$/.test(advice))
    login.searchParams.set('advice', advice);
  const join = url.searchParams.get('join');
  if (join && /^[a-f0-9]{48}$/.test(join)) login.searchParams.set('join', join);
  return NextResponse.redirect(login, 307);
}
