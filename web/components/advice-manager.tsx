'use client';
import { durableTravelEntry } from '@/lib/account-client';
import { useEffect, useState } from 'react';
import { ArrowUpRight, RefreshCw, X } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetHeader,
} from './ui/sheet';
import { AdviceRoute, AdviceShareTools, AdviceCards } from './advice-shared';
import {
  adviceQuestions,
  adviceProjection,
  adviceIsApplied,
  type AdviceDetail,
  type AdviceSuggestion,
  type AdviceSnapshot,
} from '@/lib/advice-model';
import { adviceRequest } from '@/lib/advice-client';
import type { Entry, Place } from '@/lib/domain';
export default function AdviceManager({
  entry,
  places,
  onClose,
  onPublish,
  onReview,
  onReceiptCleared,
}: {
  entry: Entry;
  places: Place[];
  onClose: () => void;
  onPublish: (id: string | undefined) => void;
  onReview: (s: AdviceSuggestion, id: string) => void;
  onReceiptCleared: () => void;
}) {
  const [question, setQuestion] =
      useState<AdviceSnapshot['question']>('change'),
    [excluded, setExcluded] = useState<string[]>([]),
    [detail, setDetail] = useState<AdviceDetail | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [confirmDelete, setConfirmDelete] = useState(false),
    [failed, setFailed] = useState(false);
  const projection = adviceProjection(entry, places, question),
    snapshot = {
      ...projection,
      placeIds: projection.placeIds.filter((id) => !excluded.includes(id)),
    };
  async function load(next = 1) {
    if (!entry.adviceShareId) return;
    setBusy(true);
    try {
      const data = await adviceRequest<AdviceDetail>(
        '/api/advice?id=' + entry.adviceShareId + '&page=' + next,
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
      setFailed(false);
    } catch (e) {
      setMessage((e as Error).message);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, [entry.adviceShareId]);
  async function publish() {
    setBusy(true);
    try {
      const data = await adviceRequest<{ id: string }>('/api/advice', {
        action: 'create',
        snapshot,
      });
      onPublish(data.id);
      setMessage(
        '공유 링크를 만들었어요. 아래 링크를 보내 한 수를 받아보세요.',
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function action(action: string, suggestionId?: string) {
    if (!entry.adviceShareId) return;
    setBusy(true);
    try {
      if (action === 'adopt') {
        let saved: Entry | undefined;
        try {
          saved = await durableTravelEntry(entry.recordId || entry.missionId);
        } catch {}
        const proposal = detail?.suggestions.find((s) => s.id === suggestionId);
        if (!saved || !proposal || !adviceIsApplied(saved, proposal))
          throw new Error(
            '저장된 계획을 확인하지 못했어요. 먼저 계획을 다시 저장해 주세요.',
          );
      }
      await adviceRequest('/api/advice', {
        action,
        id: entry.adviceShareId,
        suggestionId,
      });
      if (action === 'delete') {
        onPublish(undefined);
        setDetail(null);
        setConfirmDelete(false);
        setMessage('공유 링크와 제안을 삭제했어요. 개인 계획은 그대로입니다.');
        return;
      }
      if (action === 'adopt') onReceiptCleared();
      await load();
      setMessage(
        action === 'adopt'
          ? '개인 계획에 저장된 한 수를 반영으로 표시했어요.'
          : action === 'unmark'
            ? '반영 표시를 취소했어요. 개인 계획 자체는 바뀌지 않습니다.'
            : '공유 설정을 변경했어요.',
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const pendingReceipt =
    entry.adviceReceipt &&
    detail?.suggestions.find(
      (s) =>
        s.id === entry.adviceReceipt?.suggestionId &&
        s.status === 'pending' &&
        adviceIsApplied(entry, s),
    );
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="advice-sheet">
        <SheetHeader>
          <SheetTitle>한 수 보태기</SheetTitle>
          <SheetDescription>
            {entry.adviceShareId
              ? '받은 아이디어를 살펴보고 내 여행을 다듬어요.'
              : '관광지 한 곳의 차이가 하루를 바꿔요. 여행안을 공유하고 아이디어를 받아보세요.'}
          </SheetDescription>
        </SheetHeader>
        <div className="advice-manager-body">
          {entry.adviceShareId ? (
            detail ? (
              <>
                <div className="advice-section-heading">
                  <h2>{adviceQuestions[detail.snapshot.question]}</h2>
                  <span>
                    {Date.parse(detail.expiresAt) < Date.now()
                      ? '공유 기간 종료'
                      : detail.status === 'open'
                        ? '제안 받는 중'
                        : '제안 마감'}
                  </span>
                </div>
                <AdviceRoute
                  snapshot={detail.snapshot}
                  places={detail.places}
                />
                <p className="advice-note">
                  처음 공유한 여행안입니다. 이후 개인 일정 수정은 자동 공개되지
                  않아요.
                </p>
                <AdviceShareTools
                  id={detail.id}
                  snapshot={detail.snapshot}
                  places={detail.places}
                />
                <a
                  className="advice-text-button"
                  href={'/p/' + detail.id}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  방문자가 보는 페이지
                  <ArrowUpRight size={16} />
                </a>
                {pendingReceipt && (
                  <div className="advice-receipt">
                    <strong>
                      계획은 저장됐어요. 반영 표시를 마무리해 주세요.
                    </strong>
                    <p>
                      연결이 끊겨도 저장한 여행에 제안을 다시 덧붙이지 않아요.
                    </p>
                    <Button
                      disabled={busy}
                      onClick={() => action('adopt', pendingReceipt.id)}
                    >
                      저장한 한 수 반영 표시
                    </Button>
                  </div>
                )}
                <AdviceCards
                  detail={detail}
                  busy={busy}
                  onAction={action}
                  onReview={(s) => onReview(s, detail.id)}
                />
                <div className="advice-manage-footer">
                  {detail.hasMore && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => load(detail.page + 1)}
                    >
                      한 수 더 보기
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => load()}
                  >
                    <RefreshCw size={16} />새 한 수 확인
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      action(detail.status === 'open' ? 'close' : 'reopen')
                    }
                  >
                    {detail.status === 'open'
                      ? '제안 마감하기'
                      : '다시 제안 받기'}
                  </Button>
                  <button
                    disabled={busy}
                    onClick={() => setConfirmDelete(true)}
                  >
                    공유 링크 삭제
                  </button>
                </div>
                {confirmDelete && (
                  <div className="advice-receipt" role="alert">
                    <strong>링크와 모인 제안을 삭제할까요?</strong>
                    <p>외부에 저장된 이미지까지 삭제되지는 않습니다.</p>
                    <div className="advice-button-row">
                      <Button
                        variant="outline"
                        onClick={() => setConfirmDelete(false)}
                      >
                        유지하기
                      </Button>
                      <Button disabled={busy} onClick={() => action('delete')}>
                        공유 삭제 확인
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="advice-empty">
                <p>
                  {failed
                    ? '공유를 확인할 수 없어요. 만든 계정 또는 브라우저인지 확인해 주세요.'
                    : '공유한 여행을 확인하고 있어요.'}
                </p>
                {failed && (
                  <>
                    <Button onClick={() => load()}>다시 확인</Button>
                    <button
                      onClick={() => {
                        onPublish(undefined);
                        setFailed(false);
                        setMessage(
                          '기존 링크는 그대로일 수 있어요. 새 공유를 만들기 전 확인해 주세요.',
                        );
                      }}
                    >
                      이 계획에서 링크 연결 해제
                    </button>
                  </>
                )}
              </div>
            )
          ) : (
            <>
              <p className="advice-eyebrow">01 · 질문 하나만 골라요</p>
              <div className="advice-question-options">
                {Object.entries(adviceQuestions).map(([key, label]) => (
                  <button
                    key={key}
                    aria-pressed={question === key}
                    onClick={() =>
                      setQuestion(key as AdviceSnapshot['question'])
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="advice-eyebrow">02 · 공개할 관광지를 확인해요</p>
              <fieldset className="advice-publish-places">
                <legend className="sr-only">공개 관광지 선택</legend>
                {projection.placeIds.map((id) => (
                  <label key={id}>
                    <Checkbox
                      checked={!excluded.includes(id)}
                      onCheckedChange={(checked) =>
                        setExcluded((v) =>
                          checked ? v.filter((x) => x !== id) : [...v, id],
                        )
                      }
                    />
                    <span>{places.find((p) => p.id === id)?.title}</span>
                  </label>
                ))}
              </fieldset>
              {!projection.placeIds.length && (
                <p className="advice-feedback">
                  공유할 관광지가 아직 없어요. 코스에 공개 관광지를 담거나
                  관광정보 조회가 완료된 뒤 다시 열어주세요.
                </p>
              )}
              <p className="advice-note">
                개인 제목, 날짜와 시각, 만남·복귀 장소, 직접 입력 장소, 그룹
                정보는 제외했어요. 선택한 공개 관광지의 순서와 질문만 30일 동안
                링크로 공개합니다.
              </p>
              {!!snapshot.placeIds.length && (
                <AdviceRoute snapshot={snapshot} places={places} />
              )}
              <div className="advice-receipt">
                <strong>링크를 아는 누구나 보고 한 수를 보탤 수 있어요.</strong>
                <p>
                  기존 서비스 입장 비밀번호는 유지돼요. 공유 관리 권한은 만든
                  로그인 계정에 연결됩니다. 체험 중에는 브라우저 쿠키에
                  보관되므로 내 계정에서 가져오기를 완료해 주세요.
                </p>
              </div>
              <Button
                className="advice-submit"
                disabled={busy || !snapshot.placeIds.length}
                onClick={publish}
              >
                {busy ? '링크 만드는 중…' : '이 내용으로 공유 링크 만들기'}
              </Button>
            </>
          )}
          <p className="advice-feedback" role="status">
            {message}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
