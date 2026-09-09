'use client';
import { useState } from 'react';
import { ArrowUpRight, Check, Link2, Download, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import CourseCover from './course-cover';
import {
  adviceQuestions,
  type AdviceDetail,
  type AdviceSnapshot,
  type PublicPlace,
} from '@/lib/advice-model';
import { adviceLabel, downloadAdviceCard } from '@/lib/advice-client';
export function AdviceRoute({
  snapshot,
  places,
}: {
  snapshot: AdviceSnapshot;
  places: PublicPlace[];
}) {
  return (
    <div className="advice-route">
      <CourseCover
        places={snapshot.placeIds.map(
          (id) =>
            places.find((p) => p.id === id) || {
              id,
              title: '관광정보 조회 대기',
              image_url: null,
            },
        )}
      />
      <ol>
        {snapshot.placeIds.map((id, i) => (
          <li key={id}>
            <span>{String(i + 1).padStart(2, '0')}</span>
            <strong>
              {places.find((p) => p.id === id)?.title || '관광정보 조회 대기'}
            </strong>
          </li>
        ))}
      </ol>
    </div>
  );
}
export function AdviceShareTools({
  id,
  snapshot,
  places,
}: {
  id: string;
  snapshot: AdviceSnapshot;
  places: PublicPlace[];
}) {
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [imageSaved, setImageSaved] = useState(false);
  const url = () => window.location.origin + '/p/' + id;
  async function run(fn: () => Promise<void>, text: string) {
    setBusy(true);
    try {
      await fn();
      setMessage(text);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '공유를 취소했어요.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="advice-share-tools">
      <div className="advice-button-row">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            run(
              () => navigator.clipboard.writeText(url()),
              '링크를 복사했어요. 누구나 열어 한 수를 보탤 수 있습니다.',
            )
          }
        >
          <Link2 size={16} />
          {imageSaved ? '다음: 링크 복사' : '링크 복사'}
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await downloadAdviceCard(snapshot, places, url());
              setImageSaved(true);
            }, 'PNG를 저장했어요. 다음으로 링크를 복사한 뒤, 인스타 스토리의 링크 스티커에 붙여주세요.')
          }
        >
          <Download size={16} />
          스토리 이미지
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            window.open(
              'https://twitter.com/intent/tweet?' +
                new URLSearchParams({
                  text:
                    snapshot.region +
                    ' 하루 코스. ' +
                    adviceQuestions[snapshot.question] +
                    ' 한 수 보태주세요.',
                  url: url(),
                }),
              '_blank',
              'noopener,noreferrer',
            )
          }
        >
          X에 공유
          <ArrowUpRight size={16} />
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            run(async () => {
              if (navigator.share)
                await navigator.share({
                  title: adviceQuestions[snapshot.question],
                  url: url(),
                });
              else await navigator.clipboard.writeText(url());
            }, '공유창을 열었거나 링크를 복사했어요. 게시 여부는 선택한 앱에서 확인하세요.')
          }
        >
          다른 앱으로
        </Button>
      </div>
      <p className="advice-note">
        인스타그램에는 이미지와 링크 스티커를 함께 올려주세요. 게시 버튼은 직접
        눌러요.
      </p>
      <p className="advice-feedback" role="status">
        {message}
      </p>
    </div>
  );
}
export function AdviceCards({
  detail,
  busy,
  onAction,
  onReview,
  publicView = false,
}: {
  detail: AdviceDetail;
  busy: boolean;
  publicView?: boolean;
  onAction: (action: string, id: string) => void;
  onReview?: (s: AdviceDetail['suggestions'][number]) => void;
}) {
  const visible = detail.suggestions.filter(
    (s) => s.status !== 'hidden' || detail.owner || s.own,
  );
  return (
    <section className="advice-responses">
      <div className="advice-section-heading">
        <h2>
          모인 한 수{' '}
          <span>{visible.filter((s) => s.status !== 'hidden').length}</span>
        </h2>
        <small>경험과 취향을 나누는 제안이에요</small>
      </div>
      {!visible.length && (
        <div className="advice-empty">
          <strong>첫 번째 한 수를 기다리고 있어요</strong>
          <p>밥 한 끼를 더해도, 한 곳을 덜어내도 좋아요.</p>
        </div>
      )}
      {visible.map((s) => (
        <article key={s.id} className={'advice-response ' + s.status}>
          <div className="advice-response-top">
            <span>
              {s.kind === 'replace'
                ? '대신 이곳'
                : s.kind === 'add'
                  ? '한 곳 보태기'
                  : '조금 여유 있게'}
            </span>
            {s.status === 'adopted' ? (
              <b>
                <Check size={14} />
                작성자가 계획에 반영했어요
              </b>
            ) : s.status === 'hidden' ? (
              <b>숨긴 제안</b>
            ) : s.own ? (
              <b>내가 남긴 한 수</b>
            ) : null}
          </div>
          <h3>{adviceLabel(s, detail.places)}</h3>
          <p>{s.reason}</p>
          <div className="advice-button-row">
            {detail.owner && !publicView && (
              <>
                {s.status === 'pending' && onReview && (
                  <Button disabled={busy} onClick={() => onReview(s)}>
                    내 계획에서 검토
                  </Button>
                )}
                {s.status === 'adopted' && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => onAction('unmark', s.id)}
                  >
                    반영 표시 취소
                  </Button>
                )}
                {s.status !== 'hidden' && (
                  <button
                    disabled={busy}
                    onClick={() => onAction('hide', s.id)}
                  >
                    숨기기{s.reported ? ' · 신고 접수' : ''}
                  </button>
                )}
              </>
            )}
            {detail.owner && publicView && (
              <a
                className="advice-text-button"
                href={'/?advice=' + detail.id + '#passport'}
              >
                내 여행에서 관리
              </a>
            )}
            {s.own && (
              <button
                disabled={busy}
                onClick={() => onAction('withdraw', s.id)}
              >
                내 제안 삭제
              </button>
            )}
            {!detail.owner && !s.own && (
              <button
                disabled={busy || s.reported}
                onClick={() => onAction('report', s.id)}
              >
                {s.reported ? '작성자에게 알렸어요' : '맞지 않는 제안 알리기'}
              </button>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
