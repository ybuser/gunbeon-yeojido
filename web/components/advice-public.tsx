'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, RefreshCw } from 'lucide-react';
import Brand from './brand';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { AdviceRoute, AdviceCards, AdviceShareTools } from './advice-shared';
import { adviceRequest } from '@/lib/advice-client';
import { pageFetch } from '@/lib/page-cache';
import {
  adviceQuestions,
  adviceReasons,
  type AdviceDetail,
  type AdviceSuggestion,
  type PublicPlace,
} from '@/lib/advice-model';
export default function AdvicePublic({ id }: { id: string }) {
  const [detail, setDetail] = useState<AdviceDetail | null>(null),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false);
  const [kind, setKind] = useState<AdviceSuggestion['kind']>('replace'),
    [targetId, setTarget] = useState(''),
    [placeId, setPlace] = useState(''),
    [reason, setReason] = useState<string>(adviceReasons[0]);
  const [query, setQuery] = useState(''),
    [results, setResults] = useState<PublicPlace[] | null>(null),
    [searchMessage, setSearchMessage] = useState(''),
    [searchBusy, setSearchBusy] = useState(false),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [activeQuery, setActiveQuery] = useState('');
  const endpoint = '/api/public-advice/' + id;
  async function load(next = 1) {
    try {
      const data = await adviceRequest<AdviceDetail>(
        endpoint + '?page=' + next,
      );
      setDetail((v) =>
        next === 1 || !v
          ? data
          : {
              ...data,
              places: [
                ...new Map(
                  [...v.places, ...data.places].map((p) => [p.id, p]),
                ).values(),
              ],
              suggestions: [
                ...new Map(
                  [...v.suggestions, ...data.suggestions].map((s) => [s.id, s]),
                ).values(),
              ],
            },
      );
      setTarget((v) => v || data.snapshot.placeIds[0]);
      setMessage('');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setReady(true);
    }
  }
  useEffect(() => {
    void load();
  }, [id]);
  async function action(action: string, suggestionId?: string) {
    setBusy(true);
    try {
      await adviceRequest(endpoint, {
        action,
        suggestionId,
        ...(action === 'suggest'
          ? {
              suggestion: {
                kind,
                targetId,
                placeId: kind === 'remove' ? null : placeId,
                reason,
              },
            }
          : {}),
      });
      await load();
      setMessage(
        action === 'suggest'
          ? '한 수를 보탰어요. 작성자가 반영하면 여기에 표시돼요.'
          : action === 'withdraw'
            ? '제안을 삭제했어요. 새 한 수를 남길 수 있습니다.'
            : '작성자에게 확인을 요청했어요.',
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function search(next = 1) {
    setSearchBusy(true);
    setSearchMessage('');
    const q = next === 1 ? query.trim() : activeQuery;
    try {
      const r = await pageFetch(
        endpoint + '?' + new URLSearchParams({ q, page: String(next) }),
      );
      const data = (await r.json()) as {
        places: PublicPlace[];
        message?: string;
        total?: number;
      };
      if (!r.ok)
        throw new Error(
          data.message || '관광정보 검색이 잠시 연결되지 않아요.',
        );
      if (next === 1) setPlace('');
      setResults((v) =>
        next === 1 ? data.places : [...(v || []), ...data.places],
      );
      setActiveQuery(q);
      setPage(next);
      setTotal(data.total || 0);
      if (!data.places.length)
        setSearchMessage('검색 결과가 없어요. 다른 장소 이름으로 찾아보세요.');
    } catch (e) {
      setSearchMessage((e as Error).message);
    } finally {
      setSearchBusy(false);
    }
  }
  if (!detail)
    return (
      <main className="advice-page">
        <Brand />
        <div className="advice-empty">
          <h1>{ready ? '공유를 열지 못했어요' : '여행안을 펼치고 있어요'}</h1>
          <p role="status">{message}</p>
          {ready && <Button onClick={() => load()}>다시 확인</Button>}
          <a href="/">군번여지도 홈으로</a>
        </div>
      </main>
    );
  const mine = detail.suggestions.find((s) => s.own),
    allCandidates = (results || detail.candidates).filter(
      (p) => !detail.snapshot.placeIds.includes(p.id),
    );
  return (
    <main className="advice-page" data-ready={ready}>
      <header className="advice-header">
        <a href="/" aria-label="군번여지도 홈">
          <Brand />
        </a>
        <span>함께 짜는 강원 여행</span>
      </header>
      <div className="advice-layout">
        <div>
          <section className="advice-hero">
            <p className="advice-eyebrow">
              {detail.snapshot.region.replace(/[군시]$/, '')}에서의 하루 · 한 수
              보태기
            </p>
            <h1>{adviceQuestions[detail.snapshot.question]}</h1>
            <p>
              잘 아는 한 곳이, 누군가의 하루를 바꿔요.
              <br />이 여행에 당신의 한 수를 보태주세요.
            </p>
            <div className="advice-status">
              {detail.status === 'open' ? '제안 받는 중' : '제안 마감'}
              <span>
                처음 공유한 관광지 {detail.snapshot.placeIds.length}곳
              </span>
            </div>
          </section>
          {!detail.owner && !mine && detail.status === 'open' && <Button className="advice-hero-action" onClick={() => document.querySelector('.advice-participation')?.scrollIntoView({behavior:'smooth',block:'start'})}>내가 한 수 보태기<ArrowRight size={16}/></Button>}
          <AdviceRoute snapshot={detail.snapshot} places={detail.places} />
          <p className="advice-note">
            여행자의 날짜·개인 만남 장소·복귀 정보가 빠진 공개 여행안입니다.
            제안은 원본 일정을 직접 바꾸지 않아요.
          </p>
          {!!detail.missing.length && (
            <p className="advice-feedback">
              일부 관광정보를 다시 확인 중입니다. 장소가 확인되지 않으면 제안을
              잠시 기다려 주세요.
            </p>
          )}
        </div>
        <div className="advice-participation">
          {detail.owner ? (
            <section className="advice-panel">
              <p className="advice-eyebrow">내가 공유한 여행</p>
              <h2>
                누군가의 한 수를
                <br />
                기다려볼까요?
              </h2>
              <p>링크를 보내면 가입 없이 여행 아이디어를 남길 수 있어요.</p>
              <AdviceShareTools
                id={id}
                snapshot={detail.snapshot}
                places={detail.places}
              />
              <a
                className="advice-primary-link"
                href={'/?advice=' + id + '#passport'}
              >
                내 여행에서 제안 관리
                <ArrowRight size={18} />
              </a>
            </section>
          ) : mine ? (
            <section className="advice-panel advice-thanks">
              <Check size={30} />
              <h2>
                {mine.status === 'adopted' ? (
                  <>
                    당신의 한 수가
                    <br />
                    계획에 반영됐어요.
                  </>
                ) : (
                  <>
                    작성자에게
                    <br />한 수를 보냈어요.
                  </>
                )}
              </h2>
              <p>
                제안은 아래에서 확인하거나 삭제할 수 있어요. 반영 결과는 이
                링크에서 다시 볼 수 있습니다.
              </p>
              <a className="advice-primary-link" href={'/?advice=' + id}>
                이 공개안으로 내 여행 만들기
                <ArrowRight size={18} />
              </a>
              <p className="advice-note">
                새 계획은 테스트 비밀번호로 입장한 뒤 만들어요.
              </p>
            </section>
          ) : detail.status === 'closed' ? (
            <section className="advice-panel">
              <h2>
                지금은 한 수 받기를
                <br />
                마감한 여행이에요.
              </h2>
              <p>제안은 마감됐지만 이 여행안에서 내 여행을 시작할 수 있어요.</p>
              <a className="advice-primary-link" href={'/?advice=' + id}>
                이 공개안으로 내 여행 만들기
                <ArrowRight size={18} />
              </a>
            </section>
          ) : (
            <section className="advice-panel">
              <p className="advice-eyebrow">당신이라면?</p>
              <h2>한 수 보태기</h2>
              <p>한 곳만 구체적으로. 긴 설명은 필요 없어요.</p>
              <div
                className="advice-choice"
                role="group"
                aria-label="제안 방식"
              >
                {(
                  [
                    ['replace', '대신 이곳'],
                    ['add', '한 곳 보태기'],
                    ['remove', '여유 있게'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={kind === value}
                    disabled={
                      (value === 'remove' &&
                        detail.snapshot.placeIds.length === 1) ||
                      (value === 'add' && detail.snapshot.placeIds.length >= 12)
                    }
                    onClick={() => setKind(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="advice-field">
                {kind === 'add'
                  ? '어느 장소 다음에 넣을까요?'
                  : kind === 'remove'
                    ? '어느 곳을 다음 기회로 미룰까요?'
                    : '어느 장소를 바꿀까요?'}
                <select
                  aria-label={kind === 'add' ? '어느 장소 다음에 넣을까요?' : kind === 'remove' ? '어느 곳을 다음 기회로 미룰까요?' : '어느 장소를 바꿀까요?'}
                  value={targetId}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  {detail.snapshot.placeIds.map((id) => (
                    <option key={id} value={id}>
                      {detail.places.find((p) => p.id === id)?.title ||
                        '조회 대기 중인 장소'}
                    </option>
                  ))}
                </select>
              </label>
              {kind !== 'remove' && (
                <>
                  <form
                    className="advice-search"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void search();
                    }}
                  >
                    <label htmlFor="advice-search">
                      대신 추천할 관광지나 음식점
                    </label>
                    <div>
                      <Input
                        id="advice-search"
                        placeholder="장소 이름으로 관광정보 검색"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        minLength={2}
                        maxLength={50}
                      />
                      <Button
                        type="submit"
                        disabled={searchBusy || query.trim().length < 2}
                      >
                        {searchBusy ? '검색 중' : '검색'}
                      </Button>
                    </div>
                  </form>
                  {results && (
                    <button
                      className="advice-text-button"
                      onClick={() => {
                        setResults(null);
                        setPlace('');
                        setSearchMessage('');
                      }}
                    >
                      지역 장소 후보로 돌아가기
                    </button>
                  )}
                  <div
                    className="advice-candidates"
                    role="group"
                    aria-label="추천 장소 선택"
                  >
                    {allCandidates.map((p) => (
                      <button
                        key={p.id}
                        aria-pressed={placeId === p.id}
                        onClick={() => setPlace(p.id)}
                      >
                        <strong>{p.title}</strong>
                        <span>
                          {p.sigungu}
                          {placeId === p.id && <Check size={16} />}
                        </span>
                      </button>
                    ))}
                  </div>
                  {results && results.length < total && page < 10 && (
                    <Button
                      variant="outline"
                      disabled={searchBusy}
                      onClick={() => search(page + 1)}
                    >
                      검색 결과 더 보기
                    </Button>
                  )}
                  <p role="status" className="advice-note">
                    {searchMessage}
                  </p>
                </>
              )}
              <label className="advice-field">
                한 수를 보탠 이유
                <select
                  aria-label="한 수를 보탠 이유"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  {adviceReasons.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <Button
                className="advice-submit"
                disabled={
                  busy ||
                  !targetId ||
                  (kind !== 'remove' && !placeId) ||
                  detail.missing.includes(targetId)
                }
                onClick={() => action('suggest')}
              >
                {busy ? '한 수 보내는 중…' : '이렇게 한 수 보태기'}
                <ArrowRight size={17} />
              </Button>
              <p className="advice-note">
                실명·연락처 없이 이 브라우저에서 한 여행당 한 수를 남겨요. 장소
                추천은 참여자의 의견이며 운영·예약 조건은 별도 확인이
                필요합니다.
              </p>
            </section>
          )}
          <p role="status" className="advice-feedback">
            {message}
          </p>
        </div>
      </div>
      <AdviceCards
        publicView
        detail={detail}
        busy={busy}
        onAction={(action, id) => {
          if (detail.owner) {
            window.location.assign('/?advice=' + detail.id + '#passport');
            return;
          }
          void actionHandler(action, id);
        }}
      />
      <div className="advice-bottom">
        {detail.hasMore && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => load(detail.page + 1)}
          >
            한 수 더 보기
          </Button>
        )}
        <Button variant="outline" disabled={busy} onClick={() => load()}>
          <RefreshCw size={16} />새 한 수 확인
        </Button>
        {!detail.owner && (
          <a href={'/?advice=' + id}>
            나도 이 공개안으로 여행 만들기
            <ArrowUpRight size={16} />
          </a>
        )}
      </div>
      <footer className="advice-footer">
        관광정보: ⓒ한국관광공사 · 통일부 DMZ · 국가보훈부. 링크는 30일간 열리며
        작성자가 닫거나 삭제할 수 있습니다. 익명 참여 권한은 이 브라우저에
        보관됩니다.
      </footer>
    </main>
  );
  async function actionHandler(a: string, s: string) {
    await action(a, s);
  }
}
