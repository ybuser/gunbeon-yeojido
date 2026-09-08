'use client';
import { useState } from 'react';
import { Clock3, Check, Play, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  assessOuting,
  resolveEntry,
  entryKey,
  localInputDate,
  parseKoreaInput,
  type ActiveOuting,
  type Entry,
  type Place,
  type Settings,
} from '@/lib/domain';
import { scheduleTime } from './trip-builder';
export default function OutingPanel({
  active,
  candidate,
  entries,
  places,
  settings,
  now,
  onChange,
  onCandidate,
  onComplete,
  onPlan,
}: {
  active: ActiveOuting | null;
  candidate: Entry | null;
  entries: Entry[];
  places: Place[];
  settings: Settings;
  now: Date;
  onChange: (v: ActiveOuting | null) => void;
  onCandidate: (v: Entry | null) => void;
  onComplete: (e: Entry) => void;
  onPlan: () => void;
}) {
  const [deadline, setDeadline] = useState(
    localInputDate(
      new Date(
        Date.now() +
          (candidate?.plan?.timeBudgetMinutes || settings.duration) * 60000,
      ).toISOString(),
    ),
  );
  const [error, setError] = useState('');
  const [end, setEnd] = useState(false);
  const live = active ? assessOuting(active, places, now) : null;
  const resolved = candidate ? resolveEntry(candidate, places) : null;
  return (
    <main className="outing-page content-page">
      <div className="content-heading">
        <div>
          <h1>현재 출타</h1>
          <p>출발한 뒤, 지금 남은 시간과 다음 장소를 확인해요.</p>
        </div>
        <Clock3 size={30} />
      </div>
      {!active ? (
        <>
          <section className="outing-empty">
            <Play size={30} />
            <h2>출발할 때 시작하세요</h2>
            <p>
              계획한 일정은 그대로 두고
              <br />
              현재 시각으로 남은 시간을 계산합니다.
            </p>
          </section>
          {entries
            .filter((e) => e.plan?.stops.length && !e.completedAt)
            .map((e) => (
              <button
                className="outing-plan"
                key={entryKey(e)}
                onClick={() => onCandidate(e)}
              >
                <span>
                  <strong>{e.title}</strong>
                  <small>{e.plan!.stops.length}곳 · 출타 시작 준비</small>
                </span>
                <ArrowRight size={20} />
              </button>
            ))}
          <Button variant="outline" onClick={onPlan}>
            여행 계획 보러 가기
          </Button>
        </>
      ) : (
        <>
          <section className="outing-clock" aria-label="현재 출타 시계">
            <span>돌아올 때까지 · 현재 시각 기준</span>
            <strong>
              {Math.max(
                0,
                Math.floor(
                  (Date.parse(active.startedAt) +
                    active.timeBudgetMinutes * 60000 -
                    now.getTime()) /
                    60000,
                ),
              )}
              <small>분</small>
            </strong>
            <p>
              {scheduleTime(
                Date.parse(active.startedAt) + active.timeBudgetMinutes * 60000,
              )}
              까지
            </p>
          </section>
          <h2>{active.entry.title}</h2>
          {live ? (
            <>
              <div className={'outing-margin ' + live.score.band}>
                <span>남은 장소와 돌아가는 이동을 포함하면</span>
                <b>
                  {live.score.margin == null
                    ? '위치 확인 후 계산'
                    : live.score.margin >= 0
                      ? `복귀 여유 +${live.score.margin}분`
                      : `복귀 시간 ${Math.abs(live.score.margin)}분 부족`}
                </b>
              </div>
              <p className="helper">
                마지막으로 확인한 장소 기준의 거리 추정입니다. 실제 이동 위치를
                추적하지 않습니다.
              </p>
              <ol className="outing-timeline">
                {live.mission.stops.map((s, i) => (
                  <li
                    className={
                      i < active.completedStops
                        ? 'done'
                        : i === active.completedStops
                          ? 'next'
                          : ''
                    }
                    key={s.place.id}
                  >
                    <span>
                      {i < active.completedStops ? <Check size={17} /> : i + 1}
                    </span>
                    <div>
                      <strong>{s.place.title}</strong>
                      <small>
                        {i < active.completedStops
                          ? '일정 마침'
                          : i === active.completedStops
                            ? '다음 장소'
                            : `${s.stay}분 머무름`}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
              {active.completedStops < live.mission.stops.length ? (
                <Button
                  className="primary-cta"
                  onClick={() =>
                    onChange({
                      ...active,
                      completedStops: active.completedStops + 1,
                    })
                  }
                >
                  이 장소 일정 마침
                </Button>
              ) : (
                <p className="outing-return">
                  장소 일정을 모두 마쳤어요. {live.origin.title}까지 돌아갈
                  시간을 확인하세요.
                </p>
              )}
              {active.completedStops > 0 && (
                <button
                  className="text-action"
                  onClick={() =>
                    onChange({
                      ...active,
                      completedStops: active.completedStops - 1,
                    })
                  }
                >
                  마지막 진행 되돌리기
                </button>
              )}
            </>
          ) : (
            <p className="warning">
              저장한 장소를 확인하고 있습니다. 연결이 안 되면 내 여행에서 장소를
              다시 확인해 주세요.
            </p>
          )}
          <div className="outing-actions">
            <Button onClick={() => onComplete(active.entry)}>여행 완료</Button>
            <Button variant="outline" onClick={() => setEnd(true)}>
              출타 시계 종료
            </Button>
          </div>
        </>
      )}
      <AlertDialog
        open={Boolean(candidate && !active)}
        onOpenChange={(v) => !v && onCandidate(null)}
      >
        <AlertDialogContent>
          <AlertDialogTitle>지금 출발할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            실제 출타 시계가 시작됩니다. 저장한 계획의 날짜와 시간은 바뀌지
            않아요.
          </AlertDialogDescription>
          <strong>{candidate?.title}</strong>
          <label className="builder-field">
            오늘 돌아올 시각
            <Input
              aria-label="오늘 돌아올 시각"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
          {!resolved?.origin && <p>만나는 장소와 위치를 먼저 설정해 주세요.</p>}
          {error && <p role="alert">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>아직 출발 전</AlertDialogCancel>
            <Button
              disabled={!resolved?.origin || !candidate?.plan?.stops.length}
              onClick={() => {
                const start = new Date();
                const minutes = Math.round(
                  (Date.parse(parseKoreaInput(deadline)) - start.getTime()) /
                    60000,
                );
                if (
                  !Number.isFinite(minutes) ||
                  minutes <= 0 ||
                  minutes > 10080
                ) {
                  setError(
                    '지금 이후부터 7일 이내로 돌아올 시각을 설정해 주세요.',
                  );
                  return;
                }
                onChange({
                  entry: structuredClone(candidate!),
                  startedAt: start.toISOString(),
                  timeBudgetMinutes: minutes,
                  completedStops: 0,
                  settings: {
                    transport:
                      resolved!.mission.transport || settings.transport,
                    companion: settings.companion,
                    walkLimit: settings.walkLimit,
                    extraBuffer: settings.extraBuffer,
                  },
                });
                onCandidate(null);
              }}
            >
              출타 시작
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={end} onOpenChange={setEnd}>
        <AlertDialogContent>
          <AlertDialogTitle>현재 출타 시계를 종료할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            여행 계획은 남습니다. 여행 완료나 스탬프는 기록되지 않아요.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>계속 보기</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onChange(null);
                setEnd(false);
              }}
            >
              시계만 종료
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
