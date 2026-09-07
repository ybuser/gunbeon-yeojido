'use client';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  X,
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  Compass,
  HeartHandshake,
  MapPin,
  ShieldCheck,
  Footprints,
  CloudRain,
  CarFront,
  ChevronRight,
  Copy,
  Download,
  Layers3,
  Leaf,
  Navigation,
  RefreshCw,
  Stamp,
  Users,
  Database,
  ExternalLink,
  LockKeyhole,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent as BaseSheetContent,
  SheetClose,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import MissionMap from './mission-map';
import CourseCover from './course-cover';
import TripBuilder, { scheduleTime } from './trip-builder';
import WeatherCard from './weather-card';
import { VerifiedFacts, ApiFacts } from './place-facts';
import {
  regions,
  chapters,
  defaultSettings,
  makeMissions,
  chooseOrigin,
  regionPlaces,
  assess,
  localInputDate,
  parseKoreaInput,
  scopeLabels,
  createCode,
  familyProjection,
  publicCard,
  kakaoLink,
  validCoord,
  createEntry,
  entryKey,
  hasVisitRecord,
  planSignature,
  resolveEntry,
  effectiveWeather,
  routeSchedule,
} from '@/lib/domain';
import type {
  Place,
  Settings,
  Mission,
  Entry,
  Family,
  Scopes,
} from '@/lib/domain';
const LABELS = {
  home: '둘러보기',
  planner: '지도·미션',
  family: '가족',
  passport: '내 여행',
  radar: '휴가회수 레이더',
  data: '데이터·출처',
};
const STORAGE = 'gangwon-passport-v1';
const transportLabels = {
  car: '자차',
  transit: '대중교통',
  taxi: '택시+버스',
  unknown: '미정',
} as const;
function transportValue(label: string): Settings['transport'] {
  return (
    (Object.keys(transportLabels) as Settings['transport'][]).find(
      (key) => transportLabels[key] === label,
    ) || 'unknown'
  );
}
type Accessibility = {
  mode: string;
  total?: number;
  fetchedAt?: string;
  items: { place: Place; results: unknown[] }[];
};
type Live = {
  mode: string;
  error?: string;
  places: Place[];
  fetchedAt?: string;
  categories?: {
    contentTypeId: string;
    total: number;
    fetched: number;
    error: string | null;
  }[];
  lDongRegnCd?: string;
  lDongSignguCd?: string;
};
function SheetContent({
  children,
  ...props
}: ComponentProps<typeof BaseSheetContent>) {
  return (
    <BaseSheetContent {...props} showCloseButton={false}>
      {children}
      <SheetClose aria-label="닫기" className="travel-sheet-close">
        <X size={20} />
      </SheetClose>
    </BaseSheetContent>
  );
}
function Field({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <Select value={value} onValueChange={(v) => v && onChange(String(v))}>
        <SelectTrigger aria-label={label}>
          <SelectValue>{value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((v) => (
            <SelectItem key={v} value={v}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function Choices({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <fieldset className="choices">
      <legend>{label}</legend>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(String(v))}
        className="choice-row"
        aria-label={label}
      >
        {options.map((v) => (
          <label key={v} className={value === v ? 'choice selected' : 'choice'}>
            <RadioGroupItem value={v} />
            {v}
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <Checkbox checked={checked} onCheckedChange={onChange} />
      <span>{label}</span>
    </label>
  );
}
function Source({ p }: { p: Place }) {
  if (p.source === 'manual')
    return (
      <span className="source-link">
        직접 입력한 장소 · 위치·운영·공개 출입 미검증
      </span>
    );
  return (
    <a
      className="source-link"
      href={p.source_url}
      target="_blank"
      rel="noreferrer"
    >
      {p.source === 'tourapi'
        ? '출처: ⓒ한국관광공사'
        : p.source.startsWith('dmz')
          ? '출처: 통일부 공개데이터'
          : '출처: 국가보훈부'}{' '}
      <ExternalLink size={11} />
    </a>
  );
}
function PlacePhoto({
  src,
  title,
  eager = false,
}: {
  src: string;
  title: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <span
      className="photo-placeholder"
      role="img"
      aria-label={title + ' 사진을 불러오지 못했습니다'}
    >
      <MapPin aria-hidden="true" />
      <span>사진을 불러올 수 없어요</span>
    </span>
  ) : (
    <img
      src={src}
      alt={title}
      loading={eager ? 'eager' : 'lazy'}
      onError={() => setFailed(true)}
    />
  );
}
export default function PassportApp() {
  const [basePlaces, setBasePlaces] = useState<Place[]>([]);
  const [extraPlaces, setExtraPlaces] = useState<Place[]>([]);
  const [composer, setComposer] = useState<{
    key: string;
    entry: Entry | null;
    mode: 'new' | 'edit' | 'copy';
  } | null>(null);
  const [view, setView] = useState('home');
  const [editing, setEditing] = useState(false);
  const [editStep, setEditStep] = useState(0);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [placeOpen, setPlaceOpen] = useState<Place | null>(null);
  const [settings, setSettings] = useState<Settings>(() => defaultSettings());
  const [now, setNow] = useState(() => new Date());
  const [live, setLive] = useState<Live>({ mode: 'loading', places: [] });
  const [refresh, setRefresh] = useState(0);
  const [mapKey, setMapKey] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [reviewEntry, setReviewEntry] = useState<Entry | null>(null);
  const [radarRecordId, setRadarRecordId] = useState('');
  const [notice, setNotice] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [family, setFamily] = useState<Family | null>(null);
  const [invite, setInvite] = useState('');
  const [joined, setJoined] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [proposal, setProposal] = useState<{
    entry: Entry;
    walkLimit: number;
    transport: Settings['transport'];
  } | null>(null);
  const [recordTab, setRecordTab] = useState('plans');
  const [shared, setShared] = useState<Entry | null>(null);
  const [radarChecks, setRadarChecks] = useState([false, false, false]);
  const [detail, setDetail] = useState<{
    id: string;
    data: unknown;
    loading: boolean;
  } | null>(null);
  const [familyWalk, setFamilyWalk] = useState('20분');
  const [familyMeal, setFamilyMeal] = useState('한식');
  const [familyDate, setFamilyDate] = useState('');
  const [familyRegion, setFamilyRegion] = useState('철원군');
  const [familyTransport, setFamilyTransport] = useState('자차');
  const [brief, setBrief] = useState(false);
  const [familyLive, setFamilyLive] = useState<Live>({
    mode: 'idle',
    places: [],
  });
  const [access, setAccess] = useState<Accessibility>({
    mode: 'idle',
    items: [],
  });
  const [search, setSearch] = useState('');
  const [installPrompt, setInstallPrompt] = useState<{
    prompt: () => Promise<void>;
  } | null>(null);
  useEffect(() => {
    const readView = () => {
      const key = window.location.hash.slice(1);
      setView(Object.hasOwn(LABELS, key) ? key : 'home');
      setEditing(false);
      setPlaceOpen(null);
      setShared(null);
    };
    readView();
    window.addEventListener('popstate', readView);
    return () => window.removeEventListener('popstate', readView);
  }, []);
  useEffect(() => {
    setNow(new Date());
    fetch('/api/catalog')
      .then((r) => r.json())
      .then((data) => {
        const result = data as { places?: Place[] };
        if (Array.isArray(result.places)) setBasePlaces(result.places);
      })
      .catch(() =>
        setNotice(
          '공개 장소 목록을 불러오지 못했습니다. 연결 상태를 확인해 주세요.',
        ),
      );
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
      if (saved?.version === 1 || saved?.version === 2) {
        if (Array.isArray(saved.entries))
          setEntries(
            saved.entries.filter(
              (x: Entry) =>
                typeof x.title === 'string' &&
                regions.includes(x.region as (typeof regions)[number]) &&
                Array.isArray(x.stamps),
            ),
          );
        if (
          saved.family &&
          typeof saved.family.code === 'string' &&
          saved.family.scopes
        )
          setFamily(saved.family);
      }
    } catch {
      setNotice('저장 기록을 읽지 못했습니다. 새 여권으로 시작합니다.');
    }
    setLoaded(true);
    const tick = () => setNow(new Date());
    const timer = setInterval(tick, 30000);
    document.addEventListener('visibilitychange', tick);
    const install = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as unknown as { prompt: () => Promise<void> });
    };
    window.addEventListener('beforeinstallprompt', install);
    if ('serviceWorker' in navigator)
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    fetch('/api/status')
      .then((r) => r.json())
      .then((x) => setMapKey((x as { kakaoMapKey?: string }).kakaoMapKey || ''))
      .catch(() => {});
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('beforeinstallprompt', install);
    };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(
        STORAGE,
        JSON.stringify({ version: 2, entries, family }),
      );
    } catch {
      setNotice(
        '이 브라우저에서는 저장할 수 없습니다. 현재 화면에서만 기록이 유지됩니다.',
      );
    }
  }, [loaded, entries, family]);
  useEffect(() => {
    let canceled = false;
    const controller = new AbortController();
    setLive({ mode: 'loading', places: [] });
    fetch('/api/places?region=' + encodeURIComponent(settings.region), {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((x) => {
        if (!canceled) setLive(x as Live);
      })
      .catch(() => {
        if (!canceled)
          setLive({ mode: 'unavailable', error: 'NETWORK', places: [] });
      });
    return () => {
      canceled = true;
      controller.abort();
    };
  }, [settings.region, refresh]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 7000);
    return () => clearTimeout(t);
  }, [notice]);
  const places = useMemo(
    () => [
      ...new Map(
        [...extraPlaces, ...basePlaces, ...live.places].map((p) => [p.id, p]),
      ).values(),
    ],
    [live.places, basePlaces, extraPlaces],
  );
  const local = useMemo(
    () => regionPlaces(places, settings.region),
    [places, settings.region],
  );
  useEffect(() => {
    if (live.mode === 'loading') return;
    const candidates = reviewEntry
      ? [reviewEntry]
      : view === 'passport'
        ? entries.slice(0, 4)
        : [];
    const plans = candidates
      .filter((e) => e.plan?.kind === 'custom')
      .map((e) => e.plan!);
    const ids = [
      ...new Set([
        ...plans.flatMap((plan) => [
          plan.originId,
          ...plan.stops.map((s) => s.placeId),
        ]),
      ]),
    ].filter(
      (id) => id.startsWith('tourapi:') && !places.some((p) => p.id === id),
    );
    if (!ids.length) return;
    let canceled = false;
    const batches = Array.from({ length: Math.ceil(ids.length / 13) }, (_, i) =>
      ids.slice(i * 13, i * 13 + 13),
    );
    void Promise.all(
      batches.map((batch) =>
        fetch('/api/places/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: batch }),
        })
          .then((r) => r.json())
          .catch(() => ({ places: [] })),
      ),
    ).then((responses) => {
      const values = responses as { places?: Place[] }[];
      if (!canceled)
        setExtraPlaces((v) => [
          ...new Map(
            [...v, ...values.flatMap((x) => x.places || [])].map((p) => [
              p.id,
              p,
            ]),
          ).values(),
        ]);
    });
    return () => {
      canceled = true;
    };
  }, [reviewEntry, view, entries, live.mode, refresh]);
  const resolvedEntry = useMemo(
    () => (reviewEntry ? resolveEntry(reviewEntry, places) : null),
    [reviewEntry, places],
  );
  const origin = useMemo(
    () =>
      reviewEntry ? resolvedEntry?.origin : chooseOrigin(places, settings),
    [reviewEntry, resolvedEntry, places, settings],
  );
  const missionOptions = useMemo(
    () => makeMissions(places, settings),
    [places, settings],
  );
  const missions = useMemo(() => {
    if (!origin) return missionOptions;
    const rank = { safe: 0, caution: 1, unknown: 2, avoid: 3 };
    return [...missionOptions].sort(
      (a, b) =>
        rank[assess(a, settings, origin, now).band] -
        rank[assess(b, settings, origin, now).band],
    );
  }, [missionOptions, settings, origin, now]);
  const selected = reviewEntry
    ? resolvedEntry?.mission
    : missions.find((m) => m.id === selectedId) || missions[0];
  const score =
    selected && origin ? assess(selected, settings, origin, now) : null;
  const itinerary =
    selected && origin ? routeSchedule(selected, settings, origin, now) : null;
  const projected = familyProjection(
    family,
    joined,
    entries,
    selected || null,
    settings.meal,
    now.getTime(),
  );
  const familySettings = {
    ...settings,
    region: familyRegion,
    originId: '',
    companion: '부모님',
    walkLimit: parseInt(familyWalk),
    theme: '회복',
    meal: familyMeal,
    transport: transportValue(familyTransport),
  } as Settings;
  const familyPlaces = [...familyLive.places, ...places];
  const familyOrigin = chooseOrigin(familyPlaces, familySettings);
  const familyMissions = makeMissions(familyPlaces, familySettings);
  const familyMission =
    familyMissions.find((m) => m.variant === '회복') || familyMissions[0];
  const familyIndoor = regionPlaces(familyPlaces, familyRegion)
    .filter((p) => /박물관|문학관|문화관|미술관/.test(p.title))
    .slice(0, 2);
  const meals = regionPlaces(familyPlaces, familyRegion)
    .filter((p) => p.category === 'restaurant')
    .slice(0, 3);
  const rewards = local.filter((p) => p.category === 'memorial');
  useEffect(() => {
    if (!brief) return;
    const controller = new AbortController();
    const options = { signal: controller.signal, cache: 'no-store' as const };
    setFamilyLive({ mode: 'loading', places: [] });
    setAccess({ mode: 'loading', items: [] });
    fetch('/api/places?region=' + encodeURIComponent(familyRegion), options)
      .then((r) => r.json())
      .then((x) => {
        if (!controller.signal.aborted) setFamilyLive(x as Live);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setFamilyLive({ mode: 'unavailable', places: [] });
      });
    fetch(
      '/api/accessibility?region=' + encodeURIComponent(familyRegion),
      options,
    )
      .then((r) => r.json())
      .then((x) => {
        if (!controller.signal.aborted) setAccess(x as Accessibility);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setAccess({ mode: 'unavailable', items: [] });
      });
    return () => controller.abort();
  }, [brief, familyRegion]);
  function editTrip() {
    setDraft({ ...settings });
    setEditStep(0);
    setEditing(true);
  }
  function draftChange<K extends keyof Settings>(key: K, value: Settings[K]) {
    setDraft((s) => ({
      ...(s || settings),
      [key]: value,
      ...(key === 'region'
        ? { originId: '', weather: 'unknown', weatherForecast: undefined }
        : {}),
      ...(key === 'weather' ? { weatherForecast: undefined } : {}),
    }));
  }
  function draftPreset(minutes: number) {
    const d = new Date();
    setDraft((s) => ({
      ...(s || settings),
      duration: minutes,
      startedAt: d.toISOString(),
      returnAt: new Date(d.getTime() + minutes * 60000).toISOString(),
    }));
  }
  function applyTrip() {
    if (!draft || !Number.isFinite(Date.parse(draft.returnAt))) return;
    setSettings(draft);
    setNow(new Date());
    setSelectedId('');
    if (
      draft.region !== settings.region ||
      draft.originId !== settings.originId ||
      draft.duration !== settings.duration
    )
      setReviewEntry(null);
    setEditing(false);
    if (draft.role === '부모님') {
      setFamilyRegion(draft.region);
      setFamilyTransport(transportLabels[draft.transport]);
      setFamilyWalk(draft.walkLimit + '분');
      setBrief(false);
      go('family');
    } else go('planner');
  }
  function change<K extends keyof Settings>(k: K, v: Settings[K]) {
    setSettings((s) => ({
      ...s,
      [k]: v,
      ...(k === 'region'
        ? { originId: '', weather: 'unknown', weatherForecast: undefined }
        : {}),
      ...(k === 'weather' ? { weatherForecast: undefined } : {}),
    }));
    if (k === 'region') {
      setSelectedId('');
      setReviewEntry(null);
    }
    if (k === 'weather' && (v === 'rain' || v === 'wind' || v === 'snow'))
      setSelectedId(settings.region + '-실내');
  }
  function go(v: string) {
    if (!Object.hasOwn(LABELS, v)) return;
    if (v !== view)
      window.history.pushState(
        null,
        '',
        v === 'home'
          ? window.location.pathname + window.location.search
          : '#' + v,
      );
    setView(v);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function openBuilder(entry: Entry | null, mode: 'new' | 'edit' | 'copy') {
    setComposer({ key: crypto.randomUUID(), entry, mode });
  }
  function saveMission() {
    if (!selected || !origin) return;
    const entry = createEntry(selected, origin);
    if (entries.some((e) => planSignature(e) === planSignature(entry))) {
      setNotice('같은 장소와 순서의 미션이 이미 내 여행에 있습니다.');
      return;
    }
    setEntries((e) => [...e, entry]);
    setNotice(
      '장소와 순서를 내 여행에 담았습니다. 복귀시각은 저장하지 않습니다.',
    );
  }
  function openEntry(entry: Entry) {
    setReviewEntry(entry);
    setSettings((s) => ({
      ...s,
      region: entry.region,
      originId: entry.plan?.originId || '',
      ...(s.region !== entry.region
        ? { weather: 'unknown', weatherForecast: undefined }
        : {}),
    }));
    setSelectedId(entry.missionId);
    go('planner');
  }
  function addStamp(id: string, stamp: string) {
    if (stamp === '동행' && !projected?.scopes.stamp) {
      setNotice('동행 스탬프 권한이 있는 가족 초대 연결이 필요합니다.');
      return;
    }
    setEntries((e) =>
      e.map((x) =>
        entryKey(x) === id
          ? { ...x, stamps: Array.from(new Set([...x.stamps, stamp])) }
          : x,
      ),
    );
    setNotice(
      stamp +
        ' 스탬프를 기록했습니다. 본인 기록이며 공적 방문 인증이 아닙니다.',
    );
  }
  function createInvite() {
    setFamily({
      code: createCode(),
      expiresAt: Date.now() + 86400000,
      scopes: {
        passport: true,
        schedule: true,
        meal: false,
        propose: true,
        stamp: true,
      },
    });
    setJoined('');
    setNotice(
      '이 브라우저에서 24시간 유효한 체험 코드가 생성됐습니다. 다른 기기에는 연결되지 않습니다.',
    );
  }
  function join() {
    if (
      !familyProjection(
        family,
        invite.trim().toUpperCase(),
        entries,
        selected || null,
        settings.meal,
      )
    ) {
      setNotice('이 브라우저에서 만든 유효한 코드인지 확인해 주세요.');
      return;
    }
    setJoined(invite.trim().toUpperCase());
    setNotice('허용된 공유범위로 연결했습니다.');
  }
  useEffect(() => {
    const p = placeOpen;
    if (!p || p.source !== 'tourapi') return;
    const controller = new AbortController();
    setDetail({ id: p.id, data: null, loading: true });
    fetch(
      '/api/place-detail?id=' + p.source_id + '&type=' + p.content_type_id,
      { cache: 'no-store', signal: controller.signal },
    )
      .then((r) => r.json())
      .then((data) => {
        if (!controller.signal.aborted)
          setDetail({ id: p.id, data, loading: false });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setDetail({
            id: p.id,
            data: { error: '상세 데이터를 연결하지 못했습니다.' },
            loading: false,
          });
      });
    return () => controller.abort();
  }, [placeOpen]);
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice('복사했습니다.');
    } catch {
      setNotice(
        '복사 기능을 사용할 수 없습니다. 화면의 내용을 직접 선택해 주세요.',
      );
    }
  }
  function downloadCard(e: Entry) {
    const card = publicCard(e);
    const safe = (x: string) =>
      x.replace(
        /[&<>"']/g,
        (c) =>
          ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&apos;',
          })[c]!,
      );
    const titleLines = card.mission.match(/.{1,19}/gu) || [];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080"><rect width="1080" height="1080" fill="#ffffff"/><rect x="80" y="80" width="920" height="6" fill="#246fe5"/><text x="80" y="175" fill="#246fe5" font-family="sans-serif" font-size="32" font-weight="bold">군번여지도 강원</text><text x="80" y="340" fill="#8693a4" font-family="sans-serif" font-size="30">${safe(card.region)} 여행 기록</text>${titleLines
      .slice(0, 4)
      .map(
        (line, i) =>
          `<text x="80" y="${440 + i * 72}" fill="#222b36" font-family="sans-serif" font-size="44" font-weight="bold">${safe(line)}</text>`,
      )
      .join(
        '',
      )}<text x="80" y="775" fill="#667c99" font-family="sans-serif" font-size="30">${safe(card.stamps.join(' · ') || '계획한 미션')}</text><line x1="80" y1="870" x2="1000" y2="870" stroke="#e0e7f0"/><text x="80" y="940" fill="#94a1b2" font-family="sans-serif" font-size="26">복무 경험을 관광 경험으로.</text></svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = '강원-관광여권.svg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const bandLabel =
    score?.band === 'safe'
      ? '시간상 안전권'
      : score?.band === 'caution'
        ? '시간상 주의권'
        : score?.band === 'avoid'
          ? '오늘 비추천'
          : '계산 확인 필요';
  return (
    <div
      className="app-shell"
      data-ready={loaded}
      inert={!loaded}
      aria-busy={!loaded}
    >
      <header className="topbar travel-header">
        <button className="brand" onClick={() => go('home')}>
          <Navigation size={23} strokeWidth={2.6} />
          <span>
            군번여지도 <b>강원</b>
          </span>
        </button>
        <span className="header-location">강원에서 함께 보내는 하루</span>
        <button className="top-link" onClick={() => go('data')}>
          <Layers3 size={17} /> 이용 안내
        </button>
      </header>
      <Tabs value={view} onValueChange={(v) => go(String(v))}>
        <TabsList className="main-nav" variant="line">
          {Object.entries(LABELS)
            .filter(([key]) => !['radar', 'data'].includes(key))
            .map(([key, label]) => (
              <TabsTrigger key={key} value={key} className={'nav-' + key}>
                {key === 'home' ? (
                  <Compass />
                ) : key === 'planner' ? (
                  <Navigation />
                ) : key === 'family' ? (
                  <Users />
                ) : key === 'passport' ? (
                  <BookOpen />
                ) : key === 'radar' ? (
                  <Leaf />
                ) : (
                  <Database />
                )}
                <span>{label}</span>
              </TabsTrigger>
            ))}
        </TabsList>
        <TabsContent value="home">
          <main className="explore-page">
            <section className="explore-heading">
              <div>
                <h1>오늘, 강원 어디 갈까요?</h1>
                <p>돌아갈 시간에 맞춰 함께 고르는 여행</p>
              </div>
              <button className="saved-shortcut" onClick={() => go('passport')}>
                <BookOpen size={18} />내 여행 <span>{entries.length}</span>
              </button>
            </section>
            <div className="region-tabs" aria-label="여행 지역">
              {regions.map((r) => (
                <button
                  key={r}
                  className={settings.region === r ? 'active' : ''}
                  aria-pressed={settings.region === r}
                  onClick={() => change('region', r)}
                >
                  {r.replace(/[군시]$/, '')}
                </button>
              ))}
            </div>
            <section className="trip-search" aria-label="오늘의 여행 조건">
              <button onClick={editTrip}>
                <Clock3 />
                <span>
                  <small>남은 시간</small>
                  <b>
                    {settings.duration === 1440
                      ? '1박 2일'
                      : settings.duration / 60 + '시간'}
                  </b>
                </span>
                <ChevronRight size={16} />
              </button>
              <button onClick={editTrip}>
                <Users />
                <span>
                  <small>동행</small>
                  <b>
                    {settings.companion} ·{' '}
                    {
                      {
                        car: '자차',
                        transit: '대중교통',
                        taxi: '택시+버스',
                        unknown: '이동수단 미정',
                      }[settings.transport]
                    }
                  </b>
                </span>
                <ChevronRight size={16} />
              </button>
              <Button className="search-submit" onClick={editTrip}>
                내 조건으로 미션 찾기 <ArrowRight size={18} />
              </Button>
            </section>
            <div className="section-title">
              <div>
                <h2>
                  {settings.region.replace(/[군시]$/, '')}에서 보내는 하루
                </h2>
                <p>풍경도 보고, 쉬어갈 시간도 남겨요.</p>
              </div>
              <button onClick={() => go('planner')}>
                지도 보기 <ArrowUpRight size={17} />
              </button>
            </div>
            <div className="journey-cards">
              {missions.map((m, i) => {
                const evaluated = origin
                  ? assess(m, settings, origin, now)
                  : null;
                return (
                  <article className="journey-card" key={m.id}>
                    <button
                      className="journey-image"
                      onClick={() => {
                        setReviewEntry(null);
                        setSelectedId(m.id);
                        go('planner');
                      }}
                      aria-label={m.title + ' 자세히 보기'}
                    >
                      <CourseCover
                        places={m.stops.map((s) => s.place)}
                        eager={!i}
                      />
                      <span className="image-category">
                        {m.variant === '실내'
                          ? '실내 후보'
                          : m.variant + ' 미션'}
                      </span>
                      <span className="image-corner">
                        <ArrowUpRight size={21} />
                      </span>
                    </button>
                    <span className="image-attribution">
                      {m.stops.some((s) => s.place.image_url)
                        ? '출처: ⓒ한국관광공사 · 코스 장소 사진'
                        : '사진이 없는 곳은 장소 이름으로 표시합니다'}
                    </span>
                    <button
                      className="journey-text"
                      onClick={() => {
                        setReviewEntry(null);
                        setSelectedId(m.id);
                        go('planner');
                      }}
                    >
                      <h3>
                        {{
                          가족: '부모님과 천천히 돌아보기',
                          회복: '잠깐 둘러보고, 편하게 쉬기',
                          평화: '평화의 흔적을 따라',
                          탐방: '지역의 이야기를 따라',
                          실내: '실내에서 여유롭게',
                        }[m.variant] || m.title}
                      </h3>
                      <p>{m.stops.map((x) => x.place.title).join(' · ')}</p>
                      <div className="journey-meta">
                        <span>
                          <Clock3 size={14} />
                          {evaluated?.total || '—'}분 예상
                        </span>
                        <span>
                          <Footprints size={14} />
                          도보 {evaluated?.walk || '—'}분 추정
                        </span>
                      </div>
                      <div
                        className={
                          'journey-margin ' + (evaluated?.band || 'unknown')
                        }
                      >
                        <span className="status-dot" />
                        <b>
                          {evaluated?.margin == null
                            ? '복귀 시간 확인 필요'
                            : evaluated.margin >= 0
                              ? '복귀 여유 +' + evaluated.margin + '분'
                              : '복귀 시간 ' +
                                Math.abs(evaluated.margin) +
                                '분 부족'}
                        </b>
                        <span>
                          {evaluated?.band === 'avoid'
                            ? '현재 조건 비추천'
                            : '방문 조건 확인 필요'}
                        </span>
                      </div>
                    </button>
                  </article>
                );
              })}
              {!missions.length && (
                <div className="list-empty">
                  {live.mode === 'loading'
                    ? '여행 장소를 불러오고 있어요.'
                    : '이 지역의 여행 후보를 확인하지 못했습니다.'}
                  <button onClick={() => setRefresh((x) => x + 1)}>
                    다시 확인
                  </button>
                </div>
              )}
            </div>
            <section className="family-entry">
              <div className="family-entry-icon">
                <HeartHandshake size={28} />
              </div>
              <div>
                <h2>부모님이 편한 여행을 함께 골라요.</h2>
                <p>걷는 시간, 주차, 좋아하는 식사부터.</p>
              </div>
              <Button variant="outline" onClick={() => go('family')}>
                가족 여행 준비 <ArrowRight size={17} />
              </Button>
            </section>
            <p className="explore-footnote">
              복귀 여유는 공개 거점까지의 추정값입니다. 실제 교통과 소속 부대
              복귀 규정을 확인해 주세요.
            </p>
          </main>
        </TabsContent>
        <TabsContent value="planner">
          <main className="route-page">
            <div className="route-toolbar">
              <button onClick={() => go('home')} className="back-action">
                ← 둘러보기
              </button>
              <button
                className="edit-summary"
                onClick={() =>
                  selected?.custom && origin
                    ? openBuilder(
                        reviewEntry || createEntry(selected, origin),
                        'edit',
                      )
                    : editTrip()
                }
              >
                <span>
                  {settings.region} · {settings.companion}
                </span>
                <b>
                  {new Intl.DateTimeFormat('ko-KR', {
                    timeZone: 'Asia/Seoul',
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  }).format(new Date(settings.returnAt))}
                  까지
                </b>
                <span>조건 변경</span>
                <ChevronRight size={16} />
              </button>
            </div>
            {!selected || !origin ? (
              <div className="list-empty">
                {live.mode === 'loading'
                  ? '장소 정보를 다시 확인하고 있어요.'
                  : reviewEntry
                    ? '저장한 장소 정보를 연결하지 못했습니다. 다른 장소로 바꾸지 않았어요.'
                    : '이 조건의 미션을 구성하지 못했습니다.'}
                <button onClick={() => setRefresh((x) => x + 1)}>
                  장소 다시 조회
                </button>
                <button
                  onClick={() => {
                    setReviewEntry(null);
                    editTrip();
                  }}
                >
                  새 미션 찾기
                </button>
              </div>
            ) : (
              <>
                <div className="route-layout">
                  <section className="route-map-pane">
                    <MissionMap
                      mission={selected}
                      origin={origin}
                      mapKey={mapKey}
                      onSelectPlace={(p) => {
                        setPlaceOpen(p);
                      }}
                    />
                    <div className={'map-clock ' + score?.band}>
                      <Clock3 size={21} />
                      <div>
                        <span>공개 거점까지 복귀 여유</span>
                        <strong>
                          {score?.margin == null
                            ? '확인 필요'
                            : (score.margin >= 0 ? '+' : '') +
                              score.margin +
                              '분'}
                        </strong>
                      </div>
                      <b>{bandLabel}</b>
                    </div>
                    <p className="map-disclaimer">
                      참고값입니다. 실제 교통과 소속 부대 복귀 규정을 확인해
                      주세요.
                    </p>
                  </section>
                  <section className="route-itinerary">
                    {reviewEntry && (
                      <p className="saved-context">
                        저장·제안한 장소 순서 · 시간은 현재 조건으로 재계산
                      </p>
                    )}
                    <div className="route-variants" aria-label="미션 선택">
                      {missions.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            setReviewEntry(null);
                            setSelectedId(m.id);
                          }}
                          className={selected.id === m.id ? 'active' : ''}
                        >
                          {m.variant === '실내' ? '실내 후보' : m.variant}
                        </button>
                      ))}
                    </div>
                    <div className="itinerary-title">
                      <span>
                        {settings.region} · {selected.stops.length}곳
                      </span>
                      <h1>{selected.title.replace(/^[^:]+:\s*/, '')}</h1>
                      <p>{selected.brief}</p>
                    </div>
                    <div className="route-stats">
                      <div>
                        <b>
                          {score && Number.isFinite(score.total)
                            ? score.total
                            : '—'}
                          <small>분</small>
                        </b>
                        <span>이동·여유 포함</span>
                      </div>
                      <div>
                        <b>
                          {score?.walk}
                          <small>분</small>
                        </b>
                        <span>도보 추정</span>
                      </div>
                      <div>
                        <b>{settings.companion}</b>
                        <span>오늘의 동행</span>
                      </div>
                    </div>
                    <div className="route-alert">
                      <AlertTriangle size={17} />
                      <p>
                        {score?.band === 'avoid'
                          ? '현재 시간·도보·운영·기상 조건에서는 추천하지 않습니다. '
                          : ''}
                        {score?.issues
                          .filter((x) =>
                            /공식|예보.*(범위|만료)|다른 지역/.test(x),
                          )
                          .map((x) => (
                            <span className="critical-condition" key={x}>
                              {x}
                            </span>
                          ))}
                        예약·신분증·당일 운영 확인이 필요합니다.
                      </p>
                    </div>
                    {settings.duration > 600 && (
                      <p className="helper">
                        1박 일정 초안입니다. 숙박·휴식 10시간 외 숙소와 다음 날
                        운영은 별도 확인하세요.
                      </p>
                    )}
                    <div className="journey-timeline">
                      <div className="timeline-hub">
                        <span className="hub-dot" />
                        <div>
                          <small>만나는 곳 · 돌아올 곳</small>
                          <b>{origin.title}</b>
                        </div>
                      </div>
                      {selected.stops.map((stop, i) => (
                        <article className="place-row" key={stop.place.id}>
                          <span className="place-number">{i + 1}</span>
                          <div className="place-main">
                            {itinerary && (
                              <p className="place-schedule-time">
                                {scheduleTime(itinerary.legs[i].arrival)}
                                {Number.isFinite(itinerary.legs[i].departure)
                                  ? ' – ' +
                                    scheduleTime(itinerary.legs[i].departure)
                                  : ''}
                              </p>
                            )}
                            <small>
                              {stop.place.category === 'cafe' ||
                              stop.place.category === 'restaurant'
                                ? '쉬어가기'
                                : '둘러보기'}{' '}
                              · 머무는 시간 {stop.stay}분
                            </small>
                            <button
                              className="place-name"
                              onClick={() => {
                                setPlaceOpen(stop.place);
                              }}
                            >
                              {stop.place.title}
                              <ChevronRight size={17} />
                            </button>
                            <p>{stop.place.address}</p>
                            <div className="place-row-actions">
                              {validCoord(stop.place) && (
                                <a
                                  href={kakaoLink(stop.place)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Navigation size={13} />
                                  길찾기
                                </a>
                              )}
                              <button
                                onClick={() => {
                                  setPlaceOpen(stop.place);
                                }}
                              >
                                방문·편의 정보
                              </button>
                            </div>
                          </div>
                          {stop.place.image_url && (
                            <PlacePhoto
                              key={stop.place.image_url}
                              src={stop.place.image_url}
                              title={stop.place.title}
                            />
                          )}
                        </article>
                      ))}
                      <div className="timeline-hub">
                        <span className="hub-dot filled" />
                        <div>
                          <small>공개 거점으로 돌아오기</small>
                          <b>{origin.title}</b>
                        </div>
                      </div>
                    </div>
                    <details className="route-calculation">
                      <summary>
                        복귀 여유는 어떻게 계산하나요?
                        <ChevronRight size={17} />
                      </summary>
                      <dl>
                        <div>
                          <dt>남은 시간</dt>
                          <dd>{score?.available}분</dd>
                        </div>
                        {Object.entries(score?.costs || {}).map(([k, v]) => (
                          <div key={k}>
                            <dt>{k}</dt>
                            <dd>−{v}분</dd>
                          </div>
                        ))}
                      </dl>
                      <p>
                        직선거리 × 우회계수 1.6과 수단별 가정 속도·대기시간을
                        사용합니다. 실제 길찾기 소요시간이 아닙니다.
                      </p>
                    </details>
                    <details className="route-calculation">
                      <summary>
                        출발 전 확인할 조건
                        <ChevronRight size={17} />
                      </summary>
                      <ul>
                        {score?.issues.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                      <div className="visit-conditions">
                        {selected.stops.map(({ place: p }) => (
                          <div key={p.id}>
                            <b>{p.title}</b>
                            <span>
                              예약{' '}
                              {p.reservation_required == null
                                ? '미확인'
                                : p.reservation_required
                                  ? '필요'
                                  : '불필요'}{' '}
                              · 신분증{' '}
                              {p.id_check_required == null
                                ? '미확인'
                                : p.id_check_required
                                  ? '필요'
                                  : '불필요'}
                            </span>
                            <VerifiedFacts place={p} />
                          </div>
                        ))}
                      </div>
                    </details>
                    <WeatherCard
                      region={settings.region}
                      onApply={(v, provenance) =>
                        setSettings((s) => ({
                          ...s,
                          weather: v,
                          weatherForecast: provenance,
                        }))
                      }
                    />
                    <div className="route-credit">
                      출처: ⓒ한국관광공사 · 통일부 공개데이터{' '}
                      <button onClick={() => go('data')}>자세히</button>
                    </div>
                  </section>
                </div>
                <div className="route-savebar">
                  <div>
                    <b>{selected.stops.length}곳을 함께 둘러보는 미션</b>
                    <span>
                      {score && Number.isFinite(score.total)
                        ? score.total
                        : '—'}
                      분 추정 · 방문 조건 확인 필요
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() =>
                      openBuilder(createEntry(selected, origin), 'copy')
                    }
                  >
                    가져와서 수정
                  </Button>
                  <Button onClick={saveMission}>
                    <BookOpen size={17} />
                    {entries.some(
                      (e) =>
                        planSignature(e) ===
                        planSignature(createEntry(selected, origin, 'preview')),
                    )
                      ? '내 여행에 담은 미션'
                      : '이 미션 내 여행에 담기'}
                  </Button>
                </div>
              </>
            )}
          </main>
        </TabsContent>
        <TabsContent value="family">
          <main className="family-page content-page">
            <div className="content-heading">
              <h1>우리 가족에게 편한 하루</h1>
              <p>걷는 시간과 식사 취향부터 맞춰보세요.</p>
            </div>
            <div className="family-planning-layout">
              <section className="family-form">
                <h2>어떤 여행을 준비할까요?</h2>
                <div className="form-grid">
                  <Field
                    label="만나는 지역"
                    value={familyRegion}
                    options={[...regions]}
                    onChange={(v) => {
                      setFamilyRegion(v);
                      setBrief(false);
                    }}
                  />
                  <label className="field">
                    방문 희망일 · 메모
                    <input
                      type="date"
                      value={familyDate}
                      onChange={(e) => setFamilyDate(e.target.value)}
                    />
                  </label>
                  <Field
                    label="이동수단"
                    value={familyTransport}
                    options={Object.values(transportLabels)}
                    onChange={setFamilyTransport}
                  />
                  <Field
                    label="편안한 전체 도보 시간"
                    value={familyWalk}
                    options={['15분', '20분', '30분', '60분', '90분']}
                    onChange={setFamilyWalk}
                  />
                </div>
                <Choices
                  label="가족과 공유할 식사 선호"
                  value={familyMeal}
                  options={['한식', '국물요리', '가벼운 식사', '카페에서 쉬기']}
                  onChange={setFamilyMeal}
                />
                <Button className="primary-cta" onClick={() => setBrief(true)}>
                  우리 가족 여행안 보기
                  <ArrowRight size={17} />
                </Button>
              </section>
              <aside className="family-connection">
                <div className="connection-title">
                  <Users size={23} />
                  <h2>가족과 함께 정하기</h2>
                </div>
                {projected ? (
                  <>
                    <span className="connection-state">
                      <Check size={15} />
                      가족 여권 연결됨
                    </span>
                    <p>
                      {projected.mission
                        ? projected.mission.title
                        : '미션 공유는 허용되지 않았어요.'}
                    </p>
                    {projected.mission && (
                      <p className="shared-place-names">
                        {projected.mission.placeNames.join(' → ')}
                      </p>
                    )}
                    <p>
                      {projected.meal
                        ? '식사 선호: ' + projected.meal
                        : '식사 선호는 공유되지 않았어요.'}
                    </p>
                    <div className="scope-chips">
                      {Object.entries(projected.scopes)
                        .filter(([, v]) => v)
                        .map(([k]) => (
                          <span key={k}>{scopeLabels[k as keyof Scopes]}</span>
                        ))}
                    </div>
                    {projected.scopes.passport && (
                      <small>
                        공유된 여행 기록 {projected.passport.length}개
                      </small>
                    )}
                  </>
                ) : (
                  <>
                    <p>
                      초대코드가 있으면 허용된 여행 계획을 함께 볼 수 있어요.
                    </p>
                    <label className="field">
                      초대코드
                      <input
                        value={invite}
                        onChange={(e) =>
                          setInvite(
                            e.target.value
                              .toUpperCase()
                              .replace(/[^A-Z0-9]/g, '')
                              .slice(0, 8),
                          )
                        }
                        placeholder="8자리 초대코드"
                        autoComplete="off"
                      />
                    </label>
                    <Button variant="outline" onClick={join}>
                      가족 여권 연결
                    </Button>
                  </>
                )}
                <p className="helper">
                  현재는 같은 브라우저에서 역할을 바꾸는 체험입니다. 다른
                  기기와는 연결되지 않습니다.
                </p>
                <button className="text-action" onClick={() => go('passport')}>
                  초대코드 만들기
                  <ChevronRight size={14} />
                </button>
              </aside>
            </div>
            {brief && (
              <>
                <section className="family-briefing">
                  <div className="section-title">
                    <div>
                      <span className="section-overline">부모 브리핑</span>
                      <h2>{familyRegion}에서 함께하는 여행</h2>
                      <p>
                        {familyDate ? familyDate + ' 희망' : '날짜 미정'} ·{' '}
                        {familyTransport} · 전체 도보 {familyWalk} 이내 희망
                      </p>
                    </div>
                  </div>
                  {familyLive.mode === 'loading' && (
                    <p role="status">관광·식사 후보를 확인하고 있어요.</p>
                  )}
                  {familyLive.mode === 'unavailable' && (
                    <p className="warning">
                      실시간 관광정보를 연결하지 못해 별도 공개 자료로 여행안을
                      구성했습니다.
                    </p>
                  )}
                  <div className="family-route-preview">
                    {familyMission?.stops.map((x, i) => (
                      <div key={x.place.id}>
                        <span>{i + 1}</span>
                        <b>{x.place.title}</b>
                        <small>체류 {x.stay}분 추정</small>
                      </div>
                    )) || <p>여행 후보를 추가 확인해야 합니다.</p>}
                  </div>
                  <div className="family-checks">
                    <div>
                      <Footprints size={22} />
                      <h3>걸음은 이 정도</h3>
                      <p>
                        전체 약{' '}
                        {familyMission?.stops.reduce((a, b) => a + b.walk, 0) ||
                          '—'}
                        분 추정
                      </p>
                      <small>계단·경사는 시설에 확인해 주세요.</small>
                    </div>
                    <div>
                      <CarFront size={22} />
                      <h3>차를 가져온다면</h3>
                      <p>아래 주차·접근 정보를 확인하세요.</p>
                      <small>실시간 주차 잔여면은 제공하지 않습니다.</small>
                    </div>
                    <div>
                      <CloudRain size={22} />
                      <h3>실내로 바꾸고 싶다면</h3>
                      <p>
                        {familyIndoor.map((p) => p.title).join(' · ') ||
                          '실내 후보를 더 확인해야 합니다.'}
                      </p>
                      <small>
                        선택 날짜의 운영·예약은 별도 확인이 필요합니다.
                      </small>
                    </div>
                  </div>
                  {familyMission &&
                    familyMission.stops.reduce((a, b) => a + b.walk, 0) >
                      parseInt(familyWalk) && (
                      <p className="warning">
                        도보 상한을 넘는 여행안입니다. 장소 수나 동선을 조정해야
                        합니다.
                      </p>
                    )}
                  {familyMission && familyOrigin && (
                    <Button
                      disabled={!projected?.scopes.propose}
                      onClick={() => {
                        if (projected?.scopes.propose) {
                          setProposal({
                            entry: createEntry(familyMission, familyOrigin!),
                            walkLimit: familySettings.walkLimit,
                            transport: familySettings.transport,
                          });
                          setNotice('내 여행에 가족의 제안을 남겼습니다.');
                        }
                      }}
                    >
                      이 미션을 가족에게 제안
                      <ArrowUpRight size={16} />
                    </Button>
                  )}
                  {!projected?.scopes.propose && (
                    <p className="helper">
                      가족 연결 후 미션 제안 권한이 있으면 제안을 남길 수
                      있어요.
                    </p>
                  )}
                </section>
                <section className="family-meals">
                  <div className="section-title">
                    <div>
                      <h2>함께 먹을 한 끼</h2>
                      <p>
                        선호 메모: {familyMeal}. 아래는 인근 식당 후보이며
                        메뉴·알레르기 적합성은 직접 확인하세요.
                      </p>
                    </div>
                  </div>
                  <div className="meal-list">
                    {meals.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setPlaceOpen(p);
                        }}
                      >
                        {p.image_url && (
                          <PlacePhoto
                            key={p.image_url}
                            src={p.image_url}
                            title={p.title}
                          />
                        )}
                        <span>
                          <b>{p.title}</b>
                          <small>{p.address}</small>
                          <span>
                            메뉴·방문 정보
                            <ChevronRight size={13} />
                          </span>
                        </span>
                      </button>
                    ))}
                    {!meals.length && (
                      <p className="helper">
                        현재 조회된 음식점 후보가 없습니다.
                      </p>
                    )}
                  </div>
                </section>
                <section className="accessibility-panel">
                  <div className="section-title">
                    <div>
                      <h2>계단과 주차부터 확인해요.</h2>
                      <p>
                        여행안과 비교할 수 있는 {familyRegion} 편의시설 정보
                      </p>
                    </div>
                  </div>
                  {access.mode === 'loading' && (
                    <p role="status">편의시설 정보를 확인하고 있어요.</p>
                  )}
                  {access.mode === 'unavailable' && (
                    <p className="warning">
                      정보를 연결하지 못했습니다. 시설에 직접 확인해 주세요.
                    </p>
                  )}
                  {access.items.map((item) => (
                    <details className="accessibility-item" key={item.place.id}>
                      <summary>
                        <span>
                          <b>{item.place.title}</b>
                          <small>주차·접근 동선·휠체어 안내</small>
                        </span>
                        <ChevronRight size={19} />
                      </summary>
                      <ApiFacts data={item} loading={false} />
                      <VerifiedFacts place={item.place} />
                    </details>
                  ))}
                  <p className="helper">
                    출처: ⓒ한국관광공사 · 편의 안내가 있어도 전체 동선이
                    무장애라는 뜻은 아닙니다.
                  </p>
                </section>
                <WeatherCard region={familyRegion} />
              </>
            )}
            <p className="quiet-privacy">
              <LockKeyhole size={15} />
              정확한 복귀시각·군번·실명·부대 정보는 공유하지 않습니다.
            </p>
          </main>
        </TabsContent>
        <TabsContent value="passport">
          <main className="saved-page content-page">
            <div className="content-heading">
              <div>
                <h1>내 여행</h1>
                <p>계획한 하루와 함께 다녀온 곳을 모아둬요.</p>
              </div>
              <button className="text-action" onClick={() => go('family')}>
                가족 브리핑
                <ArrowUpRight size={16} />
              </button>
            </div>
            <div className="saved-create-actions">
              <Button onClick={() => openBuilder(null, 'new')}>
                <Navigation size={18} />새 코스 만들기
              </Button>
              <Button variant="outline" onClick={() => go('home')}>
                추천 코스 가져오기
                <ArrowRight size={17} />
              </Button>
            </div>
            {proposal && projected?.scopes.propose && (
              <section className="received-proposal">
                <Users size={23} />
                <div>
                  <small>가족이 제안한 미션</small>
                  <b>{proposal.entry.title}</b>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSettings((s) => ({
                      ...s,
                      region: proposal.entry.region,
                      companion: '부모님',
                      walkLimit: proposal.walkLimit,
                      transport: proposal.transport,
                      originId: proposal.entry.plan?.originId || '',
                      weather: 'unknown',
                      weatherForecast: undefined,
                    }));
                    setReviewEntry(proposal.entry);
                    setSelectedId(proposal.entry.missionId);
                    go('planner');
                  }}
                >
                  살펴보기
                </Button>
              </section>
            )}
            <div className="saved-layout">
              <section className="saved-records">
                <div className="record-tabs">
                  <button
                    className={recordTab === 'plans' ? 'active' : ''}
                    onClick={() => setRecordTab('plans')}
                  >
                    계획한 미션{' '}
                    <span>
                      {entries.filter((e) => !hasVisitRecord(e)).length}
                    </span>
                  </button>
                  <button
                    className={recordTab === 'memories' ? 'active' : ''}
                    onClick={() => setRecordTab('memories')}
                  >
                    여행 기록{' '}
                    <span>{entries.filter(hasVisitRecord).length}</span>
                  </button>
                </div>
                {entries
                  .filter((e) =>
                    recordTab === 'plans'
                      ? !hasVisitRecord(e)
                      : hasVisitRecord(e),
                  )
                  .map((e) => (
                    <article className="saved-mission" key={entryKey(e)}>
                      <div className="saved-mission-cover">
                        <CourseCover
                          places={
                            resolveEntry(e, places)?.mission.stops.map(
                              (s) => s.place,
                            ) ||
                            e.plan?.stops.map(
                              (stop) =>
                                places.find((p) => p.id === stop.placeId) || {
                                  id: stop.placeId,
                                  title:
                                    e.plan?.manualPlaces?.find(
                                      (p) => p.id === stop.placeId,
                                    )?.title || '장소 정보 확인 중',
                                  image_url: '',
                                },
                            ) ||
                            []
                          }
                        />
                      </div>
                      <div className="saved-mission-heading">
                        <span>{e.region}</span>
                        <h2>{e.title}</h2>
                        {e.plan?.departureAt && (
                          <p className="saved-departure">
                            출발 계획{' '}
                            {scheduleTime(Date.parse(e.plan.departureAt))}
                          </p>
                        )}
                        <small>
                          {hasVisitRecord(e)
                            ? '내가 직접 남긴 여행 기록'
                            : '아직 다녀오지 않은 여행 계획'}
                        </small>
                      </div>
                      {e.stamps.includes('휴가 씨앗') && (
                        <p className="preparation-record">
                          <Leaf size={15} /> 방문 준비 기록 · 방문 인증 아님
                        </p>
                      )}
                      {!e.plan && (
                        <p className="helper">
                          이전 버전 기록입니다. 당시 장소 순서는 보관되지
                          않았습니다.
                        </p>
                      )}
                      <div className="stamp-actions">
                        {['입경', '전환', '복귀', '동행'].map((stamp) => (
                          <button
                            key={stamp}
                            className={
                              e.stamps.includes(stamp) ? 'recorded' : ''
                            }
                            onClick={() => addStamp(entryKey(e), stamp)}
                          >
                            {e.stamps.includes(stamp) ? (
                              <Check size={14} />
                            ) : (
                              <Stamp size={14} />
                            )}{' '}
                            {stamp}
                          </button>
                        ))}
                      </div>
                      <div className="saved-mission-actions">
                        <button
                          disabled={!e.plan}
                          onClick={() =>
                            openBuilder(e, hasVisitRecord(e) ? 'copy' : 'edit')
                          }
                        >
                          {hasVisitRecord(e)
                            ? '복사해서 새 코스 만들기'
                            : '코스 수정'}
                        </button>
                        <button
                          disabled={!e.plan}
                          onClick={() => {
                            openEntry(e);
                          }}
                        >
                          저장한 장소 다시 보기
                          <ChevronRight size={14} />
                        </button>
                        <button onClick={() => setShared(e)}>
                          <ArrowUpRight size={14} />
                          공유 카드
                        </button>
                      </div>
                    </article>
                  ))}
                {!entries.filter((e) =>
                  recordTab === 'plans'
                    ? !hasVisitRecord(e)
                    : hasVisitRecord(e),
                ).length && (
                  <div className="saved-empty">
                    <BookOpen size={32} />
                    <h2>
                      {recordTab === 'plans'
                        ? '다음 여행을 골라볼까요?'
                        : '다녀온 뒤 기록을 남겨요.'}
                    </h2>
                    <p>
                      {recordTab === 'plans'
                        ? '마음에 드는 미션을 여기에 담아둘 수 있어요.'
                        : '계획한 미션에 방문 단계를 직접 기록하면 여기에 모입니다.'}
                    </p>
                    <Button variant="outline" onClick={() => go('home')}>
                      미션 둘러보기
                      <ArrowRight size={16} />
                    </Button>
                  </div>
                )}
                <p className="helper">
                  스탬프는 개인 기록이며 공적 방문 인증이 아닙니다. 복귀시각은
                  저장하지 않습니다.
                </p>
              </section>
              <aside className="passport-summary">
                <span className="section-overline">비무장 패스포트</span>
                <h2>강원에 남긴 발걸음</h2>
                <p>다섯 지역의 기록을 한 권에.</p>
                <div className="chapter-records">
                  {regions.slice(0, 5).map((r, i) => (
                    <div key={r}>
                      <span>0{i + 1}</span>
                      <b>{chapters[i]}</b>
                      <small>
                        {
                          entries.filter(
                            (e) => e.region === r && hasVisitRecord(e),
                          ).length
                        }
                        개 기록
                      </small>
                    </div>
                  ))}
                </div>
                <details className="invite-settings">
                  <summary>
                    가족에게 여권 초대하기
                    <ChevronRight size={17} />
                  </summary>
                  <p className="helper">
                    같은 브라우저에서만 사용할 수 있는 24시간 체험 코드입니다.
                  </p>
                  {family ? (
                    <>
                      <div className="invite-code">
                        {family.code}
                        <button
                          onClick={() => copy(family.code)}
                          aria-label="초대코드 복사"
                        >
                          <Copy size={18} />
                        </button>
                      </div>
                      {(Object.keys(scopeLabels) as (keyof Scopes)[]).map(
                        (k) => (
                          <Toggle
                            key={k}
                            label={scopeLabels[k]}
                            checked={family.scopes[k]}
                            onChange={(v) =>
                              setFamily((x) =>
                                x
                                  ? { ...x, scopes: { ...x.scopes, [k]: v } }
                                  : x,
                              )
                            }
                          />
                        ),
                      )}
                      <button
                        className="text-action"
                        onClick={() => {
                          setFamily(null);
                          setJoined('');
                          setProposal(null);
                          setNotice('초대를 해제했습니다.');
                        }}
                      >
                        초대 해제
                      </button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={createInvite}>
                      초대코드 만들기
                    </Button>
                  )}
                </details>
                <button className="radar-shortcut" onClick={() => go('radar')}>
                  <Leaf size={18} />
                  <span>
                    휴가회수 레이더<small>현충시설 방문과 제도 확인 준비</small>
                  </span>
                  <ChevronRight size={16} />
                </button>
                {installPrompt && (
                  <Button
                    variant="outline"
                    onClick={() => installPrompt.prompt()}
                  >
                    홈 화면에 추가
                  </Button>
                )}
              </aside>
            </div>
            <Sheet
              open={Boolean(shared)}
              onOpenChange={(v) => !v && setShared(null)}
            >
              <SheetContent side="bottom" className="share-sheet">
                <SheetHeader>
                  <SheetTitle>우리의 여행 기록</SheetTitle>
                  <SheetDescription>
                    정확한 시간·좌표·부대 정보가 없는 카드입니다.
                  </SheetDescription>
                </SheetHeader>
                {shared && (
                  <div className="editor-body">
                    <div className="share-preview">
                      <span>군번여지도 강원</span>
                      <h2>{publicCard(shared).mission}</h2>
                      <p>
                        {shared.region} ·{' '}
                        {shared.stamps.join(' · ') || '계획한 여행'}
                      </p>
                      <small>복무 경험을 관광 경험으로.</small>
                    </div>
                    <Button
                      className="primary-cta"
                      onClick={() => downloadCard(shared)}
                    >
                      <Download size={17} />
                      카드 이미지 저장
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        copy(
                          publicCard(shared).message +
                            ' ' +
                            publicCard(shared).mission,
                        )
                      }
                    >
                      공유 문구 복사
                      <Copy size={16} />
                    </Button>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </main>
        </TabsContent>
        <TabsContent value="radar">
          <main className="page-container">
            <div className="page-heading">
              <div>
                <span className="section-overline">현충시설 방문 준비</span>
                <h1>휴가회수 레이더</h1>
                <p>
                  호국의 기억을 돌아보는 여행, 방문 전 인정 조건을 확인하세요.
                </p>
              </div>
              <Leaf size={45} />
            </div>
            <div className="warning reward-disclaimer">
              이 기능은 제도 활용 준비를 돕는 안내입니다. 실제 휴가·외출 보상
              인정 여부는 공식 인증 결과와 소속 부대 지침에 따릅니다.
            </div>
            <div className="two-columns">
              <section className="panel">
                <h2>먼저 확인할 세 가지</h2>
                {[
                  '공식 보훈 안내에서 해당 시설·방문 인증 절차 확인',
                  '소속 부대에 인정 대상·기간·제출 방식 직접 확인',
                  '시설 방문 조건·운영 여부·인증 준비물 확인',
                ].map((label, i) => (
                  <Toggle
                    key={label}
                    label={label}
                    checked={radarChecks[i]}
                    onChange={(v) =>
                      setRadarChecks((x) => x.map((b, j) => (i === j ? v : b)))
                    }
                  />
                ))}
                <p className="helper">
                  군 신분증·휴가증·인증 서류는 업로드하지 않습니다.
                </p>
                <a
                  className="external-button"
                  href="https://www.mpva.go.kr/"
                  target="_blank"
                  rel="noreferrer"
                >
                  국가보훈부 공식 안내 확인 <ExternalLink size={16} />
                </a>
                <Field
                  label="준비 기록을 남길 여행"
                  value={
                    entries.findIndex((e) => entryKey(e) === radarRecordId) >= 0
                      ? entries.findIndex(
                          (e) => entryKey(e) === radarRecordId,
                        ) +
                        1 +
                        '. ' +
                        entries.find((e) => entryKey(e) === radarRecordId)!
                          .title
                      : '여행 선택'
                  }
                  options={entries.map((e, i) => i + 1 + '. ' + e.title)}
                  onChange={(v) => {
                    const entry = entries[parseInt(v) - 1];
                    if (entry) setRadarRecordId(entryKey(entry));
                  }}
                />
                <Button
                  className="primary-cta"
                  disabled={
                    !radarChecks.every(Boolean) ||
                    !entries.some((e) => entryKey(e) === radarRecordId)
                  }
                  onClick={() => {
                    if (
                      radarChecks.every(Boolean) &&
                      entries.some((e) => entryKey(e) === radarRecordId)
                    )
                      addStamp(radarRecordId, '휴가 씨앗');
                  }}
                >
                  확인 준비를 휴가 씨앗으로 기록 <Leaf size={17} />
                </Button>
                <p className="helper">
                  준비 스탬프일 뿐 보상 자격이나 지급을 의미하지 않습니다. 먼저
                  패스포트에 계획을 담아주세요.
                </p>
              </section>
              <section className="panel">
                <Field
                  label="후보 시설 권역"
                  value={settings.region}
                  options={[...regions]}
                  onChange={(v) => change('region', v)}
                />
                <h2>현충시설 등재 목록</h2>
                <p className="helper">
                  현충시설 등재가 장병 보상 대상으로 인정된다는 뜻은 아닙니다.
                  개별 대상 여부는 미검증입니다.
                </p>
                {rewards.slice(0, 8).map((p) => (
                  <article className="reward-card" key={p.id}>
                    <h3>{p.title}</h3>
                    <p>{p.address}</p>
                    <span className="tag">보상 대상 공식 확인 필요</span>
                    <Source p={p} />
                  </article>
                ))}
                {!rewards.length && (
                  <p>
                    해당 권역의 좌표가 검증된 후보를 아직 확보하지 못했습니다.
                  </p>
                )}
              </section>
            </div>
          </main>
        </TabsContent>
        <TabsContent value="data">
          <main className="page-container">
            <div className="page-heading">
              <div>
                <span className="section-overline">이용 안내</span>
                <h1>여행 정보와 출처</h1>
                <p>실시간 응답, 공개 원천 자료, 계산 가정을 구분합니다.</p>
              </div>
              <Database size={40} />
            </div>
            <div className="data-metrics">
              <div>
                <b>{basePlaces.length}</b>
                <span>접경 5군 원천 노드</span>
              </div>
              <div>
                <b>{basePlaces.filter(validCoord).length}</b>
                <span>좌표 범위 유효 후보</span>
              </div>
              <div>
                <b>{live.places.length}</b>
                <span>현재 권역 TourAPI 수신</span>
              </div>
              <div>
                <b>0</b>
                <span>현장 운영 검증 완료</span>
              </div>
            </div>
            <section className="panel">
              <h2>한국관광공사 OpenAPI</h2>
              <p>
                출처: ⓒ한국관광공사 · 국문 관광정보 서비스_GW / 무장애 여행 정보
              </p>
              <p className="status-line">
                {live.mode === 'live'
                  ? '실시간 호출 성공'
                  : '실시간 호출 미완료'}{' '}
                {live.error && '· ' + live.error}
              </p>
              <p>
                법정동 코드 응답 → 강원·시군구 발견 →
                관광지·문화시설·축제·숙박·음식점 조회 → 미션 장소 후보 구성 →
                상세·무장애 조건 조회
              </p>
              {live.fetchedAt && (
                <p>
                  실제 수신 시각:{' '}
                  {localInputDate(live.fetchedAt).replace('T', ' ')} ·
                  lDongRegnCd {live.lDongRegnCd} / lDongSignguCd{' '}
                  {live.lDongSignguCd}
                </p>
              )}
              <p className="helper">
                운영 DB에 TourAPI 응답을 저장하지 않습니다. 화면 요청마다 서버를
                통해 조회합니다. 유형별 첫 100개만 화면 후보로 사용하며 전체
                수집 결과와 구분합니다.
              </p>
              <Button
                variant="outline"
                onClick={() => setRefresh((x) => x + 1)}
              >
                <RefreshCw size={16} /> 실제 API 다시 호출
              </Button>
              {live.categories && (
                <pre>{JSON.stringify(live.categories, null, 2)}</pre>
              )}
              <div className="demo-note">
                현재 공사 API 연결에 성공하지 않았다면 이 버전은 필수 API 활용
                검증을 마친 제출본이 아닙니다. 통일부·보훈부 파일로 공사 API
                활용을 대신했다고 표시하지 않습니다.
              </div>
            </section>
            <div className="two-columns source-panels">
              <section className="panel">
                <h2>확보한 공공 원천 자료</h2>
                <p>
                  <a
                    href="https://www.data.go.kr/data/15119699/fileData.do"
                    target="_blank"
                    rel="noreferrer"
                  >
                    통일부 DMZ 관광
                  </a>{' '}
                  · 2026-08-20판
                  <br />
                  전국 614행 → 접경 5군 309행
                </p>
                <p>
                  <a
                    href="https://www.data.go.kr/data/15119706/fileData.do"
                    target="_blank"
                    rel="noreferrer"
                  >
                    통일부 DMZ 카페
                  </a>{' '}
                  · 2025-10-31판
                  <br />
                  전국 1,785행 → 접경 5군 218행
                </p>
                <p>
                  <a
                    href="https://www.mpva.go.kr/mpva/contents.do?key=17"
                    target="_blank"
                    rel="noreferrer"
                  >
                    국가보훈부 현충시설 API
                  </a>
                  <br />
                  전국 2,381행 → 접경 5군 80행
                </p>
                <p className="helper">
                  수집일 2026-09-07 · 원천 간 중복 가능. 좌표 범위 유효는 현장
                  위치·출입 가능성을 보증하지 않습니다.
                </p>
              </section>
              <section className="panel">
                <h2>추가 연동과 검증이 필요한 데이터</h2>
                <p>
                  TAGO 교통, 관광지 집중률·중심 관광지·연관 관광지, 병무청 혜택,
                  공개 식단
                </p>
                <p>
                  날씨는 기상청 예보를 조회하며, 혼잡·교통·도보 시간은
                  추정값입니다. 보훈시설은 보상 가능성이 검증된 목록이 아닙니다.
                </p>
                <h3>이미지 출처</h3>
                <a
                  href="https://www.kogl.or.kr/recommend/recommendDivView.do?division=img&oc=&recommendIdx=2453"
                  target="_blank"
                  rel="noreferrer"
                >
                  고석정 · 한국문화관광연구원(2015), 공공누리 제1유형
                </a>
              </section>
            </div>
            <section className="panel">
              <h2>장소 데이터 검사</h2>
              <label className="field">
                장소·권역 검색
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="예: 고석정, 화천군"
                />
              </label>
              <div className="node-list">
                {places
                  .filter((p) => (p.title + p.sigungu).includes(search))
                  .slice(0, 40)
                  .map((p) => (
                    <article key={p.id}>
                      <div>
                        <h3>{p.title}</h3>
                        <p>
                          {p.sigungu} · {p.category}
                        </p>
                        <Source p={p} />
                      </div>
                      <span className="tag">
                        {validCoord(p) ? '좌표 범위 유효' : '좌표 확인 필요'}
                      </span>
                      <details>
                        <summary>원천·품질 플래그</summary>
                        <pre>
                          {JSON.stringify(
                            {
                              id: p.id,
                              source: p.source,
                              source_id: p.source_id,
                              lat: p.lat,
                              lon: p.lon,
                              flags: p.data_quality_flags,
                              last_verified_at: p.last_verified_at,
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    </article>
                  ))}
              </div>
              <p className="helper">
                최대 40개 표시 · 수집일과 현장 검증일은 다릅니다.
              </p>
            </section>
            <section className="privacy-panel">
              <ShieldCheck />
              <p>
                GPS 자동 수집, 부대명, 군번, 정확한 복무지, 작전·근무 정보,
                휴가증·신분증 이미지 입력 기능이 없습니다. 공유 결과는 허용된
                관광 기록만 포함합니다.
              </p>
            </section>
          </main>
        </TabsContent>
      </Tabs>
      <footer className="footer">
        <span>
          군번여지도 강원 <b>휴전선 밖 첫 하루</b>
        </span>
        <p>
          안전마진은 공개 거점까지의 참고값입니다. 실제 교통과 소속 부대 복귀
          규정은 직접 확인해 주세요.
        </p>
        <button onClick={() => go('data')}>
          출처·데이터 상태 확인 <ArrowUpRight size={14} />
        </button>
        <button
          onClick={async () => {
            const response = await fetch('/api/test-access', {
              method: 'DELETE',
            });
            if (response.ok) window.location.assign('/login');
            else setNotice('테스트를 종료하지 못했습니다. 다시 시도해 주세요.');
          }}
        >
          테스트 입장 종료
        </button>
      </footer>
      {composer && (
        <TripBuilder
          key={composer.key}
          initial={composer.entry}
          mode={composer.mode}
          places={places}
          initialOrigin={origin}
          settings={settings}
          mapKey={mapKey}
          onClose={() => setComposer(null)}
          onSave={(entry, memoryPlaces, returnAt) => {
            const old =
              composer.mode === 'edit' &&
              composer.entry &&
              !hasVisitRecord(composer.entry)
                ? entryKey(composer.entry)
                : null;
            setEntries((v) =>
              old
                ? v.map((e) => (entryKey(e) === old ? entry : e))
                : [entry, ...v],
            );
            setExtraPlaces((v) => [
              ...new Map(
                [...v, ...memoryPlaces].map((p) => [p.id, p]),
              ).values(),
            ]);
            setReviewEntry(entry);
            setSelectedId(entry.missionId);
            setSettings((v) => ({
              ...v,
              region: entry.region,
              originId: entry.plan!.originId,
              returnAt,
              weather: 'unknown',
              weatherForecast: undefined,
            }));
            setComposer(null);
            setRecordTab('plans');
            go('passport');
            setNotice(
              '장소·순서·출발 계획·체류시간을 이 브라우저에 저장했습니다. 복귀시각은 저장하지 않습니다.',
            );
          }}
        />
      )}
      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent side="bottom" className="trip-editor">
          <SheetHeader>
            <SheetTitle>
              {
                [
                  '누구와 어디에서 만날까요?',
                  '언제까지 돌아오면 되나요?',
                  '어떤 하루가 편할까요?',
                ][editStep]
              }
            </SheetTitle>
            <SheetDescription>{editStep + 1} / 3 · 여행 조건</SheetDescription>
          </SheetHeader>
          {draft && (
            <div className="editor-body">
              {editStep === 0 && (
                <>
                  <Choices
                    label="나는"
                    value={draft.role}
                    options={['현역 장병', '부모님', '여자친구·친구', '면회객']}
                    onChange={(v) => draftChange('role', v)}
                  />
                  <Field
                    label="만나는 지역"
                    value={draft.region}
                    options={[...regions]}
                    onChange={(v) => draftChange('region', v)}
                  />
                  <Choices
                    label="오늘의 상황"
                    value={draft.situation}
                    options={[
                      '휴가',
                      '외출',
                      '면회',
                      '수료식',
                      '전역 전',
                      '입영 전날',
                    ]}
                    onChange={(v) => draftChange('situation', v)}
                  />
                  <Choices
                    label="함께하는 사람"
                    value={draft.companion}
                    options={['혼자', '전우', '부모님', '가족', '연인', '친구']}
                    onChange={(v) => draftChange('companion', v)}
                  />
                  <Field
                    label="이동수단"
                    value={
                      {
                        car: '자차',
                        transit: '대중교통',
                        taxi: '택시+버스',
                        unknown: '미정',
                      }[draft.transport]
                    }
                    options={['자차', '대중교통', '택시+버스', '미정']}
                    onChange={(v) =>
                      draftChange(
                        'transport',
                        (
                          {
                            자차: 'car',
                            대중교통: 'transit',
                            '택시+버스': 'taxi',
                            미정: 'unknown',
                          } as const
                        )[v as '자차'],
                      )
                    }
                  />
                </>
              )}
              {editStep === 1 && (
                <>
                  <Choices
                    label="지금부터 쓸 수 있는 시간"
                    value={
                      draft.duration === 1440
                        ? '1박 2일'
                        : draft.duration / 60 + '시간'
                    }
                    options={['2시간', '4시간', '8시간', '1박 2일']}
                    onChange={(v) =>
                      draftPreset(
                        (
                          {
                            '2시간': 120,
                            '4시간': 240,
                            '8시간': 480,
                            '1박 2일': 1440,
                          } as Record<string, number>
                        )[v],
                      )
                    }
                  />
                  <label className="field">
                    공개 거점 도착 목표
                    <input
                      type="datetime-local"
                      value={localInputDate(draft.returnAt)}
                      onChange={(e) => {
                        const iso = parseKoreaInput(e.target.value);
                        if (iso)
                          setDraft((s) => ({
                            ...s!,
                            returnAt: iso,
                            startedAt: new Date().toISOString(),
                            duration: Math.max(
                              1,
                              Math.ceil((Date.parse(iso) - Date.now()) / 60000),
                            ),
                          }));
                      }}
                    />
                  </label>
                  <p className="helper">
                    한국 시각 기준입니다. 거점 이후 부대까지 이동·수속할 시간은
                    따로 남겨주세요.
                  </p>
                  {draft.region === settings.region && origin && (
                    <Field
                      label="만나는 곳 · 돌아올 공개 거점"
                      value={
                        local.find((p) => p.id === draft.originId)?.title ||
                        origin.title
                      }
                      options={local
                        .filter(
                          (p) =>
                            p.category === 'attraction' ||
                            p.category === 'culture',
                        )
                        .slice(0, 80)
                        .map((p) => p.title)}
                      onChange={(v) =>
                        draftChange(
                          'originId',
                          local.find((p) => p.title === v)?.id || '',
                        )
                      }
                    />
                  )}
                  {draft.region !== settings.region && (
                    <p className="helper">
                      선택 지역의 공개 관광 거점으로 미션을 만든 뒤 만남 장소를
                      조정할 수 있습니다.
                    </p>
                  )}
                  <div className="editor-privacy">
                    <LockKeyhole size={17} />
                    부대명·군번·정확한 복무지는 입력하지 않습니다.
                  </div>
                </>
              )}
              {editStep === 2 && (
                <>
                  <Choices
                    label="원하는 경험"
                    value={draft.theme}
                    options={['회복', '평화', '호국', '가족', '기록', '보상']}
                    onChange={(v) => draftChange('theme', v)}
                  />
                  <Field
                    label="편안한 전체 도보 시간"
                    value={draft.walkLimit + '분'}
                    options={['15분', '30분', '60분', '90분']}
                    onChange={(v) => draftChange('walkLimit', parseInt(v))}
                  />
                  <Field
                    label="추가로 남겨둘 여유"
                    value={draft.extraBuffer + '분'}
                    options={['15분', '30분', '60분', '90분']}
                    onChange={(v) => draftChange('extraBuffer', parseInt(v))}
                  />
                  <p className="helper">
                    {draft.weatherForecast
                      ? `적용 출처: ${draft.weatherForecast.region} ${draft.weatherForecast.baseTime.slice(0, 2)}시 기상청 예보`
                      : '날씨는 직접 선택한 가정입니다.'}{' '}
                    {effectiveWeather(draft, now).reason}
                  </p>
                  <WeatherCard
                    region={draft.region}
                    onApply={(v, provenance) =>
                      setDraft((s) => ({
                        ...s!,
                        weather: v,
                        weatherForecast: provenance,
                      }))
                    }
                  />
                  <Field
                    label="계산에 적용할 날씨"
                    value={
                      {
                        unknown: '미확인',
                        clear: '기본 버퍼',
                        rain: '비 보정',
                        wind: '강풍 보정',
                        snow: '눈·결빙 보정',
                      }[effectiveWeather(draft, now).condition]
                    }
                    options={[
                      '미확인',
                      '기본 버퍼',
                      '비 보정',
                      '강풍 보정',
                      '눈·결빙 보정',
                    ]}
                    onChange={(v) =>
                      draftChange(
                        'weather',
                        (
                          {
                            미확인: 'unknown',
                            '기본 버퍼': 'clear',
                            '비 보정': 'rain',
                            '강풍 보정': 'wind',
                            '눈·결빙 보정': 'snow',
                          } as const
                        )[v as '미확인'],
                      )
                    }
                  />
                </>
              )}
            </div>
          )}
          <SheetFooter>
            {editStep > 0 && (
              <Button
                variant="outline"
                onClick={() => setEditStep((x) => x - 1)}
              >
                이전
              </Button>
            )}
            <Button
              onClick={() =>
                editStep < 2 ? setEditStep((x) => x + 1) : applyTrip()
              }
            >
              {editStep < 2 ? '다음' : '이 조건으로 미션 보기'}
              <ArrowRight size={17} />
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <Sheet
        open={Boolean(placeOpen)}
        onOpenChange={(v) => !v && setPlaceOpen(null)}
      >
        <SheetContent side="bottom" className="place-sheet">
          <SheetHeader>
            <SheetTitle>{placeOpen?.title}</SheetTitle>
            <SheetDescription>{placeOpen?.address}</SheetDescription>
          </SheetHeader>
          {placeOpen && (
            <div className="editor-body">
              <VerifiedFacts place={placeOpen} />
              {placeOpen.source === 'tourapi' ? (
                <ApiFacts
                  data={detail?.data}
                  loading={detail?.loading || detail?.id !== placeOpen.id}
                />
              ) : (
                <p>
                  이 장소의 실시간 운영·편의 정보는 제공되지 않았습니다.
                  운영기관에 확인해 주세요.
                </p>
              )}
              <Source p={placeOpen} />
              {validCoord(placeOpen) && (
                <a
                  className="external-button"
                  href={kakaoLink(placeOpen)}
                  target="_blank"
                  rel="noreferrer"
                >
                  카카오맵에서 길찾기
                  <ArrowUpRight size={17} />
                </a>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
      {notice && (
        <div className="notice" role="status">
          <Check size={18} />
          {notice}
          <button onClick={() => setNotice('')} aria-label="알림 닫기">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
