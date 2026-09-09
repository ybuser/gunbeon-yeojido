'use client';
import { useState } from 'react';
import { ArrowRight, Undo2, SlidersHorizontal, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from './ui/dialog';
import {
  comparePlanAdjustment,
  stopSignature,
  type Adjustment,
} from '@/lib/day-passport';
import type { Mission, Place, Settings, Stop } from '@/lib/domain';

export default function PlanAdjustment({
  mission,
  settings,
  origin,
  unresolved = false,
  onApply,
}: {
  mission: Mission;
  settings: Settings;
  origin?: Place;
  unresolved?: boolean;
  onApply: (stops: Stop[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Adjustment['kind']>('remove');
  const [index, setIndex] = useState(0);
  const [minutes, setMinutes] = useState(30);
  const [undo, setUndo] = useState<{ before: Stop[]; after: string } | null>(
    null,
  );
  const [message, setMessage] = useState('');
  const stop = mission.stops[index];
  const comparison = unresolved
    ? null
    : comparePlanAdjustment(
        mission,
        settings,
        origin,
        kind === 'remove' ? { kind, index } : { kind, index, minutes },
      );
  const canUndo = undo?.after === stopSignature(mission);
  const canRemove = (i: number) =>
    !!mission.stops[i] &&
    mission.stops.length > 1 &&
    mission.stops[i].place.id !== origin?.id &&
    !mission.stops[i].place.reservation_required;
  const choose = (i: number) => {
    setIndex(i);
    setMinutes(Math.max(5, mission.stops[i].walk, mission.stops[i].stay - 15));
    if (!canRemove(i)) setKind('stay');
  };
  const begin = () => {
    const candidate = mission.stops.findLastIndex((_, i) => canRemove(i));
    choose(Math.max(0, candidate));
    setKind(candidate >= 0 ? 'remove' : 'stay');
    setOpen(true);
  };
  return (
    <section className="day-adjustment" aria-label="여유 조정">
      <div>
        <span className="section-overline">출발 전, 여유 조정</span>
        <h3>조금 느긋하게 다녀오려면</h3>
        <p>한 곳 덜 들르거나, 머무는 시간을 바꿔 비교해요.</p>
      </div>
      <Button
        variant="outline"
        onClick={begin}
        disabled={!mission.stops.length || unresolved}
      >
        <SlidersHorizontal size={17} />
        여유 조정
      </Button>
      {unresolved && (
        <p>
          불러오지 못한 장소를 먼저 확인하면 전체 일정으로 비교할 수 있어요.
        </p>
      )}
      {canUndo && (
        <button
          className="text-action"
          onClick={() => {
            onApply(undo!.before);
            setUndo(null);
            setMessage('조정 전 장소와 시간으로 되돌렸어요.');
          }}
        >
          <Undo2 size={16} />
          방금 조정 되돌리기
        </button>
      )}
      {message && <p role="status">{message}</p>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="day-adjust-dialog" showCloseButton={false}>
          <DialogClose className="day-dialog-close" aria-label="여유 조정 닫기">
            <X size={20} />
          </DialogClose>
          <span className="section-overline">
            {mission.region} · 출발 전 계획
          </span>
          <DialogTitle>이 하루에 여유를 남겨요</DialogTitle>
          <DialogDescription>
            원래 계획과 비교한 뒤 선택하세요. 적용 전에는 일정이 바뀌지 않아요.
          </DialogDescription>
          <label className="builder-field">
            조정할 장소
            <select
              aria-label="조정할 장소"
              value={index}
              onChange={(e) => choose(Number(e.target.value))}
            >
              {mission.stops.map((s, i) => (
                <option key={s.place.id} value={i}>
                  {i + 1}. {s.place.title}
                </option>
              ))}
            </select>
          </label>
          <div className="day-adjust-options" aria-label="조정 방법">
            <Button
              variant={kind === 'remove' ? 'default' : 'outline'}
              aria-pressed={kind === 'remove'}
              disabled={!canRemove(index)}
              onClick={() => setKind('remove')}
            >
              한 곳 덜 들르기
            </Button>
            <Button
              variant={kind === 'stay' ? 'default' : 'outline'}
              aria-pressed={kind === 'stay'}
              onClick={() => setKind('stay')}
            >
              머무는 시간 줄이기
            </Button>
          </div>
          {kind === 'stay' && (
            <label className="builder-field">
              머무는 시간 · 도보 포함 (분)
              <Input
                aria-label="조정 후 머무는 시간"
                type="number"
                min={Math.max(5, stop?.walk || 0)}
                max={(stop?.stay || 5) - 1}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
              <small>
                도보 {stop?.walk || 0}분은 그대로 두고, 머무름 {stop?.stay || 0}
                분보다 짧게 정해요.
              </small>
            </label>
          )}
          {stop?.place.reservation_required && (
            <p className="helper">
              예약이 필요한 장소예요. 생략 대신 예약 조건에 맞게 시간을 직접
              확인하세요.
            </p>
          )}
          {comparison ? (
            <>
              <div className="day-comparison" role="status" aria-live="polite">
                <div>
                  <span>현재 계획</span>
                  <strong>
                    {comparison.before.margin! >= 0 ? '+' : ''}
                    {comparison.before.margin}분
                  </strong>
                  <small>
                    {mission.stops.length}곳 · 도보 추정{' '}
                    {comparison.before.walk}분
                  </small>
                </div>
                <ArrowRight size={20} aria-hidden="true" />
                <div>
                  <span>조정 후 복귀 여유</span>
                  <strong>
                    {comparison.after.margin! >= 0 ? '+' : ''}
                    {comparison.after.margin}분
                  </strong>
                  <small>
                    {comparison.adjusted.stops.length}곳 · 도보 추정{' '}
                    {comparison.after.walk}분
                  </small>
                </div>
              </div>
              <p className="day-adjust-difference">
                {comparison.minutesGained > 0
                  ? `돌아갈 여유가 ${comparison.minutesGained}분 늘어요.`
                  : comparison.minutesGained < 0
                    ? `연결 이동을 다시 계산하면 ${Math.abs(comparison.minutesGained)}분 더 필요해요.`
                    : '돌아갈 여유는 같아요.'}
              </p>
              <p className="day-change-description">
                {kind === 'remove'
                  ? `${stop.place.title} 방문을 이번 일정에서 제외해요.`
                  : `${stop.place.title}: 머무름 ${stop.stay}분 → ${minutes}분. 도보는 그대로예요.`}
              </p>
              <details>
                <summary>계산과 방문 조건 확인</summary>
                <p>
                  장소를 바꾸면 만남 장소부터 돌아오는 이동·교통 대기·날씨·동행
                  여유를 다시 계산해요. 실제 교통과 복귀 규정은 직접 확인하세요.
                </p>
                <ul>
                  {comparison.after.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </details>
              <Button
                className="day-apply"
                onClick={() => {
                  setUndo({
                    before: mission.stops,
                    after: stopSignature(comparison.adjusted),
                  });
                  onApply(comparison.adjusted.stops);
                  setMessage(
                    '일정표에 반영했어요. 아래 저장 버튼을 누르면 여행에 남아요.',
                  );
                  setOpen(false);
                }}
              >
                이 안으로 일정표에 적용
              </Button>
            </>
          ) : (
            <p className="warning" role="status">
              비교하려면 만나는 장소·각 장소의 위치·출발과 돌아올 시각·머무는
              시간을 확인해 주세요. 만남 장소와 예약 장소는 생략하지 않아요.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
