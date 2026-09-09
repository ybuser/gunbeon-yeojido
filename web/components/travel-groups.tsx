'use client';
import { useCallback, useEffect, useState, useRef } from 'react';
import {
  Users,
  Plus,
  ArrowLeft,
  ArrowRight,
  Copy,
  Check,
  CalendarDays,
  RefreshCw,
  UserPlus,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from './ui/alert-dialog';
import { pageFetch, clearPageCache } from '@/lib/page-cache';
import { groupKinds } from '@/lib/group-model';
import type { GroupSummary, GroupDetail, GroupPlan } from '@/lib/group-model';
import type { Entry, ActiveOuting, Place } from '@/lib/domain';
import CourseCover from './course-cover';
import DayStory from './day-story';
import { resolveEntry } from '@/lib/domain';
import { entryKey, hasVisitRecord, localInputDate } from '@/lib/domain';
type GroupReply = {
  message?: string;
  profile?: { id: string; nickname: string } | null;
  groups?: GroupSummary[];
  group?: GroupDetail;
  invitation?: { id: string; name: string; kind: keyof typeof groupKinds };
  code?: string;
  expiresAt?: string;
};
export function useTravelGroups() {
  const generation = useRef(0);
  const [groups, setGroups] = useState<GroupSummary[]>([]),
    [profile, setProfile] = useState<{ id: string; nickname: string } | null>(
      null,
    );
  const [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const load = useCallback(async (refresh = false) => {
    const request = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const r = await pageFetch('/api/groups', {}, { refresh, maxAge: 60000 });
      const d = (await r.json()) as GroupReply;
      if (request !== generation.current) return;
      if (!r.ok) throw new Error(d.message);
      setGroups(d.groups || []);
      setProfile(d.profile || null);
    } catch (e) {
      if (request !== generation.current) return;
      setError(e instanceof Error ? e.message : '그룹을 불러오지 못했어요.');
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const focus = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    document.addEventListener('visibilitychange', focus);
    return () => document.removeEventListener('visibilitychange', focus);
  }, [load]);
  const action = useCallback(
    async (body: Record<string, unknown>) => {
      const r = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = (await r.json()) as GroupReply;
      if (!r.ok)
        throw Object.assign(new Error(d.message || '저장하지 못했습니다.'), {
          status: r.status,
        });
      clearPageCache('/api/groups');
      await load(true);
      return d;
    },
    [load],
  );
  return { groups, profile, loading, error, load, action };
}
export type TravelGroupStore = ReturnType<typeof useTravelGroups>;
const dateLabel = (value?: string) =>
  value
    ? new Date(value).toLocaleString('ko-KR', {
        month: 'long',
        day: 'numeric',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '날짜를 정해 주세요';
function GroupTile({ g, onClick }: { g: GroupSummary; onClick: () => void }) {
  return (
    <button className="group-tile" onClick={onClick}>
      <span className={'group-avatar kind-' + g.kind}>
        {g.name.slice(0, 1)}
      </span>
      <span>
        <strong>{g.name}</strong>
        <small>
          {groupKinds[g.kind]} · {g.memberCount}명 · 여행 {g.planCount}개
        </small>
      </span>
      <ArrowRight size={18} />
    </button>
  );
}
export function TravelHome({
  entries,
  places,
  onContinue,
  outing,
  store,
  onOpen,
  onGroup,
  onGo,
  onNew,
}: {
  entries: Entry[];
  places: Place[];
  onContinue: (entry: Entry) => void;
  outing: ActiveOuting | null;
  store: TravelGroupStore;
  onOpen: (e: Entry) => void;
  onGroup: (id: string) => void;
  onGo: (v: string) => void;
  onNew: () => void;
}) {
  const today = localInputDate(new Date().toISOString()).slice(0, 10);
  const category = (e: Entry) =>
    !e.plan?.departureAt
      ? 1
      : localInputDate(e.plan.departureAt).slice(0, 10) >= today
        ? 0
        : 2;
  const planned = entries
    .filter((e) => !hasVisitRecord(e))
    .sort(
      (a, b) =>
        category(a) - category(b) ||
        (category(a) === 2 ? -1 : 1) *
          ((Date.parse(a.plan?.departureAt || '') || 0) -
            (Date.parse(b.plan?.departureAt || '') || 0)),
    );
  return (
    <main className="page-container travel-home">
      <div className="page-heading">
        <div>
          <span className="section-overline">함께 준비하는 강원 여행</span>
          <h1>
            {store.profile
              ? store.profile.nickname + '님의 여행'
              : '우리의 다음 여행'}
          </h1>
          <p>만날 사람과 일정을 한곳에서 준비하세요.</p>
        </div>
        <Button onClick={onNew}>
          <Plus size={18} />새 여행
        </Button>
      </div>
      <DayStory
        places={places}
        onBrowse={() => onGo('home')}
        onJoin={() => onGo('groups')}
      />
      {outing && (
        <button className="active-home-banner" onClick={() => onGo('outing')}>
          <span>
            <small>지금 진행 중</small>
            <strong>{outing.entry.title}</strong>
          </span>
          <b>
            출타 이어보기 <ArrowRight size={18} />
          </b>
        </button>
      )}
      <div className="home-columns">
        <section>
          <div className="section-title">
            <h2>
              예정된 여행 <span className="quiet-count">{planned.length}</span>
            </h2>
            <button onClick={() => onGo('passport')}>
              전체 보기 <ArrowRight size={16} />
            </button>
          </div>
          {planned.length ? (
            <div className="agenda-list">
              <article className="day-passport-cover" aria-label="함께 쓸 하루">
                <div className="day-cover-copy">
                  <span className="section-overline">
                    {category(planned[0]) === 2
                      ? '다시 준비할 하루'
                      : '함께 쓸 하루'}{' '}
                    · {planned[0].region}
                  </span>
                  <h3>{planned[0].title}</h3>
                  <p>
                    {dateLabel(planned[0].plan?.departureAt)} · 나만 보는 계획
                  </p>
                </div>
                <CourseCover
                  eager
                  places={
                    resolveEntry(planned[0], places)?.mission.stops.map(
                      (s) => s.place,
                    ) ||
                    planned[0].plan?.stops
                      .map((s) => places.find((p) => p.id === s.placeId))
                      .filter((p): p is Place => !!p) ||
                    []
                  }
                />
                <Button onClick={() => onContinue(planned[0])}>
                  {outing && entryKey(outing.entry) === entryKey(planned[0])
                    ? '현재 출타 이어보기'
                    : '계속 계획하기'}
                  <ArrowRight size={17} />
                </Button>
              </article>
              {planned.slice(1, 4).map((e) => (
                <button
                  key={entryKey(e)}
                  className="agenda-card"
                  onClick={() => onOpen(e)}
                >
                  <span className="agenda-date">
                    <small>
                      {e.plan?.departureAt
                        ? new Date(e.plan.departureAt).getMonth() + 1 + '월'
                        : '계획'}
                    </small>
                    <b>
                      {e.plan?.departureAt
                        ? new Date(e.plan.departureAt).getDate()
                        : '중'}
                    </b>
                  </span>
                  <span>
                    <small>
                      나만 보기 · {e.region}
                      {category(e) === 2 ? ' · 지난 계획' : ''}
                    </small>
                    <strong>{e.title}</strong>
                    <span>
                      {dateLabel(e.plan?.departureAt)} ·{' '}
                      {e.plan?.stops.length || 0}곳
                    </span>
                  </span>
                  <ArrowRight size={18} />
                </button>
              ))}
            </div>
          ) : (
            <div className="home-empty">
              <CalendarDays size={34} />
              <h3>기다리던 하루를, 함께.</h3>
              <p>아직 갈 곳을 정하지 않아도 저장할 수 있어요.</p>
              <Button onClick={onNew}>빈 여행 만들기</Button>
              <button className="text-link" onClick={() => onGo('home')}>
                추천 여행 둘러보기
              </button>
            </div>
          )}
        </section>
        <section>
          <div className="section-title">
            <h2>나의 그룹</h2>
            <button onClick={() => onGo('groups')}>
              그룹 관리 <ArrowRight size={16} />
            </button>
          </div>
          {store.error ? (
            <div className="empty-state">
              <p>{store.error}</p>
              <Button variant="outline" onClick={() => store.load(true)}>
                다시 불러오기
              </Button>
            </div>
          ) : store.loading && !store.groups.length ? (
            <p className="helper">그룹을 불러오고 있어요.</p>
          ) : store.groups.length ? (
            <div className="group-list">
              {store.groups.map((g) => (
                <GroupTile key={g.id} g={g} onClick={() => onGroup(g.id)} />
              ))}
            </div>
          ) : (
            <div className="home-empty group-empty">
              <Users size={34} />
              <h3>누구와 함께 떠나나요?</h3>
              <p>
                가족, 연인, 친구와 그룹을 만들고
                <br />
                여러 여행 계획을 함께 정리하세요.
              </p>
              <Button variant="outline" onClick={() => onGo('groups')}>
                그룹 만들기 · 초대 참여
              </Button>
            </div>
          )}
        </section>
      </div>
      <button className="explore-home-link" onClick={() => onGo('home')}>
        <span>
          <strong>강원에서 갈 곳을 찾고 있다면</strong>
          <small>지역과 취향에 맞는 여행을 둘러보세요.</small>
        </span>
        <ArrowRight />
      </button>
    </main>
  );
}
export default function TravelGroups({
  store,
  selectedId,
  onSelect,
  onEdit,
  onImport,
  onNew,
  onShare,
  onBrief,
}: {
  store: TravelGroupStore;
  selectedId: string;
  onSelect: (id: string) => void;
  onEdit: (g: GroupDetail, p: GroupPlan) => void;
  onImport: (g: GroupDetail, p: GroupPlan) => void;
  onNew: (g: GroupDetail) => void;
  onShare: (g: GroupDetail) => void;
  onBrief: () => void;
}) {
  const selectedRef = useRef(selectedId),
    generation = useRef(0),
    codeRef = useRef('');
  selectedRef.current = selectedId;
  const [loadedGroup, setGroup] = useState<GroupDetail | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [form, setForm] = useState<'none' | 'create' | 'join'>('none'),
    [name, setName] = useState(''),
    [kind, setKind] = useState('family'),
    [nickname, setNickname] = useState(''),
    [code, setCode] = useState('');
  codeRef.current = code;
  const group = loadedGroup?.id === selectedId ? loadedGroup : null;
  const [preview, setPreview] = useState<{
      id: string;
      name: string;
      code: string;
      kind: keyof typeof groupKinds;
    } | null>(null),
    [invite, setInvite] = useState<{ code: string; expiresAt: string } | null>(
      null,
    ),
    [copied, setCopied] = useState(false),
    [manage, setManage] = useState(false);
  const [confirm, setConfirm] = useState<{
    message: string;
    body: Record<string, unknown>;
  } | null>(null);
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('join');
    if (v) {
      setForm('join');
      setCode(v);
      onSelect('');
      history.replaceState(null, '', '/#groups');
    }
  }, []);
  const load = useCallback(async () => {
    const request = ++generation.current;
    const current = () =>
      request === generation.current && selectedRef.current === selectedId;
    if (!selectedId) {
      setLoading(false);
      setGroup(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const r = await pageFetch(
        '/api/groups?id=' + encodeURIComponent(selectedId),
        {},
        { refresh: true },
      );
      const d = (await r.json()) as GroupReply;
      if (!current()) return;
      if (!r.ok) throw new Error(d.message);
      setGroup(d.group || null);
    } catch (e) {
      if (!current()) return;
      setGroup(null);
      setError((e as Error).message);
    } finally {
      if (current()) setLoading(false);
    }
  }, [selectedId]);
  useEffect(() => {
    setGroup(null);
    setConfirm(null);
    setInvite(null);
    setManage(false);
    void load();
  }, [load]);
  useEffect(() => {
    const focus = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', focus);
    return () => document.removeEventListener('visibilitychange', focus);
  }, [load]);
  async function run(body: Record<string, unknown>) {
    const target = selectedRef.current;
    setBusy(true);
    setError('');
    try {
      const d = await store.action(body);
      if (target !== selectedRef.current) return null;
      if (d.group) {
        setGroup(d.group || null);
        onSelect(d.group.id);
      }
      if (body.action === 'create' || body.action === 'join') {
        setForm('none');
        setPreview(null);
      }
      if (body.action === 'leave' || body.action === 'deleteGroup') {
        onSelect('');
        setGroup(null);
      }
      if (body.action === 'remove') await load();
      if (body.action === 'revoke') setInvite(null);
      return d;
    } catch (e) {
      if (target === selectedRef.current) setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  const manager = group?.ownerId === store.profile?.id;
  return (
    <main className="page-container groups-page">
      <div className="page-heading">
        <div>
          {selectedId && (
            <button
              className="back-link"
              onClick={() => {
                onSelect('');
                setError('');
              }}
            >
              <ArrowLeft size={17} />내 그룹
            </button>
          )}
          <h1>
            {selectedId ? group?.name || '그룹 여행' : '함께 떠나는 그룹'}
          </h1>
          <p>
            {selectedId
              ? `${group ? groupKinds[group.kind] + ' · ' + group.memberCount + '명' : ''} 함께 볼 여행을 정리하세요.`
              : '가족, 연인, 친구. 만나는 사람마다 여행을 나누세요.'}
          </p>
        </div>
        {!selectedId ? (
          <Button
            onClick={() => {
              setForm('create');
              setError('');
            }}
          >
            <Plus size={18} />
            그룹 만들기
          </Button>
        ) : (
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw size={16} />
            변경사항 확인
          </Button>
        )}
      </div>
      {error && (
        <p className="warning" role="alert">
          {error}
        </p>
      )}
      {!selectedId && (
        <>
          <div className="group-toolbar">
            <button
              className="text-link"
              onClick={() => {
                setForm('join');
                setError('');
              }}
            >
              <UserPlus size={18} />
              초대코드로 참여
            </button>
            {store.profile && (
              <span className="helper">
                {store.profile.nickname}으로 참여 중
              </span>
            )}
          </div>
          {form !== 'none' && (
            <form
              className="panel group-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (form === 'create')
                  await run({ action: 'create', name, kind, nickname });
                else if (!preview) {
                  const d = await run({ action: 'preview', code });
                  if (d?.invitation && code === codeRef.current)
                    setPreview({ ...d.invitation, code });
                } else if (preview.code === code)
                  await run({ action: 'join', code: preview.code, nickname });
              }}
            >
              <div className="section-title">
                <h2>
                  {form === 'create' ? '새 그룹' : '초대받은 그룹에 참여'}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setForm('none');
                    setPreview(null);
                  }}
                >
                  닫기
                </button>
              </div>
              {!store.profile && (
                <label className="field">
                  그룹에서 사용할 이름
                  <Input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    maxLength={20}
                    required
                    placeholder="예: 윤보"
                  />
                  <small>
                    이 브라우저에 참여 정보가 저장됩니다. 본인 인증을 대신하지
                    않아요.
                  </small>
                </label>
              )}
              {form === 'create' ? (
                <>
                  <label className="field">
                    그룹 이름
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={40}
                      placeholder="예: 우리 가족 강원 여행"
                      required
                    />
                  </label>
                  <label className="field">
                    함께하는 사람
                    <select
                      aria-label="함께하는 사람"
                      value={kind}
                      onChange={(e) => setKind(e.target.value)}
                    >
                      {Object.entries(groupKinds).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <label className="field">
                  초대코드
                  <Input
                    value={code}
                    disabled={busy}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setPreview(null);
                    }}
                    autoComplete="off"
                    required
                    placeholder="전달받은 초대코드를 붙여넣으세요"
                  />
                </label>
              )}
              {preview && (
                <div className="group-join-preview">
                  <strong>{preview.name}</strong>
                  <p>
                    참여하면 그룹의 여행 일정과 공유된 장소를 보고 함께 수정할
                    수 있습니다.
                  </p>
                </div>
              )}
              <Button type="submit" disabled={busy}>
                {busy
                  ? '확인 중…'
                  : form === 'create'
                    ? '그룹 만들기'
                    : preview
                      ? '이 그룹에 참여'
                      : '초대 확인'}
              </Button>
            </form>
          )}
          {store.loading && !store.groups.length ? (
            <p>그룹을 불러오고 있어요.</p>
          ) : (
            <div className="group-grid">
              {store.groups.map((g) => (
                <GroupTile
                  key={g.id}
                  g={g}
                  onClick={() => {
                    onSelect(g.id);
                    setForm('none');
                  }}
                />
              ))}
            </div>
          )}
          {!store.groups.length && form === 'none' && !store.loading && (
            <div className="home-empty">
              <Users size={38} />
              <h2>여행을 함께 준비할 사람들</h2>
              <p>
                그룹을 만들거나 초대코드로 참여하면
                <br />
                같은 여행을 다른 기기에서도 볼 수 있어요.
              </p>
            </div>
          )}
        </>
      )}
      {selectedId && loading && !group && <p>그룹 여행을 불러오고 있어요.</p>}
      {group && selectedId && (
        <>
          <div className="group-detail-toolbar">
            <div className="segmented-control">
              <button
                className={!manage ? 'active' : ''}
                onClick={() => setManage(false)}
              >
                여행 계획 {group.planCount}
              </button>
              <button
                className={manage ? 'active' : ''}
                onClick={() => setManage(true)}
              >
                멤버·초대
              </button>
            </div>
            <button className="text-link" onClick={onBrief}>
              동행 조건 브리핑 <ArrowRight size={16} />
            </button>
          </div>
          {!manage ? (
            <>
              <div className="group-plan-actions">
                <Button onClick={() => onNew(group)}>
                  <Plus size={17} />새 그룹 여행
                </Button>
                <Button variant="outline" onClick={() => onShare(group)}>
                  내 여행에서 가져오기
                </Button>
              </div>
              {!group.plans.length ? (
                <div className="home-empty">
                  <CalendarDays size={36} />
                  <h3>함께 정할 첫 여행</h3>
                  <p>빈 일정으로 시작하거나 내 여행을 가져오세요.</p>
                </div>
              ) : (
                <div className="group-plan-grid">
                  {group.plans.map((p) => (
                    <article className="group-plan-card" key={p.id}>
                      <span className="tag">
                        {p.plan.region} · {p.plan.stops.length}곳
                      </span>
                      <h2>{p.plan.title}</h2>
                      <p>
                        <CalendarDays size={16} />
                        {dateLabel(p.plan.departureAt)}
                      </p>
                      <small>공유한 여행 계획 · 복귀시각은 각자 설정</small>
                      <div className="group-card-buttons">
                        <Button onClick={() => onEdit(group, p)}>
                          일정 보기·수정
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => onImport(group, p)}
                        >
                          내 여행에 담기
                        </Button>
                        {(manager || p.authorId === store.profile?.id) && (
                          <button
                            className="text-link"
                            onClick={() =>
                              setConfirm({
                                message: `‘${p.plan.title}’을 그룹에서 삭제할까요? 각자의 내 여행에 담은 사본은 유지됩니다.`,
                                body: {
                                  action: 'deletePlan',
                                  groupId: group.id,
                                  planId: p.id,
                                },
                              })
                            }
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          ) : (
            <section className="panel">
              <h2>함께하는 사람</h2>
              <div className="member-list">
                {group.members.map((m) => (
                  <div key={m.id}>
                    <span className="member-initial">
                      {m.nickname.slice(0, 1)}
                    </span>
                    <strong>{m.nickname}</strong>
                    <small>{m.id === group.ownerId ? '관리자' : '멤버'}</small>
                    {manager && m.id !== store.profile?.id && (
                      <button
                        className="text-link"
                        onClick={() =>
                          setConfirm({
                            message: `${m.nickname}님을 그룹에서 제외할까요? 이후 그룹 일정에 접근할 수 없습니다.`,
                            body: {
                              action: 'remove',
                              groupId: group.id,
                              userId: m.id,
                            },
                          })
                        }
                      >
                        제외
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {manager && (
                <div className="invite-tools">
                  <h3>함께할 사람 초대하기</h3>
                  <p>
                    초대 링크는 72시간 동안 유효합니다. 새로 만들면 이전 초대는
                    취소됩니다.
                  </p>
                  <Button
                    onClick={async () => {
                      const d = await run({
                        action: 'invite',
                        groupId: group.id,
                      });
                      if (d?.code && d.expiresAt) {
                        setInvite({ code: d.code, expiresAt: d.expiresAt });
                        setCopied(false);
                      }
                    }}
                    disabled={busy}
                  >
                    <UserPlus size={17} />
                    {invite ? '초대 새로 만들기' : '초대 만들기'}
                  </Button>
                  {invite && (
                    <>
                      <label className="field">
                        초대코드
                        <Input readOnly value={invite.code} />
                      </label>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              window.location.origin +
                                '/?join=' +
                                invite.code +
                                '#groups',
                            );
                            setCopied(true);
                          } catch {
                            setError('초대코드를 길게 눌러 복사해 주세요.');
                          }
                        }}
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}초대
                        링크 {copied ? '복사됨' : '복사'}
                      </Button>
                      <button
                        className="text-link"
                        onClick={() =>
                          setConfirm({
                            message:
                              '이 초대를 취소할까요? 이미 참여한 멤버는 유지됩니다.',
                            body: { action: 'revoke', groupId: group.id },
                          })
                        }
                      >
                        초대 취소
                      </button>
                    </>
                  )}
                </div>
              )}
              <button
                className="danger-link"
                onClick={() =>
                  setConfirm({
                    message: manager
                      ? `그룹과 공유된 여행 ${group.planCount}개를 삭제할까요? 각자의 개인 여행은 유지됩니다.`
                      : '이 그룹에서 나갈까요? 다시 참여하려면 새 초대가 필요합니다.',
                    body: {
                      action: manager ? 'deleteGroup' : 'leave',
                      groupId: group.id,
                    },
                  })
                }
              >
                {manager ? '그룹 삭제' : '그룹 나가기'}
              </button>
            </section>
          )}
        </>
      )}
      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>계속할까요?</AlertDialogTitle>
          <AlertDialogDescription>{confirm?.message}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
            <Button
              disabled={busy}
              onClick={async () => {
                if (!confirm) return;
                const d = await run(confirm.body);
                if (d) setConfirm(null);
              }}
            >
              확인
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
