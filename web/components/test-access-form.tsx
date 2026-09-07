'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export default function TestAccessForm() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <main className="test-entry" data-ready={ready} inert={!ready}>
      <div className="test-entry-brand">
        <Navigation size={25} />
        <strong>
          군번여지도 <span>강원</span>
        </strong>
      </div>
      <section className="test-entry-panel">
        <p className="test-entry-eyebrow">테스트 입장</p>
        <h1>
          함께 만드는
          <br />
          강원에서의 하루
        </h1>
        <p className="test-entry-copy">
          전달받은 비밀번호로 들어오세요.
          <br />
          회원가입 없이 여행을 계획할 수 있어요.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage('');
            try {
              const r = await fetch('/api/test-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
              });
              const data = await r.json() as { message?: string };
              if (!r.ok) {
                setMessage(
                  data.message || '입장하지 못했습니다. 다시 시도해 주세요.',
                );
                return;
              }
              window.location.assign('/');
            } catch {
              setMessage('연결이 원활하지 않습니다. 다시 시도해 주세요.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label htmlFor="test-password">테스트 비밀번호</label>
          <Input
            id="test-password"
            type="password"
            autoComplete="current-password"
            inputMode="numeric"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            maxLength={100}
            autoFocus
            aria-describedby="test-access-message"
          />
          <p id="test-access-message" role="alert">
            {message}
          </p>
          <Button type="submit" disabled={busy || !password}>
            {busy ? '확인 중…' : '여행 시작하기'}
            <ArrowRight size={18} />
          </Button>
        </form>
        <p className="test-entry-note">
          내 여행은 이 브라우저에 저장됩니다.
          <br />
          부대 정보와 군번은 입력하지 마세요.
        </p>
      </section>
      <p className="test-entry-footer">휴전선 밖 첫 하루</p>
    </main>
  );
}
