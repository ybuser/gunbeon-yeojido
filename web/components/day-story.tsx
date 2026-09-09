'use client';
import { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  ArrowLeft,
  ArrowRight,
  Check,
  Users,
  X,
} from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from './ui/dialog';
import CourseCover from './course-cover';
import type { Place } from '@/lib/domain';
const starts = [0, 3000, 6000, 10000];
const scenes = [
  [
    '기다리던 휴가, 누구와 만날까요?',
    '가족, 연인, 친구. 함께 갈 사람과 그룹으로 여행을 준비해요.',
  ],
  [
    '함께 갈 곳을 골라요.',
    '코스를 가져오거나 빈 일정부터 시작해요. 날짜는 일정표에서 정하면 돼요.',
  ],
  [
    '걷는 시간도, 돌아갈 여유도.',
    '출발 전 여유 조정에서 한 곳을 덜 들르거나 머무는 시간을 줄여 비교해요.',
  ],
  [
    '다녀온 하루는, 우리 기록으로.',
    '여행 완료에서 다녀온 관광지를 확인하면 하루의 한 장이 남아요. 공유는 내가 선택해요.',
  ],
];
export default function DayStory({
  places,
  onBrowse,
  onJoin,
}: {
  places: Place[];
  onBrowse: () => void;
  onJoin: () => void;
}) {
  const [open, setOpen] = useState(false),
    [elapsed, setElapsed] = useState(0),
    [playing, setPlaying] = useState(false),
    [reduced, setReduced] = useState(false);
  const step = starts.findLastIndex((start) => elapsed >= start);
  const names = ['고성 왕곡마을', '송지호관망타워', '송지호 해수욕장'];
  const sample = names.flatMap((title) => {
    const place = places.find(
      (p) => p.title === title && p.source !== 'manual',
    );
    return place ? [place] : [];
  });
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => {
      setReduced(media.matches);
      if (media.matches) setPlaying(false);
    };
    change();
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (!open || !playing || elapsed >= 16000) return;
    const timer = setInterval(
      () => setElapsed((value) => Math.min(16000, value + 100)),
      100,
    );
    return () => clearInterval(timer);
  }, [open, playing, elapsed >= 16000]);
  useEffect(() => {
    if (!open) return;
    const pause = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, [open]);
  const enter = (action: () => void) => {
    setOpen(false);
    setPlaying(false);
    action();
  };
  return (
    <>
      <button
        className="day-story-link"
        onClick={() => {
          setElapsed(0);
          setPlaying(!reduced);
          setOpen(true);
        }}
      >
        <Play size={15} />
        16초로 사용법 보기
      </button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setPlaying(false);
        }}
      >
        <DialogContent className="day-story-dialog" showCloseButton={false}>
          <div className="day-story-header">
            <span>군번여지도 강원</span>
            <DialogClose className="day-story-skip">
              바로 시작
              <X size={16} />
            </DialogClose>
          </div>
          <div
            className="day-story-progress"
            aria-label={`사용법 ${step + 1} / 4장면`}
          >
            {starts.map((start, i) => (
              <span key={start}>
                <span
                  style={{
                    width:
                      i < step
                        ? '100%'
                        : i === step
                          ? ((elapsed - start) /
                              ((starts[i + 1] || 16000) - start)) *
                              100 +
                            '%'
                          : '0%',
                  }}
                />
              </span>
            ))}
          </div>
          <span className="section-overline">기다리던 하루를, 함께.</span>
          <div
            className="day-story-copy"
            aria-live={playing && elapsed < 16000 ? 'off' : 'polite'}
          >
            <DialogTitle>{scenes[step][0]}</DialogTitle>
            <DialogDescription>{scenes[step][1]}</DialogDescription>
          </div>
          <div
            className={'day-story-scene scene-' + step}
            key={step}
            aria-label="사용 방법 예시"
          >
            <span className="day-story-example">사용 예시</span>
            {step === 0 ? (
              <div className="day-story-group">
                <Users size={25} />
                <strong>친구들과의 고성 여행</strong>
                <span>나 · 함께할 사람들</span>
                <div>장소를 함께 고르고, 일정을 나눠요.</div>
              </div>
            ) : step === 1 ? (
              <>
                <CourseCover places={sample} />
                <div className="day-story-route">
                  {names.map((name, i) => (
                    <span key={name}>
                      {i + 1} · {name}
                    </span>
                  ))}
                </div>
              </>
            ) : step === 2 ? (
              <div className="day-story-compare">
                <span>한 곳 덜 들르면?</span>
                <div>
                  <strong>3곳</strong>
                  <ArrowRight size={22} />
                  <strong>2곳</strong>
                </div>
                <p>
                  이동·체류를 다시 계산하고
                  <br />
                  마음에 드는 안으로 바꿔요.
                </p>
                <small>적용 전 비교 · 적용 후 되돌리기</small>
              </div>
            ) : (
              <div className="day-story-memory">
                <span>하루의 한 장</span>
                <h3>고성에서 보낸 하루</h3>
                <p>
                  내가 확인한 관광지만
                  <br />
                  기록으로 남겨요.
                </p>
                <span>
                  <Check size={16} />
                  직접 남기는 여행 기록
                </span>
              </div>
            )}
          </div>
          <div className="day-story-controls">
            <Button
              variant="ghost"
              aria-label="이전 장면"
              disabled={step === 0}
              onClick={() => {
                setPlaying(false);
                setElapsed(starts[step - 1]);
              }}
            >
              <ArrowLeft size={18} />
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (elapsed >= 16000) setElapsed(0);
                setPlaying(!playing || elapsed >= 16000);
              }}
            >
              {playing && elapsed < 16000 ? (
                <Pause size={16} />
              ) : (
                <Play size={16} />
              )}
              {playing && elapsed < 16000
                ? '일시정지'
                : elapsed >= 16000
                  ? '다시 보기'
                  : '재생'}
            </Button>
            <Button
              variant="ghost"
              aria-label="다음 장면"
              disabled={step === 3}
              onClick={() => {
                setPlaying(false);
                setElapsed(starts[step + 1]);
              }}
            >
              <ArrowRight size={18} />
            </Button>
          </div>
          {reduced && (
            <p className="helper">
              모션 감소 설정에 맞춰 정지 화면으로 시작했어요.
            </p>
          )}
          <div className="day-story-actions">
            <Button onClick={() => enter(onBrowse)}>코스 둘러보기</Button>
            <Button variant="outline" onClick={() => enter(onJoin)}>
              초대받은 그룹 들어가기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
