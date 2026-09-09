'use client';
import MemoryImage from './memory-image';
import { pageFetch, clearPageCache } from '@/lib/page-cache';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Clock3,
  MapPin,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import MissionMap from './mission-map';
import PlanAdjustment from './plan-adjustment';
import PublicPlacePicker from './public-place-picker';
import CourseCover from './course-cover';
import MeetingPicker, { FavoritePlaces } from './meeting-picker';
import {
  assessPlan,
  planSchedule,
  createEntry,
  distance,
  hasVisitRecord,
  localInputDate,
  manualToPlace,
  parseKoreaInput,
  regionPlaces,
  regions,
  sensitivePlaceText,
  validCoord,
  validManualPlace,
} from '@/lib/domain';
import { withPhoto, photoUrl, placePhoto } from '@/lib/place-photos';
import type {
  Entry,
  ManualPlace,
  Mission,
  Place,
  Settings,
} from '@/lib/domain';

export const scheduleTime = (milliseconds: number) =>
  Number.isFinite(milliseconds)
    ? new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(milliseconds))
    : '이동시간 확인 필요';
const transportOptions = {
  car: '자차',
  transit: '대중교통',
  taxi: '택시+버스',
  unknown: '미정',
};
const categories = {
  all: '전체',
  attraction: '볼거리',
  restaurant: '음식점·카페',
  culture: '문화시설',
};
function Choice({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="builder-field">
      <span>{label}</span>
      <Select value={value} onValueChange={(v) => onChange(String(v))}>
        <SelectTrigger aria-label={label}>
          <SelectValue>{values[value] || '선택해 주세요'}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(values).map(([id, name]) => (
            <SelectItem key={id} value={id}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
type Props = {
  initial: Entry | null;
  mode: 'new' | 'edit' | 'copy';
  places: Place[];
  placesLoading?: boolean;
  initialDirty?: boolean;
  saveTarget?: 'personal' | 'group';
  initialOrigin?: Place;
  settings: Settings;
  mapKey: string;
  favorites: ManualPlace[];
  onFavoritesChange: (places: ManualPlace[]) => void;
  onClose: () => void;
  onSave: (entry: Entry, places: Place[], returnAt: string) => void;
};
export default function TripBuilder({
  initial,
  mode,
  places,
  placesLoading = false,
  initialDirty = false,
  saveTarget = 'personal',
  settings,
  mapKey,
  favorites,
  onFavoritesChange,
  onClose,
  onSave,
}: Props) {
  const [title, setTitle] = useState(
    initial?.title ||
      settings.region.replace(/군|시/g, '') + '에서 보내는 우리 하루',
  );
  const [region] = useState(initial?.region || settings.region);
  const [originId, setOriginId] = useState(
    initial?.plan ? initial.plan.originId : settings.originId || '',
  );
  const [stops, setStops] = useState(initial?.plan?.stops || []);
  const [manuals, setManuals] = useState<ManualPlace[]>(
    initial?.plan?.manualPlaces || [],
  );
  const [extra, setExtra] = useState<Place[]>([]);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [referenceRetry, setReferenceRetry] = useState(0);
  const [departure, setDeparture] = useState(
    localInputDate(initial?.plan?.departureAt || settings.startedAt),
  );
  const [deadline, setDeadline] = useState(
    localInputDate(
      initial?.plan?.timeBudgetMinutes
        ? new Date(
            Date.parse(initial.plan.departureAt || settings.startedAt) +
              (initial.plan.timeBudgetMinutes || 240) * 60000,
          ).toISOString()
        : settings.returnAt,
    ),
  );
  const [transport, setTransport] = useState<Settings['transport']>(
    initial?.plan?.transport || settings.transport,
  );
  const [stage, setStage] = useState<'plan' | 'places' | 'manual'>('plan');
  const [selectionTarget, setSelectionTarget] = useState<'stop' | 'origin'>(
    'stop',
  );
  const [searchRegion, setSearchRegion] = useState(region);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searchState, setSearchState] = useState<
    'idle' | 'loading' | 'done' | 'error'
  >('idle');
  const [page, setPage] = useState(1),
    [total, setTotal] = useState(0);
  const [category, setCategory] = useState('all');
  const searchSerial = useRef(0);
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(initialDirty),
    [confirmClose, setConfirmClose] = useState(false);
  const [manual, setManual] = useState<ManualPlace>({
    id: 'manual:' + crypto.randomUUID(),
    title: '',
    address: '',
    sigungu: region,
    category: 'other',
    lat: null,
    lon: null,
    publicPlaceDeclared: true,
  });

  const allPlaces = useMemo(
    () =>
      [
        ...manuals.filter(validManualPlace).map(manualToPlace),
        ...extra,
        ...places,
      ].map(withPhoto),
    [extra, places, manuals],
  );
  const origin = allPlaces.find((p) => p.id === originId);
  const mapOrigin =
    origin && validCoord(origin)
      ? origin
      : stops
          .map((s) => allPlaces.find((p) => p.id === s.placeId))
          .find((p) => p && validCoord(p)) ||
        allPlaces.find((p) => p.sigungu === region && validCoord(p));
  const missing = stops.filter(
    (s) => !allPlaces.some((p) => p.id === s.placeId),
  );
  const mission = useMemo<Mission>(
    () => ({
      id: initial?.missionId || 'custom:preview',
      title,
      region,
      variant: '내 코스',
      custom: true,
      departureAt: parseKoreaInput(departure),
      transport,
      timeBudgetMinutes: Math.max(
        1,
        Math.round(
          (Date.parse(parseKoreaInput(deadline)) -
            Date.parse(parseKoreaInput(departure))) /
            60000,
        ),
      ),
      brief: '직접 고른 장소와 순서로 계획한 하루입니다.',
      stops: stops.flatMap((s) => {
        const place = allPlaces.find((p) => p.id === s.placeId);
        return place
          ? [
              {
                place,
                stay: s.stay,
                walk: s.walk,
                walkVerified: false as const,
              },
            ]
          : [];
      }),
    }),
    [initial, title, region, departure, deadline, transport, stops, allPlaces],
  );
  const previewSettings = {
    ...settings,
    region,
    transport,
    returnAt: parseKoreaInput(deadline),
    startedAt: parseKoreaInput(departure),
  };
  const schedule =
    origin && !missing.length
      ? planSchedule(mission, previewSettings, origin)
      : null;
  const score =
    origin && stops.length && !missing.length
      ? assessPlan(mission, previewSettings, origin)
      : null;
  const nearby = useMemo(() => {
    const last = mission.stops.at(-1)?.place || origin;
    return regionPlaces(allPlaces, searchRegion)
      .filter(
        (p) =>
          p.source !== 'manual' &&
          !sensitivePlaceText(p.title) &&
          p.category !== 'memorial',
      )
      .sort((a, b) =>
        last && validCoord(last) ? distance(last, a) - distance(last, b) : 0,
      );
  }, [allPlaces, searchRegion, mission, origin]);
  useEffect(() => {
    let ignore = false;
    const ids = [...new Set([originId, ...stops.map((s) => s.placeId)])].filter(
      (id) =>
        id.startsWith('tourapi:') &&
        !places.some((p) => p.id === id) &&
        !extra.some((p) => p.id === id),
    );
    setReferencesLoading(ids.length > 0);
    if (ids.length)
      pageFetch('/api/places/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
        .then((r) => r.json())
        .then((value) => {
          const data = value as { places?: Place[] };
          if (!ignore && data.places?.length)
            setExtra((v) => [...v, ...data.places!]);
        })
        .catch(() => {})
        .finally(() => {
          if (!ignore) setReferencesLoading(false);
        });
    return () => {
      ignore = true;
    };
  }, [originId, stops, places, referenceRetry]);
  const change = () => {
    setDirty(true);
    setNotice('');
  };
  function choose(p: Place) {
    if (p.source === 'manual')
      setManuals((v) => [
        ...v.filter((x) => x.id !== p.id),
        {
          id: p.id,
          title: p.title,
          address: p.address,
          lat: p.lat,
          lon: p.lon,
          sigungu: p.sigungu,
          category: p.category,
        },
      ]);
    if (selectionTarget === 'origin') {
      if (!validCoord(p)) {
        setNotice('만나는 장소는 위치가 확인된 장소를 선택해 주세요.');
        return;
      }
      setOriginId(p.id);
    } else {
      if (stops.some((s) => s.placeId === p.id)) {
        setNotice('이미 이 코스에 담은 장소예요.');
        return;
      }
      if (stops.length >= 12) {
        setNotice('한 코스에는 12곳까지 담을 수 있어요.');
        return;
      }
      setStops((v) => [
        ...v,
        {
          placeId: p.id,
          stay: p.category === 'restaurant' || p.category === 'cafe' ? 45 : 60,
          walk: 15,
        },
      ]);
    }
    setExtra((v) => (v.some((x) => x.id === p.id) ? v : [...v, p]));
    change();
    setStage('plan');
  }
  function move(index: number, direction: number) {
    setStops((v) => {
      const next = [...v];
      [next[index], next[index + direction]] = [
        next[index + direction],
        next[index],
      ];
      return next;
    });
    change();
  }
  async function search(nextPage = 1) {
    if (query.trim().length < 2 || sensitivePlaceText(query)) {
      setNotice('공개 관광장소 이름을 2자 이상 입력해 주세요.');
      return;
    }
    setNotice('');
    setSearchState('loading');
    const serial = ++searchSerial.current;
    try {
      const r = await pageFetch(
        '/api/places/search?' +
          new URLSearchParams({
            region: searchRegion,
            q: query.trim(),
            page: String(nextPage),
          }),
        {},
        { refresh: searchState === 'error' },
      );
      const data = (await r.json()) as {
        places?: Place[];
        total?: number;
        message?: string;
      };
      if (serial !== searchSerial.current) return;
      if (!r.ok) throw new Error(data.message);
      setResults(data.places || []);
      setTotal(data.total || 0);
      setPage(nextPage);
      setSearchState('done');
    } catch (e) {
      if (serial !== searchSerial.current) return;
      setSearchState('error');
      setNotice(e instanceof Error ? e.message : '검색을 연결하지 못했습니다.');
    }
  }
  function save() {
    if (
      title.trim().length < 2 ||
      title.length > 60 ||
      sensitivePlaceText(title)
    ) {
      setNotice('군 정보가 없는 코스 이름을 2~60자로 입력해 주세요.');
      return;
    }
    if (missing.length) {
      setNotice(
        '조회하지 못한 장소는 다시 찾거나 제외해 주세요. 빈 코스도 저장할 수 있어요.',
      );
      return;
    }
    if (
      !Number.isFinite(Date.parse(mission.departureAt!)) ||
      !Number.isFinite(Date.parse(previewSettings.returnAt))
    ) {
      setNotice('출발과 복귀 기준 날짜·시간을 확인해 주세요.');
      return;
    }
    if (
      Date.parse(previewSettings.returnAt) <= Date.parse(mission.departureAt!)
    ) {
      setNotice('복귀 기준시각은 출발시각보다 뒤로 설정해 주세요.');
      return;
    }
    if (
      stops.some(
        (s) =>
          !Number.isFinite(s.stay) ||
          s.stay < 5 ||
          s.stay > 720 ||
          !Number.isFinite(s.walk) ||
          s.walk < 0 ||
          s.walk > s.stay,
      )
    ) {
      setNotice(
        '머무는 시간은 5~720분, 도보는 그 안의 시간으로 입력해 주세요.',
      );
      return;
    }
    const canUpdate = mode === 'edit' && initial && !hasVisitRecord(initial);
    const recordId = canUpdate
      ? initial.recordId || crypto.randomUUID()
      : crypto.randomUUID();
    const entry = createEntry(
      {
        ...mission,
        id: canUpdate ? initial.missionId : 'custom:' + recordId,
        title: title.trim(),
      },
      origin,
      recordId,
    );
    if (canUpdate) entry.stamps = initial.stamps;
    onSave(
      entry,
      allPlaces.filter((p) => p.source !== 'manual'),
      previewSettings.returnAt,
    );
  }
  function manualForm(p?: Place) {
    setManual(
      p
        ? {
            id: p.id,
            title: p.title,
            address: p.address,
            lat: p.lat,
            lon: p.lon,
            sigungu: p.sigungu,
            category: p.category,
            publicPlaceDeclared: true,
          }
        : {
            id: 'manual:' + crypto.randomUUID(),
            title: '',
            address: '',
            lat: null,
            lon: null,
            sigungu: searchRegion,
            category: 'other',
            publicPlaceDeclared: true,
          },
    );
    setStage('manual');
    setNotice('');
  }
  return (
    <>
      <Sheet
        open
        onOpenChange={(open) => {
          if (!open) {
            if (dirty) setConfirmClose(true);
            else onClose();
          }
        }}
      >
        <SheetContent
          side="bottom"
          className="course-builder"
          showCloseButton={false}
        >
          <SheetHeader className="builder-heading">
            <div>
              {stage !== 'plan' && (
                <button
                  className="builder-back"
                  aria-label="코스 편집으로 돌아가기"
                  onClick={() => {
                    setStage('plan');
                    setNotice('');
                  }}
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <div>
                <SheetTitle>
                  {stage === 'places'
                    ? selectionTarget === 'origin'
                      ? '만나는 장소 선택'
                      : '코스에 장소 담기'
                    : stage === 'manual'
                      ? '장소 직접 추가'
                      : mode === 'edit'
                        ? '내 코스 수정하기'
                        : '나만의 코스 만들기'}
                </SheetTitle>
                <SheetDescription>
                  {stage === 'plan'
                    ? '장소와 순서, 머무는 시간을 자유롭게 정해요.'
                    : '일정에 사용할 만남 장소를 정해요.'}
                </SheetDescription>
              </div>
            </div>
            <button
              className="builder-close"
              aria-label="코스 편집 닫기"
              onClick={() => (dirty ? setConfirmClose(true) : onClose())}
            >
              <X size={22} />
            </button>
          </SheetHeader>
          <div className="builder-scroll">
            {stage === 'plan' && (
              <div className="builder-grid">
                <section className="builder-schedule">
                  <label className="builder-field">
                    <span>코스 이름</span>
                    <Input
                      aria-label="코스 이름"
                      value={title}
                      maxLength={60}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        change();
                      }}
                    />
                  </label>
                  <div className="builder-time-fields">
                    <label className="builder-field">
                      <span>출발 날짜·시간</span>
                      <Input
                        type="datetime-local"
                        aria-label="출발 날짜·시간"
                        value={departure}
                        onChange={(e) => {
                          const next = parseKoreaInput(e.target.value),
                            prior = parseKoreaInput(departure);
                          if (next && prior)
                            setDeadline(
                              localInputDate(
                                new Date(
                                  Date.parse(parseKoreaInput(deadline)) +
                                    Date.parse(next) -
                                    Date.parse(prior),
                                ).toISOString(),
                              ),
                            );
                          setDeparture(e.target.value);
                          change();
                        }}
                      />
                    </label>
                    <Choice
                      label="이동수단"
                      value={transport}
                      values={transportOptions}
                      onChange={(v) => {
                        setTransport(v as Settings['transport']);
                        change();
                      }}
                    />
                  </div>
                  <div className="builder-origin">
                    <MapPin size={21} />
                    <div>
                      <span>만나는 곳 · 돌아올 곳</span>
                      <strong>
                        {origin?.title || '즐겨찾기 또는 지도에서 설정'}
                      </strong>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectionTarget('origin');
                        setStage('places');
                        setNotice('');
                      }}
                    >
                      변경
                    </Button>
                  </div>
                  {missing.length > 0 &&
                    !referencesLoading &&
                    !placesLoading && (
                      <div className="warning">
                        저장한 장소 정보를 연결하지 못했습니다.
                        <Button
                          variant="outline"
                          onClick={() => {
                            clearPageCache('/api/places/resolve');
                            setReferenceRetry((v) => v + 1);
                          }}
                        >
                          장소 정보 다시 확인
                        </Button>
                      </div>
                    )}
                  <PlanAdjustment
                    unresolved={missing.length > 0}
                    mission={mission}
                    settings={previewSettings}
                    origin={origin}
                    onApply={(next) => {
                      setStops(
                        next.map((s) => ({
                          placeId: s.place.id,
                          stay: s.stay,
                          walk: s.walk,
                        })),
                      );
                      change();
                    }}
                  />
                  <ol className="builder-stops">
                    {stops.map((stop, i) => {
                      const p = allPlaces.find((p) => p.id === stop.placeId);
                      const time = schedule?.legs[i];
                      return (
                        <li key={stop.placeId} className="builder-stop">
                          <div className="builder-leg">
                            <Clock3 size={14} />
                            {time && Number.isFinite(time.travel)
                              ? `이동 ${time.travel}분 · 준비·대기 ${time.wait}분 추정`
                              : '위치 정보를 확인하면 이동시간을 계산해요'}
                          </div>
                          <div className="builder-stop-top">
                            <span className="builder-number">{i + 1}</span>
                            <div>
                              <strong>
                                {p?.title ||
                                  (referencesLoading || placesLoading
                                    ? '장소 정보를 확인하고 있어요'
                                    : '장소를 다시 조회하지 못했어요')}
                              </strong>
                              <small>
                                {p?.source === 'tourapi'
                                  ? '한국관광공사 관광정보'
                                  : p?.source === 'manual'
                                    ? '직접 지정한 장소'
                                    : '공개 관광자료'}
                              </small>
                            </div>
                            {p?.image_url && (
                              <MemoryImage
                                src={p.image_url}
                                alt=""
                                loading="lazy"
                              />
                            )}
                          </div>
                          <p className="builder-arrival">
                            {time
                              ? scheduleTime(time.arrival)
                              : '시간 확인 필요'}
                            {time && Number.isFinite(time.departure)
                              ? ' – ' + scheduleTime(time.departure)
                              : ''}
                          </p>
                          <div className="builder-stop-controls">
                            <label>
                              머무름{' '}
                              <Input
                                type="number"
                                aria-label={`${i + 1}번 머무는 시간`}
                                min={5}
                                max={720}
                                step={5}
                                value={stop.stay}
                                onChange={(e) => {
                                  setStops((v) =>
                                    v.map((s, n) =>
                                      n === i
                                        ? { ...s, stay: Number(e.target.value) }
                                        : s,
                                    ),
                                  );
                                  change();
                                }}
                              />
                              분
                            </label>
                            <label>
                              그중 도보{' '}
                              <Input
                                type="number"
                                aria-label={`${i + 1}번 도보 시간`}
                                min={0}
                                max={stop.stay}
                                step={5}
                                value={stop.walk}
                                onChange={(e) => {
                                  setStops((v) =>
                                    v.map((s, n) =>
                                      n === i
                                        ? { ...s, walk: Number(e.target.value) }
                                        : s,
                                    ),
                                  );
                                  change();
                                }}
                              />
                              분
                            </label>
                          </div>
                          <div className="builder-stop-actions">
                            <button
                              disabled={!i}
                              aria-label={`${i + 1}번 장소 위로`}
                              onClick={() => move(i, -1)}
                            >
                              <ArrowUp size={17} />
                              위로
                            </button>
                            <button
                              disabled={i === stops.length - 1}
                              aria-label={`${i + 1}번 장소 아래로`}
                              onClick={() => move(i, 1)}
                            >
                              <ArrowDown size={17} />
                              아래로
                            </button>
                            {p?.source === 'manual' && (
                              <button onClick={() => manualForm(p)}>
                                장소 수정
                              </button>
                            )}
                            <button
                              aria-label={`${i + 1}번 장소 삭제`}
                              onClick={() => {
                                setStops((v) => v.filter((_, n) => n !== i));
                                change();
                              }}
                            >
                              <Trash2 size={17} />
                              삭제
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  {!stops.length && (
                    <div className="builder-empty">
                      <MapPin size={28} />
                      <h3>가고 싶은 첫 장소를 담아보세요</h3>
                      <p>
                        관광지부터 식사와 쉬어갈 곳까지,
                        <br />
                        원하는 순서로 하루를 만들 수 있어요.
                      </p>
                    </div>
                  )}
                  <Button
                    className="builder-add"
                    variant="outline"
                    onClick={() => {
                      setSelectionTarget('stop');
                      setStage('places');
                      setNotice('');
                    }}
                    disabled={stops.length >= 12}
                  >
                    <Plus size={19} />
                    장소 추가 <span>{stops.length}/12</span>
                  </Button>
                  {stops.length > 0 && (
                    <div className="builder-return">
                      <MapPin size={18} />
                      <div>
                        <strong>
                          {origin?.title || '만나는 장소'}로 돌아오기
                        </strong>
                        <p>
                          {schedule
                            ? scheduleTime(schedule.returnedAt)
                            : '시간 확인 필요'}{' '}
                          · 안전 여유를 더하기 전
                        </p>
                      </div>
                    </div>
                  )}
                </section>
                <aside className="builder-preview">
                  <CourseCover places={mission.stops.map((s) => s.place)} />
                  <p className="image-attribution">
                    사진: 관광공사·공공누리·Wikimedia Commons. 자세한 표기는
                    여행 정보와 출처에서 확인하세요.
                  </p>
                  {origin && validCoord(origin) && (
                    <MissionMap
                      mission={mission}
                      origin={origin}
                      mapKey={mapKey}
                    />
                  )}
                  <section className="builder-margin">
                    <label className="builder-field">
                      <span>돌아올 예정 시각</span>
                      <Input
                        type="datetime-local"
                        aria-label="돌아올 예정 시각"
                        value={deadline}
                        onChange={(e) => {
                          setDeadline(e.target.value);
                          change();
                        }}
                      />
                    </label>
                    <p>
                      출발 계획과 사용 가능한 시간을 저장합니다. 현재 시각과
                      무관하게 계획할 수 있어요.
                    </p>
                    <div className={score?.band || 'unknown'}>
                      <span>이동·체류·안전 여유를 반영하면</span>
                      <strong>
                        {score?.margin == null
                          ? '복귀 여유 확인 전'
                          : score.margin >= 0
                            ? `복귀 여유 +${score.margin}분`
                            : `복귀 시간 ${Math.abs(score.margin)}분 부족`}
                      </strong>
                    </div>
                    {score?.issues
                      .filter((x) =>
                        /공식|직접 입력|출발|운영 제한|도보 상한/.test(x),
                      )
                      .map((x) => (
                        <p key={x}>{x}</p>
                      ))}
                    <p>
                      이동은 거리 기반 추정입니다. 실제 교통·방문 조건과 소속
                      부대 복귀 규정은 직접 확인해 주세요.
                    </p>
                  </section>
                </aside>
              </div>
            )}
            {stage === 'places' && selectionTarget === 'origin' && (
              <MeetingPicker
                favorites={favorites}
                onFavoritesChange={onFavoritesChange}
                onChoose={choose}
                region={region}
                mapKey={mapKey}
                center={
                  mapOrigin && validCoord(mapOrigin)
                    ? { lat: mapOrigin.lat!, lon: mapOrigin.lon! }
                    : undefined
                }
              />
            )}
            {stage === 'places' && selectionTarget === 'stop' && (
              <section className="builder-finder">
                {favorites.length > 0 && (
                  <section className="finder-favorites">
                    <h3>즐겨찾는 장소</h3>
                    <FavoritePlaces favorites={favorites} onChoose={choose} />
                  </section>
                )}
                <Choice
                  label="장소를 찾을 권역"
                  value={searchRegion}
                  values={Object.fromEntries(regions.map((r) => [r, r]))}
                  onChange={(v) => {
                    searchSerial.current++;
                    setSearchRegion(v);
                    setSearchState('idle');
                    setResults([]);
                  }}
                />
                <Tabs defaultValue="nearby">
                  <TabsList>
                    <TabsTrigger value="nearby">가까운 후보</TabsTrigger>
                    <TabsTrigger value="search">관광정보 검색</TabsTrigger>
                  </TabsList>
                  <TabsContent value="nearby">
                    <p className="finder-hint">
                      {mission.stops.at(-1)?.place.title ||
                        origin?.title ||
                        searchRegion}{' '}
                      주변 · 좌표 거리순
                      <br />
                      공개 자료의 후보이며 운영·도보·식사 적합성은 확인이
                      필요해요.
                    </p>
                    <Choice
                      label="장소 유형"
                      value={category}
                      values={categories}
                      onChange={setCategory}
                    />
                    <div className="finder-results">
                      {nearby
                        .filter(
                          (p) =>
                            category === 'all' ||
                            (category === 'restaurant'
                              ? ['restaurant', 'cafe'].includes(p.category)
                              : p.category === category),
                        )
                        .slice(0, 24)
                        .map((p) => (
                          <PlaceResult
                            key={p.id}
                            place={p}
                            selected={
                              stops.some((s) => s.placeId === p.id) &&
                              selectionTarget === 'stop'
                            }
                            onChoose={() => choose(p)}
                          />
                        ))}
                    </div>
                    {!nearby.length && (
                      <p>
                        이 권역의 후보가 아직 없습니다. 관광정보 검색으로
                        찾아보세요.
                      </p>
                    )}
                  </TabsContent>
                  <TabsContent value="search">
                    <form
                      className="finder-search"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void search();
                      }}
                    >
                      <Input
                        aria-label="관광장소 검색어"
                        placeholder="관광지, 식당, 장소 이름"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        maxLength={50}
                      />
                      <Button
                        type="submit"
                        disabled={searchState === 'loading'}
                      >
                        <Search size={18} />
                        검색
                      </Button>
                    </form>
                    {searchState === 'loading' ? (
                      <p role="status">
                        한국관광공사 관광정보에서 찾고 있어요.
                      </p>
                    ) : (
                      <>
                        <div className="finder-results">
                          {results.map((p) => (
                            <PlaceResult
                              key={p.id}
                              place={p}
                              selected={
                                stops.some((s) => s.placeId === p.id) &&
                                selectionTarget === 'stop'
                              }
                              onChoose={() => choose(p)}
                            />
                          ))}
                        </div>
                        {searchState === 'done' && !results.length && (
                          <p>
                            검색 결과가 없어요. 다른 이름으로 검색하거나 직접
                            추가해 주세요.
                          </p>
                        )}
                        {searchState === 'done' && total > 20 && (
                          <div className="finder-pagination">
                            <Button
                              variant="outline"
                              disabled={page === 1}
                              onClick={() => void search(page - 1)}
                            >
                              이전
                            </Button>
                            <span>
                              {page} / {Math.ceil(total / 20)}
                            </span>
                            <Button
                              variant="outline"
                              disabled={page * 20 >= total || page >= 10}
                              onClick={() => void search(page + 1)}
                            >
                              다음
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>
                </Tabs>
                <div className="finder-manual">
                  <div>
                    <strong>목록에 없는 곳인가요?</strong>
                    <p>장소를 직접 입력하거나 지도에서 골라요.</p>
                  </div>
                  <Button variant="outline" onClick={() => manualForm()}>
                    <Plus size={18} />
                    직접 추가
                  </Button>
                </div>
              </section>
            )}
            {stage === 'manual' && (
              <section className="builder-manual">
                <label className="builder-field">
                  <span>장소 이름</span>
                  <Input
                    aria-label="장소 이름"
                    value={manual.title}
                    maxLength={60}
                    onChange={(e) =>
                      setManual((p) => ({ ...p, title: e.target.value }))
                    }
                  />
                </label>
                <Choice
                  label="직접 추가 장소 권역"
                  value={manual.sigungu}
                  values={Object.fromEntries(regions.map((r) => [r, r]))}
                  onChange={(v) =>
                    setManual((p) => ({
                      ...p,
                      sigungu: v,
                      lat: null,
                      lon: null,
                    }))
                  }
                />
                <Choice
                  label="직접 추가 장소 유형"
                  value={manual.category}
                  values={{
                    attraction: '관광지',
                    restaurant: '식당',
                    cafe: '카페',
                    culture: '문화시설',
                    other: '기타 장소',
                  }}
                  onChange={(v) => setManual((p) => ({ ...p, category: v }))}
                />
                <label className="builder-field">
                  <span>주소 · 선택</span>
                  <Input
                    aria-label="주소"
                    value={manual.address}
                    maxLength={160}
                    placeholder="주소 또는 만날 지점"
                    onChange={(e) =>
                      setManual((p) => ({ ...p, address: e.target.value }))
                    }
                  />
                </label>
                <div className="manual-location">
                  <h3>지도에서 위치 선택 · 선택</h3>
                  <p>
                    지도를 눌러 장소의 위치를 고르세요. GPS는 사용하지 않습니다.
                  </p>
                  <PublicPlacePicker
                    mapKey={mapKey}
                    region={manual.sigungu}
                    center={(() => {
                      const p = regionPlaces(allPlaces, manual.sigungu)[0];
                      return p ? { lat: p.lat!, lon: p.lon! } : undefined;
                    })()}
                    value={
                      manual.lat !== null && manual.lon !== null
                        ? { lat: manual.lat, lon: manual.lon }
                        : null
                    }
                    onChange={(v) => setManual((p) => ({ ...p, ...v }))}
                  />
                  {manual.lat !== null && (
                    <button
                      className="text-action"
                      onClick={() =>
                        setManual((p) => ({ ...p, lat: null, lon: null }))
                      }
                    >
                      선택한 위치 지우기
                    </button>
                  )}
                  <p>
                    {manual.lat === null
                      ? '위치를 정하지 않아도 코스에 담을 수 있어요. 이동시간과 복귀 여유는 계산 전으로 표시합니다.'
                      : '선택 위치는 사용자가 지정한 값이며 공식 확인된 좌표가 아닙니다.'}
                  </p>
                </div>
                <Button
                  className="manual-save"
                  onClick={() => {
                    if (!validManualPlace(manual)) {
                      setNotice('장소 이름·권역·위치를 확인해 주세요.');
                      return;
                    }
                    if (
                      selectionTarget === 'origin' &&
                      (manual.lat === null || manual.lon === null)
                    ) {
                      setNotice(
                        '만나는 장소는 지도에서 장소 위치를 선택해 주세요.',
                      );
                      return;
                    }
                    setManuals((v) => [
                      ...v.filter((p) => p.id !== manual.id),
                      manual,
                    ]);
                    const p = manualToPlace(manual);
                    setExtra((v) => v.filter((v) => v.id !== manual.id));
                    if (stops.some((s) => s.placeId === manual.id)) {
                      change();
                      setStage('plan');
                    } else choose(p);
                  }}
                >
                  이 장소 코스에 추가
                </Button>
              </section>
            )}
          </div>
          <div className="builder-bottom">
            {notice && (
              <p className="builder-notice" role="alert">
                {notice}
              </p>
            )}
            {stage === 'plan' && (
              <>
                <p>
                  <b>{stops.length}곳</b> ·{' '}
                  {stops.reduce((a, s) => a + s.stay, 0)}분 머무름 ·{' '}
                  {saveTarget === 'group'
                    ? '공유할 내용을 다음 단계에서 확인'
                    : '내 여행에 저장'}
                </p>
                <Button onClick={save} disabled={missing.length > 0}>
                  <Check size={18} />
                  {saveTarget === 'group'
                    ? '공유 범위 확인'
                    : mode === 'edit'
                      ? '변경사항 저장'
                      : '내 코스 저장'}
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogTitle>
            수정한 내용을 저장하지 않고 나갈까요?
          </AlertDialogTitle>
          <AlertDialogDescription>
            저장한 원래 코스는 그대로 남습니다.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>계속 편집</AlertDialogCancel>
            <AlertDialogAction onClick={onClose}>변경 버리기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
function PlaceResult({
  place,
  selected,
  onChoose,
}: {
  place: Place;
  selected: boolean;
  onChoose: () => void;
}) {
  return (
    <article className="finder-result">
      {photoUrl(place) ? (
        <MemoryImage
          src={photoUrl(place)}
          alt=""
          loading="lazy"
          title={placePhoto(place)?.credit}
        />
      ) : (
        <span className="finder-result-icon">
          <MapPin size={22} />
        </span>
      )}
      <div>
        <strong>{place.title}</strong>
        <p>{place.address}</p>
        <small>
          {place.source === 'tourapi'
            ? '출처: ⓒ한국관광공사'
            : '별도 공개 관광자료'}
          {!validCoord(place) ? ' · 위치 확인 필요' : ''}
        </small>
      </div>
      <Button
        variant="outline"
        disabled={selected}
        aria-label={place.title + (selected ? ' 담김' : ' 추가')}
        onClick={onChoose}
      >
        {selected ? <Check size={18} /> : <Plus size={18} />}
      </Button>
    </article>
  );
}
