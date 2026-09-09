'use client';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Cloud,
  UserRound,
  Download,
} from 'lucide-react';
import Brand from './brand';
import TestAccessForm from './test-access-form';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  accountRequest,
  bindAccountContext,
  GUEST_STORAGE,
  downloadTravelBackup,
  type AccountStatus,
} from '@/lib/account-client';
import { cleanTravelState, type TravelState } from '@/lib/account-state';
import { mergeDeviceTravel } from '@/lib/account-import';

function returnTo() {
  const params = new URLSearchParams(location.search),
    advice = params.get('advice'),
    join = params.get('join');
  return advice && /^[a-f0-9]{32}$/.test(advice)
    ? '/?advice=' + advice
    : join && /^[a-f0-9]{48}$/.test(join)
      ? '/?join=' + join + '#groups'
      : params.get('next') === 'guide'
        ? '/guide'
        : '/';
}
export default function AccountPage() {
  const [session, setSession] = useState<AccountStatus | null>(null),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'login' | 'register' | 'guest'>('login');
  const [handle, setHandle] = useState(''),
    [password, setPassword] = useState(''),
    [nickname, setNickname] = useState(''),
    [testPassword, setTestPassword] = useState('');
  const [legacy, setLegacy] = useState<TravelState | null>(null),
    [importing, setImporting] = useState(false);
  useEffect(() => {
    accountRequest<AccountStatus>('/api/account')
      .then((s) => {
        setSession(s);
        bindAccountContext(s.account?.id || null);
        setNickname(s.account?.nickname || '');
      })
      .catch((e) => setError(e.message));
    if (new URLSearchParams(location.search).has('authError'))
      setError(
        '소셜 로그인이 완료되지 않았어요. 계정 연결 또는 제공자 설정을 확인하고 다시 시도해 주세요.',
      );
    try {
      const raw = localStorage.getItem(GUEST_STORAGE);
      if (raw) setLegacy(cleanTravelState(JSON.parse(raw)));
    } catch {
      setError(
        '이 기기의 이전 기록을 읽지 못했어요. 원본은 그대로 보관되어 있습니다.',
      );
    }
  }, []);
  async function social(provider: 'google' | 'naver', link = false) {
    setBusy(true);
    setError('');
    try {
      const data = await accountRequest<{ url: string }>('/api/auth/start', {
        provider,
        link,
        returnTo: returnTo(),
      });
      location.assign(data.url);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function importDevice() {
    setBusy(true);
    setError('');
    try {
      const data = await accountRequest<{
        state: TravelState | null;
        revision: number;
      }>('/api/account/state');
      if (legacy) {
        const state = mergeDeviceTravel(data.state, legacy);
        await accountRequest('/api/account/state', {
          state,
          revision: data.revision,
        });
      }
      await accountRequest('/api/account/import', {});
      localStorage.removeItem(GUEST_STORAGE);
      setLegacy(null);
      setImporting(false);
      setMessage(
        '이 기기의 여행과 참여 권한을 계정에 연결했어요. 내 여행에서 확인해 주세요.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (mode === 'guest')
    return (
      <>
        <a
          className="guest-back"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setMode('login');
          }}
        >
          <ArrowLeft size={16} /> 계정 로그인으로
        </a>
        <TestAccessForm />
      </>
    );
  return (
    <main className="account-page" data-ready={!!session}>
      <a href="/" className="account-brand" aria-label="군번여지도 홈">
        <Brand />
      </a>
      <section className="account-panel">
        {session?.account ? (
          <>
            <p className="account-eyebrow">내 여행 계정</p>
            <h1>
              {session.account.nickname}님의
              <br />
              다음 여행도 이어서.
            </h1>
            <p className="account-lead">
              <Cloud size={18} /> 여행 계획·기록·즐겨찾기를 계정에 보관해요.
            </p>
            <a href="/#passport" className="account-primary-link">
              내 여행으로 <ArrowRight size={17} />
            </a>
            <form
              className="account-form account-profile"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  await accountRequest('/api/account', {
                    action: 'nickname',
                    nickname,
                  });
                  setSession({
                    ...session,
                    account: { ...session.account!, nickname },
                  });
                  setMessage('별명을 변경했어요.');
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label htmlFor="account-nickname">여행에서 사용할 별명</label>
              <div className="account-inline">
                <Input
                  id="account-nickname"
                  value={nickname}
                  maxLength={20}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                />
                <Button variant="outline" disabled={busy}>
                  변경
                </Button>
              </div>
              {session.account.handle && (
                <small>로그인 아이디 · {session.account.handle}</small>
              )}
            </form>
            <section className="account-section">
              <h2>로그인 연결</h2>
              <p>연결하면 같은 여행 계정을 소셜 로그인으로 사용할 수 있어요.</p>
              {(['google', 'naver'] as const).map((p) => (
                <button
                  className={`social-login ${p}`}
                  key={p}
                  disabled={
                    busy || !session.providers[p] || session.linked.includes(p)
                  }
                  onClick={() => void social(p, true)}
                >
                  <img
                    className={p === 'naver' ? 'social-n' : 'social-g'}
                    src={
                      p === 'google'
                        ? '/brand/google-g.png'
                        : '/brand/naver-n.png'
                    }
                    alt=""
                  />
                  {p === 'google' ? 'Google' : '네이버'}{' '}
                  {session.linked.includes(p) ? (
                    <>
                      <Check size={17} /> 연결됨
                    </>
                  ) : session.providers[p] ? (
                    '연결하기'
                  ) : (
                    '연결 준비 중'
                  )}
                </button>
              ))}
            </section>
            <section className="account-section">
              <h2>이 기기에서 시작한 여행</h2>
              <p>
                로그인 전에 만든 여행과 그룹·공유 링크를 내 계정으로 가져올 수
                있어요. 기존 계정 기록은 보존합니다.
              </p>
              <Button
                variant="outline"
                onClick={() => setImporting(!importing)}
                disabled={busy}
              >
                이 기기의 여행·그룹 연결
              </Button>
              {importing && (
                <div className="account-import-confirm">
                  <b>계정으로 가져올까요?</b>
                  <p>
                    여행 {legacy?.entries.length || 0}개 · 즐겨찾기{' '}
                    {legacy?.favorites.length || 0}개와 이 기기의 그룹·공유 관리
                    권한을 연결합니다. 기존 기록과 겹치면서 내용이 다른 여행은 사본으로 보관하고,
                    현재 출타가 이미 있으면 그대로 유지해요.
                  </p>
                  <div className="account-inline">
                    <Button disabled={busy} onClick={() => void importDevice()}>
                      가져오기 확인
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setImporting(false)}
                    >
                      취소
                    </Button>
                  </div>
                  {legacy && (
                    <button
                      className="account-text-link"
                      onClick={() => downloadTravelBackup(legacy)}
                    >
                      <Download size={15} /> 기기 기록 먼저 백업
                    </button>
                  )}
                </div>
              )}
            </section>
            <button
              className="account-text-link"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await accountRequest('/api/account', { action: 'logout' });
                  location.replace('/login');
                } catch (e) {
                  setError((e as Error).message);
                  setBusy(false);
                }
              }}
            >
              로그아웃
            </button>
          </>
        ) : (
          <>
            <p className="account-eyebrow">휴전선 밖 첫 하루</p>
            <h1>
              함께 갈 곳도,
              <br />
              다녀온 날도 여기에.
            </h1>
            <p className="account-lead">
              로그인하면 어느 기기에서든
              <br />내 여행과 그룹을 이어갈 수 있어요.
            </p>
            <div className="account-mode" role="tablist" aria-label="계정 시작">
              <button
                role="tab"
                aria-selected={mode === 'login'}
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
              >
                로그인
              </button>
              <button
                role="tab"
                aria-selected={mode === 'register'}
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
              >
                계정 만들기
              </button>
            </div>
            <div className="social-login-list">
              {(['google', 'naver'] as const).map((p) => (
                <button
                  className={`social-login ${p}`}
                  key={p}
                  disabled={busy || !session?.providers[p]}
                  onClick={() => void social(p)}
                >
                  <img
                    className={p === 'naver' ? 'social-n' : 'social-g'}
                    src={
                      p === 'google'
                        ? '/brand/google-g.png'
                        : '/brand/naver-n.png'
                    }
                    alt=""
                  />
                  {p === 'google' ? 'Google' : '네이버'}로 계속하기
                  {!session?.providers[p] && <small>연결 준비 중</small>}
                </button>
              ))}
            </div>
            <div className="account-divider">
              <span>
                아이디로 {mode === 'register' ? '계정 만들기' : '로그인'}
              </span>
            </div>
            <form
              className="account-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  await accountRequest('/api/account', {
                    action: mode,
                    handle,
                    password,
                    nickname,
                    testPassword,
                  });
                  location.assign(returnTo());
                } catch (e) {
                  setError((e as Error).message);
                  setBusy(false);
                }
              }}
            >
              {mode === 'register' && (
                <>
                  <label htmlFor="nickname">별명</label>
                  <Input
                    id="nickname"
                    autoComplete="nickname"
                    maxLength={20}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    required
                    placeholder="여행에서 부를 이름"
                  />
                </>
              )}
              <label htmlFor="handle">아이디</label>
              <Input
                id="handle"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                minLength={4}
                maxLength={30}
                pattern="[a-z0-9][a-z0-9_-]{3,29}"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase())}
                required
                placeholder="영문 소문자·숫자 4~30자"
              />
              <label htmlFor="password">비밀번호</label>
              <Input
                id="password"
                type="password"
                autoComplete={
                  mode === 'register' ? 'new-password' : 'current-password'
                }
                minLength={10}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="10자 이상"
              />
              {mode === 'register' && (
                <>
                  <label htmlFor="register-test">체험 초대 비밀번호</label>
                  <Input
                    id="register-test"
                    type="password"
                    inputMode="numeric"
                    value={testPassword}
                    onChange={(e) => setTestPassword(e.target.value)}
                    placeholder="전달받은 체험 비밀번호"
                  />
                  <small>
                    현재는 초기 테스트 계정입니다. 비밀번호 재설정 메일을
                    지원하지 않으니 비밀번호 관리자에 보관해 주세요.
                  </small>
                </>
              )}
              <Button type="submit" disabled={busy || !session}>
                {busy
                  ? '확인 중…'
                  : mode === 'register'
                    ? '내 여행 계정 만들기'
                    : '로그인'}
                <ArrowRight size={17} />
              </Button>
            </form>
            <button
              className="account-guest-link"
              onClick={() => setMode('guest')}
            >
              회원가입 없이 체험하기 <ArrowRight size={16} />
            </button>
          </>
        )}
        {error && (
          <p className="account-message error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="account-message" role="status">
            {message}
          </p>
        )}
        {!session && error && (
          <Button variant="outline" onClick={() => location.reload()}>
            연결 다시 확인
          </Button>
        )}
      </section>
      <footer className="account-footer">
        <a href="/about">군번여지도 소개</a>
        <a href="/privacy">개인정보 안내</a>
      </footer>
    </main>
  );
}
