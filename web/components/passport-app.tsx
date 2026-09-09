'use client';
import MemoryImage from './memory-image';
import PhotoCredits from './photo-credits';
import { withPhoto } from '@/lib/place-photos';
import Discovery from './discovery';
import { recommendationEntry } from '@/lib/discovery';
import { pageFetch, clearPageCache } from '@/lib/page-cache';
import Brand from './brand';
import { Input } from './ui/input';
import TravelGroups, { TravelHome, useTravelGroups } from './travel-groups';
import GroupShare from './group-share';
import { groupEntry } from '@/lib/group-model';
import type { GroupDetail, GroupPlan } from '@/lib/group-model';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  X,
  EllipsisVertical,
  Home,
  CalendarDays,
  Star,
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
  Users,
  Database,
  ExternalLink,
  LockKeyhole,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu';
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
import MeetingPicker from './meeting-picker';
import OutingPanel from './outing-panel';
import TripCompletion from './trip-completion';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from './ui/alert-dialog';
import DayRecord from './day-record';
import AdviceManager from './advice-manager';
import { AdviceRoute } from './advice-shared';
import {
  adviceEntry,
  adviceIdValid,
  applyAdvice,
  adviceIsApplied,
  type AdviceDetail,
  type AdviceSuggestion,
} from '@/lib/advice-model';
import { adviceRequest } from '@/lib/advice-client';
import { dayRecord, dayRecordSvg, dayRecordText } from '@/lib/day-passport';
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
  assessPlan,
  planSchedule,
  withPlan,
  validManualPlace,
  manualToPlace,
  manualReference,
  validOuting,
  completeTrip,
  reviseVisitRecord,
  restoreTravelPlan,
  localInputDate,
  parseKoreaInput,
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
} from '@/lib/domain';
import type {
  Place,
  ManualPlace,
  ActiveOuting,
  Settings,
  Entry,
  Family,
} from '@/lib/domain';
const LABELS = {
  dashboard: '홈',
  groups: '그룹',
  home: '둘러보기',
  planner: '지도·미션',
  outing: '현재 출타',
  family: '동행 브리핑',
  passport: '내 여행',
  radar: '현충시설 방문 준비',
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
  message?: string;
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
    return <span className="source-link">직접 지정한 개인 장소</span>;
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
    <MemoryImage
      src={src}
      alt={title}
      loading={eager ? 'eager' : 'lazy'}
      onError={() => setFailed(true)}
    />
  );
}
export default function PassportApp() {
  const [basePlaces, setBasePlaces] = useState<Place[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [extraPlaces, setExtraPlaces] = useState<Place[]>([]);
  const [composer, setComposer] = useState<{
    key: string;
    entry: Entry | null;
    mode: 'new' | 'edit' | 'copy';
    group?: GroupDetail;
    groupPlan?: GroupPlan;
    resumeOuting?: boolean;
    outingDeadline?: string;
    advice?: { shareId: string; suggestion: AdviceSuggestion };
  } | null>(null);
  const [view, setView] = useState('dashboard');
  const groupStore = useTravelGroups();
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupReload, setGroupReload] = useState(0);
  const [groupSharing, setGroupSharing] = useState<{
    entry?: Entry;
    groupId?: string;
    record?: GroupPlan;
    resume?: typeof composer;
  } | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [outingDeadline, setOutingDeadline] = useState<string>();
  const [browseRegion, setBrowseRegion] = useState('철원군');
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
  const [savedReferencesLoading, setSavedReferencesLoading] = useState(false);
  const [radarRecordId, setRadarRecordId] = useState('');
  const [notice, setNotice] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [favorites, setFavorites] = useState<ManualPlace[]>([]);
  const [activeOuting, setActiveOuting] = useState<ActiveOuting | null>(null);
  const [startCandidate, setStartCandidate] = useState<Entry | null>(null);
  const [adviceManaging, setAdviceManaging] = useState<Entry | null>(null);
  const [adviceImport, setAdviceImport] = useState<AdviceDetail | null>(null);
  const [adviceLinkHandled, setAdviceLinkHandled] = useState(false);
  const [recordEditing, setRecordEditing] = useState<Entry | null>(null);
  const [recordRestoring, setRecordRestoring] = useState<Entry | null>(null);
  const [completion, setCompletion] = useState<Entry | null>(null);
  const [meetingContext, setMeetingContext] = useState<
    'draft' | 'favorites' | null
  >(null);
  const [family, setFamily] = useState<Family | null>(null);
  const joined = '';
  const [loaded, setLoaded] = useState(false);
  const [proposal] = useState<{
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
  const requestedRegion = view === 'home' ? browseRegion : settings.region;
  useEffect(() => {
    const readView = () => {
      const key = window.location.hash.slice(1).split('?')[0];
      setView(
        new URLSearchParams(window.location.search).has('join')
          ? 'groups'
          : Object.hasOwn(LABELS, key)
            ? key
            : 'dashboard',
      );
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
    pageFetch('/api/catalog')
      .then((r) => r.json())
      .then((data) => {
        const result = data as { places?: Place[] };
        if (Array.isArray(result.places)) setBasePlaces(result.places);
      })
      .catch(() =>
        setNotice(
          '공개 장소 목록을 불러오지 못했습니다. 연결 상태를 확인해 주세요.',
        ),
      )
      .finally(() => setCatalogLoading(false));
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
      if (
        saved?.version === 1 ||
        saved?.version === 2 ||
        saved?.version === 3
      ) {
        if (Array.isArray(saved.favorites))
          setFavorites(saved.favorites.filter(validManualPlace).slice(0, 50));
        if (validOuting(saved.activeOuting))
          setActiveOuting(saved.activeOuting);
        const defaults = saved.planning;
        if (
          defaults &&
          regions.includes(defaults.region) &&
          Number.isFinite(Date.parse(defaults.startedAt)) &&
          defaults.duration > 0 &&
          defaults.duration <= 10080
        ) {
          setSettings((v) => ({
            ...v,
            region: defaults.region,
            startedAt: defaults.startedAt,
            duration: defaults.duration,
            returnAt: new Date(
              Date.parse(defaults.startedAt) + defaults.duration * 60000,
            ).toISOString(),
            originId: defaults.originId || '',
            transport: ['car', 'transit', 'taxi', 'unknown'].includes(
              defaults.transport,
            )
              ? defaults.transport
              : v.transport,
          }));
          if (validManualPlace(defaults.meeting))
            setExtraPlaces((v) => [...v, manualToPlace(defaults.meeting)]);
        }
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
    pageFetch('/api/status')
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
        JSON.stringify({
          version: 3,
          entries,
          family,
          favorites,
          activeOuting,
          planning: {
            region: settings.region,
            startedAt: settings.startedAt,
            duration: Math.round(
              (Date.parse(settings.returnAt) - Date.parse(settings.startedAt)) /
                60000,
            ),
            originId: settings.originId,
            transport: settings.transport,
            meeting: (() => {
              const p = extraPlaces.find(
                (p) => p.id === settings.originId && p.source === 'manual',
              );
              return p ? manualReference(p) : undefined;
            })(),
          },
        }),
      );
    } catch {
      setNotice(
        '이 브라우저에서는 저장할 수 없습니다. 현재 화면에서만 기록이 유지됩니다.',
      );
    }
  }, [loaded, entries, family, favorites, activeOuting, settings, extraPlaces]);
  useEffect(() => {
    let canceled = false;
    const controller = new AbortController();
    setLive({ mode: 'loading', places: [] });
    pageFetch('/api/places?region=' + encodeURIComponent(requestedRegion), {
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
  }, [requestedRegion, refresh]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 7000);
    return () => clearTimeout(t);
  }, [notice]);
  const places = useMemo(
    () => [
      ...new Map(
        [
          ...favorites.map(manualToPlace),
          ...extraPlaces,
          ...basePlaces,
          ...live.places,
        ].map((p) => [p.id, withPhoto(p)]),
      ).values(),
    ],
    [live.places, basePlaces, extraPlaces, favorites],
  );
  const local = useMemo(
    () => regionPlaces(places, settings.region),
    [places, settings.region],
  );
  useEffect(() => {
    if (live.mode === 'loading') return;
    const candidates = [
      ...[
        completion,
        shared,
        recordEditing,
        composer?.entry,
        adviceManaging,
      ].filter((entry): entry is Entry => !!entry),
      ...(view === 'outing' && (startCandidate || activeOuting)
        ? [startCandidate || activeOuting!.entry]
        : []),
      ...(reviewEntry ? [reviewEntry] : []),
      ...(['passport', 'dashboard'].includes(view) ? entries : []),
    ];
    const plans = candidates.filter((e) => e.plan).map((e) => e.plan!);
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
    setSavedReferencesLoading(ids.length > 0);
    if (!ids.length) return;
    let canceled = false;
    const batches = Array.from({ length: Math.ceil(ids.length / 13) }, (_, i) =>
      ids.slice(i * 13, i * 13 + 13),
    );
    void Promise.all(
      batches.map((batch) =>
        pageFetch('/api/places/resolve', {
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
      if (!canceled) setSavedReferencesLoading(false);
    });
    return () => {
      canceled = true;
    };
  }, [
    reviewEntry,
    completion,
    recordEditing,
    composer,
    adviceManaging,
    shared,
    view,
    entries,
    activeOuting,
    startCandidate,
    live.mode,
    refresh,
  ]);
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
        rank[assessPlan(a, settings, origin).band] -
        rank[assessPlan(b, settings, origin).band],
    );
  }, [missionOptions, settings, origin]);
  const selected = reviewEntry
    ? resolvedEntry?.mission
    : missions.find((m) => m.id === selectedId) || missions[0];
  const score =
    selected && origin ? assessPlan(selected, settings, origin) : null;
  const itinerary =
    selected && origin ? planSchedule(selected, settings, origin) : null;
  const projected = familyProjection(
    family,
    joined,
    entries,
    selected || null,
    settings.meal,
    now.getTime(),
  );
  const familyStart = familyDate
    ? parseKoreaInput(
        familyDate + 'T' + localInputDate(settings.startedAt).slice(11, 16),
      )
    : settings.startedAt;
  const familySettings = {
    ...settings,
    region: familyRegion,
    startedAt: familyStart,
    returnAt: new Date(
      Date.parse(familyStart) + settings.duration * 60000,
    ).toISOString(),
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
    pageFetch('/api/places?region=' + encodeURIComponent(familyRegion), options)
      .then((r) => r.json())
      .then((x) => {
        if (!controller.signal.aborted) setFamilyLive(x as Live);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setFamilyLive({ mode: 'unavailable', places: [] });
      });
    pageFetch(
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
    const d = new Date((draft || settings).startedAt);
    setDraft((s) => ({
      ...(s || settings),
      duration: minutes,
      startedAt: d.toISOString(),
      returnAt: new Date(d.getTime() + minutes * 60000).toISOString(),
    }));
  }
  function applyTrip() {
    if (
      !draft ||
      !Number.isFinite(Date.parse(draft.returnAt)) ||
      Date.parse(draft.returnAt) <= Date.parse(draft.startedAt)
    ) {
      setNotice('돌아올 시각을 출발 예정 시각보다 뒤로 설정해 주세요.');
      return;
    }
    setSettings(draft);
    setNow(new Date());
    setSelectedId('');
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
        v === 'dashboard'
          ? window.location.pathname + window.location.search
          : '#' + v,
      );
    setView(v);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function openBuilder(entry: Entry | null, mode: 'new' | 'edit' | 'copy') {
    if (
      mode === 'edit' &&
      entry &&
      activeOuting &&
      entryKey(entry) === entryKey(activeOuting.entry)
    ) {
      setNotice(
        '현재 출타 중인 여행은 수정할 수 없어요. 출타를 마친 뒤 새 코스로 복사할 수 있습니다.',
      );
      go('outing');
      return;
    }
    setComposer({ key: crypto.randomUUID(), entry, mode });
  }
  useEffect(() => {
    if (!loaded || catalogLoading || adviceLinkHandled) return;
    const id = new URLSearchParams(window.location.search).get('advice');
    if (!adviceIdValid(id)) return;
    setAdviceLinkHandled(true);
    adviceRequest<AdviceDetail>('/api/public-advice/' + id)
      .catch((e) => {
        if (e.status === 410)
          return adviceRequest<AdviceDetail>('/api/advice?id=' + id);
        throw e;
      })
      .then((detail) => {
        if (detail.owner) {
          const original = entries.find((e) => e.adviceShareId === id);
          setAdviceManaging(
            original || {
              ...adviceEntry(detail.snapshot),
              recordId: 'shared-management:' + id,
              adviceShareId: id,
            },
          );
          go('passport');
        } else setAdviceImport(detail);
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.hash,
        );
      })
      .catch((e) => {
        setNotice(e.message);
      });
  }, [loaded, catalogLoading, adviceLinkHandled, entries]);
  function saveMission() {
    if (!selected || !origin) return;
    const entry = createEntry(withPlan(selected, settings), origin);
    if (entries.some((e) => planSignature(e) === planSignature(entry))) {
      setNotice('같은 장소와 순서의 미션이 이미 내 여행에 있습니다.');
      return;
    }
    setEntries((e) => [...e, entry]);
    setNotice('장소·순서·계획 시간을 내 여행에 담았습니다.');
  }
  function openEntry(entry: Entry) {
    if (
      entry.plan?.kind === 'custom' &&
      (!entry.plan.stops.length || !entry.plan.originId)
    ) {
      openBuilder(entry, 'edit');
      return;
    }
    if (!entry.plan?.timeBudgetMinutes)
      setNotice(
        '이전 버전 계획은 사용 시간이 저장되지 않아 4시간으로 열었어요. 계획 시간을 확인해 주세요.',
      );
    setReviewEntry(entry);
    setSettings((s) => ({
      ...s,
      region: entry.region,
      originId: entry.plan?.originId || '',
      startedAt: entry.plan?.departureAt || s.startedAt,
      duration: entry.plan?.timeBudgetMinutes || 240,
      returnAt: new Date(
        Date.parse(entry.plan?.departureAt || s.startedAt) +
          (entry.plan?.timeBudgetMinutes || 240) * 60000,
      ).toISOString(),
      ...(s.region !== entry.region
        ? { weather: 'unknown', weatherForecast: undefined }
        : {}),
    }));
    setSelectedId(entry.missionId);
    go('planner');
  }
  function addStamp(id: string, stamp: string) {
    if (stamp !== '휴가 씨앗') return;
    setEntries((v) =>
      v.map((e) =>
        entryKey(e) === id
          ? { ...e, stamps: [...new Set([...e.stamps, stamp])] }
          : e,
      ),
    );
    setNotice(
      '휴가 씨앗을 준비 기록으로 남겼습니다. 여행 완료 기록과는 별개입니다.',
    );
  }
  function startTrip(entry: Entry) {
    if (activeOuting) {
      go('outing');
      setNotice('현재 진행 중인 출타를 먼저 마치거나 종료해 주세요.');
      return;
    }
    setOutingDeadline(undefined);
    setStartCandidate(entry);
    go('outing');
  }
  useEffect(() => {
    const p = placeOpen;
    if (!p || p.source !== 'tourapi') return;
    const controller = new AbortController();
    setDetail({ id: p.id, data: null, loading: true });
    pageFetch(
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
    if (e.completedAt && dayRecord(e, places).missingCount) {
      setNotice('다녀온 관광지를 모두 불러온 뒤 카드를 저장해 주세요.');
      return;
    }
    if (hasVisitRecord(e)) {
      const url = URL.createObjectURL(
        new Blob([dayRecordSvg(e, places)], { type: 'image/svg+xml' }),
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = '군번여지도-하루의한장.svg';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
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
      )}<text x="80" y="775" fill="#667c99" font-family="sans-serif" font-size="30">${safe(card.stamps.join(' · ') || '여행 계획')}</text><line x1="80" y1="870" x2="1000" y2="870" stroke="#e0e7f0"/><text x="80" y="940" fill="#94a1b2" font-family="sans-serif" font-size="26">복무 경험을 관광 경험으로.</text></svg>`;
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
          ? '계획 조정 필요'
          : '계산 확인 필요';
  return (
    <div
      className="app-shell"
      data-ready={loaded}
      inert={!loaded}
      aria-busy={!loaded}
    >
      <header className="topbar travel-header">
        <button
          className="brand"
          aria-label="군번여지도 홈"
          onClick={() => go('dashboard')}
        >
          <Brand />
        </button>
        <span className="header-location">강원에서 함께 보내는 하루</span>
        <button className="top-link" onClick={() => go('data')}>
          <Layers3 size={17} /> 이용 안내
        </button>
      </header>
      <Tabs value={view} onValueChange={(v) => go(String(v))}>
        <TabsList className="main-nav" variant="line">
          {Object.entries(LABELS)
            .filter(([key]) =>
              ['dashboard', 'home', 'outing', 'groups', 'passport'].includes(
                key,
              ),
            )
            .sort(
              ([a], [b]) =>
                ['dashboard', 'home', 'outing', 'groups', 'passport'].indexOf(
                  a,
                ) -
                ['dashboard', 'home', 'outing', 'groups', 'passport'].indexOf(
                  b,
                ),
            )
            .map(([key, label]) => (
              <TabsTrigger key={key} value={key} className={'nav-' + key}>
                {key === 'dashboard' ? (
                  <Home />
                ) : key === 'home' ? (
                  <Compass />
                ) : key === 'planner' ? (
                  <Navigation />
                ) : key === 'outing' ? (
                  <Clock3 />
                ) : key === 'groups' ? (
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
        <TabsContent value="dashboard">
          <TravelHome
            entries={entries}
            places={places}
            onContinue={(entry) => openBuilder(entry, 'edit')}
            outing={activeOuting}
            store={groupStore}
            onOpen={openEntry}
            onGroup={(id) => {
              setSelectedGroupId(id);
              go('groups');
            }}
            onGo={go}
            onNew={() => openBuilder(null, 'new')}
          />
        </TabsContent>
        <TabsContent value="groups">
          <TravelGroups
            key={groupReload}
            store={groupStore}
            selectedId={selectedGroupId}
            onSelect={setSelectedGroupId}
            onNew={(group) =>
              setComposer({
                key: crypto.randomUUID(),
                entry: null,
                mode: 'new',
                group,
              })
            }
            onEdit={(group, record) =>
              setComposer({
                key: crypto.randomUUID(),
                entry: groupEntry(record),
                mode: 'edit',
                group,
                groupPlan: record,
              })
            }
            onImport={(_group, record) => {
              const entry = groupEntry(record);
              setEntries((v) => [entry, ...v]);
              go('passport');
              setNotice(
                '내 여행에 사본을 담았어요. 만남 장소와 복귀 기준은 직접 확인해 주세요.',
              );
            }}
            onShare={(group) => setGroupSharing({ groupId: group.id })}
            onBrief={() => go('family')}
          />
        </TabsContent>
        <TabsContent value="home">
          <Discovery
            places={places}
            region={browseRegion}
            onRegion={setBrowseRegion}
            onNew={() =>
              setComposer({
                key: crypto.randomUUID(),
                mode: 'new',
                entry: {
                  recordId: crypto.randomUUID(),
                  missionId: 'custom:' + crypto.randomUUID(),
                  title:
                    browseRegion.replace('군', '') + '에서 보내는 우리 하루',
                  region: browseRegion,
                  stamps: [],
                  plan: {
                    kind: 'custom',
                    variant: '직접 만든 코스',
                    originId: '',
                    stops: [],
                    manualPlaces: [],
                    timeBudgetMinutes: 240,
                  },
                },
              })
            }
            onPhotos={() => setPhotoOpen(true)}
            onChoose={(m) => {
              setExtraPlaces((v) => [
                ...new Map(
                  [...v, ...m.stops.map((s) => s.place)].map((p) => [p.id, p]),
                ).values(),
              ]);
              setComposer({
                key: crypto.randomUUID(),
                entry: recommendationEntry(m),
                mode: 'new',
              });
            }}
          />
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
                        reviewEntry ||
                          createEntry(withPlan(selected, settings), origin),
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
                {live.mode === 'loading' || savedReferencesLoading
                  ? '장소 정보를 다시 확인하고 있어요.'
                  : reviewEntry
                    ? '저장한 장소 정보를 연결하지 못했습니다. 다른 장소로 바꾸지 않았어요.'
                    : '이 조건의 미션을 구성하지 못했습니다.'}
                <button
                  onClick={() => {
                    clearPageCache();
                    setRefresh((x) => x + 1);
                  }}
                >
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
                        <span>만남 장소까지 복귀 여유</span>
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
                        저장·제안한 장소 순서 · 계획한 출발시각 기준
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
                        <span>함께할 사람</span>
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
                          <small>만남 장소으로 돌아오기</small>
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
                          <dt>여행 시간</dt>
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
                      openBuilder(
                        createEntry(withPlan(selected, settings), origin),
                        'copy',
                      )
                    }
                  >
                    가져와서 수정
                  </Button>
                  <Button onClick={saveMission}>
                    <BookOpen size={17} />
                    {entries.some(
                      (e) =>
                        planSignature(e) ===
                        planSignature(
                          createEntry(
                            withPlan(selected, settings),
                            origin,
                            'preview',
                          ),
                        ),
                    )
                      ? '내 여행에 담은 미션'
                      : '이 미션 내 여행에 담기'}
                  </Button>
                </div>
              </>
            )}
          </main>
        </TabsContent>
        <TabsContent value="outing">
          <OutingPanel
            key={startCandidate ? entryKey(startCandidate) : 'active'}
            active={activeOuting}
            candidate={startCandidate}
            entries={entries}
            places={places}
            settings={settings}
            now={now}
            placesLoading={catalogLoading || savedReferencesLoading}
            onChange={setActiveOuting}
            initialDeadline={outingDeadline}
            onCandidate={(entry) => {
              setOutingDeadline(undefined);
              setStartCandidate(entry);
            }}
            onComplete={setCompletion}
            onPlan={() => go('passport')}
            onEdit={(entry, deadline) => {
              setStartCandidate(null);
              setComposer({
                key: crypto.randomUUID(),
                entry,
                mode: 'edit',
                resumeOuting: true,
                outingDeadline: deadline,
              });
            }}
            onPlace={setPlaceOpen}
          />
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
                  <h2>함께 계획할 사람 초대하기</h2>
                </div>
                <p>
                  가족, 연인, 친구와 그룹을 만들면 서로 다른 기기에서도 여행
                  계획을 함께 보고 수정할 수 있어요.
                </p>
                <Button variant="outline" onClick={() => go('groups')}>
                  그룹 만들기 · 초대 참여
                </Button>
                <p className="helper">
                  이 브리핑은 부모님과의 여행을 준비할 때 도보·식사·날씨를
                  확인하는 도구입니다.
                </p>
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
                      onClick={() =>
                        groupStore.groups.length
                          ? setGroupSharing({
                              entry: createEntry(
                                withPlan(familyMission, familySettings),
                                familyOrigin!,
                              ),
                            })
                          : go('groups')
                      }
                    >
                      이 여행안을 그룹에 공유
                      <ArrowUpRight size={16} />
                    </Button>
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
                동행 브리핑
                <ArrowUpRight size={16} />
              </button>
            </div>
            <div className="saved-create-actions">
              <Button
                variant="outline"
                onClick={() => setMeetingContext('favorites')}
              >
                <Star size={18} />
                즐겨찾는 장소
              </Button>
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
                    여행 계획{' '}
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
                      {hasVisitRecord(e) ? (
                        <DayRecord entry={e} places={places} compact />
                      ) : (
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
                      )}
                      <div className="saved-mission-heading">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="record-more-trigger" aria-label={`${e.title} 더보기`}>
                            <EllipsisVertical size={22} />
                          </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="record-more-menu">
                        {!hasVisitRecord(e) && (
                          <DropdownMenuItem
                            disabled={!e.plan?.stops.length}
                            onClick={() => setAdviceManaging(e)}
                          >
                            {e.adviceShareId
                              ? '받은 한 수 보기'
                              : '한 수 부탁하기'}
                          </DropdownMenuItem>
                        )}
                        {hasVisitRecord(e) && e.adviceShareId && (
                          <DropdownMenuItem onClick={() => setAdviceManaging(e)}>
                            공유한 여행 관리
                          </DropdownMenuItem>
                        )}
                        {hasVisitRecord(e) && (
                          <>
                            <DropdownMenuItem onClick={() => setRecordEditing(e)}>
                              기록 수정
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={
                                !e.plan ||
                                (!!activeOuting &&
                                  entryKey(activeOuting.entry) === entryKey(e))
                              }
                              onClick={() => setRecordRestoring(e)}
                            >
                              계획으로 되돌리기
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem
                          disabled={
                            !e.plan ||
                            (activeOuting !== null &&
                              entryKey(activeOuting.entry) === entryKey(e))
                          }
                          onClick={() =>
                            openBuilder(e, hasVisitRecord(e) ? 'copy' : 'edit')
                          }
                        >
                          {hasVisitRecord(e)
                            ? '새 여행으로 가져오기'
                            : '코스 수정'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!e.plan}
                          onClick={() => {
                            openEntry(e);
                          }}
                        >
                          저장한 장소 다시 보기
                          <ChevronRight size={14} />
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!e.plan}
                          onClick={() =>
                            groupStore.groups.length
                              ? setGroupSharing({ entry: e })
                              : go('groups')
                          }
                        >
                          그룹에 공유
                        </DropdownMenuItem>

                      </DropdownMenuContent>
                        </DropdownMenu>
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
                      {hasVisitRecord(e) ? (
                        <div className="stamp-actions">
                          {e.stamps.map((stamp) => (
                            <span className="recorded" key={stamp}>
                              <Check size={14} />
                              {stamp}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="trip-record-actions">
                          <Button
                            variant="outline"
                            disabled={!e.plan?.stops.length}
                            onClick={() => startTrip(e)}
                          >
                            출타 시작
                          </Button>
                          <Button
                            disabled={!e.plan?.stops.length}
                            onClick={() => setCompletion(e)}
                          >
                            여행 완료
                          </Button>
                        </div>
                      )}
                      {!e.plan?.stops.length && (
                        <p className="helper">
                          빈 코스를 저장했어요. 준비되면 장소를 담아보세요.
                        </p>
                      )}
                      <Button variant="outline" className="record-share-card" onClick={() => setShared(e)}>
                        <ArrowUpRight size={18} /> 공유 카드
                      </Button>
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
                        : '여행 완료를 확인하면 여기에 모입니다.'}
                    </p>
                    <Button variant="outline" onClick={() => go('home')}>
                      미션 둘러보기
                      <ArrowRight size={16} />
                    </Button>
                  </div>
                )}
                <p className="helper">
                  스탬프는 여행 완료 후 직접 남기는 기록입니다. 계획 시각과 개인
                  장소는 공개 카드에 포함하지 않습니다. 그룹 공유는 별도 확인 후
                  진행합니다.
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
                <button className="radar-shortcut" onClick={() => go('groups')}>
                  <Users size={18} />
                  <span>
                    함께 떠나는 그룹
                    <small>가족·연인·친구와 여행 계획 공유</small>
                  </span>
                  <ChevronRight size={16} />
                </button>
                <button className="radar-shortcut" onClick={() => go('radar')}>
                  <Leaf size={18} />
                  <span>
                    현충시설 방문 준비
                    <small>현충시설 방문과 제도 확인 준비</small>
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
                    {hasVisitRecord(shared) ? (
                      <DayRecord entry={shared} places={places} />
                    ) : (
                      <div className="share-preview">
                        <span>군번여지도 강원</span>
                        <h2>{publicCard(shared).mission}</h2>
                        <p>
                          {shared.region} ·{' '}
                          {shared.stamps.join(' · ') || '계획한 여행'}
                        </p>
                        <small>복무 경험을 관광 경험으로.</small>
                      </div>
                    )}
                    <Button
                      className="primary-cta"
                      onClick={() => downloadCard(shared)}
                      disabled={
                        hasVisitRecord(shared) &&
                        dayRecord(shared, places).missingCount > 0
                      }
                    >
                      <Download size={17} />
                      카드 이미지 저장
                    </Button>
                    <Button
                      variant="outline"
                      disabled={
                        hasVisitRecord(shared) &&
                        dayRecord(shared, places).missingCount > 0
                      }
                      onClick={() =>
                        copy(
                          hasVisitRecord(shared)
                            ? dayRecordText(shared, places)
                            : publicCard(shared).message +
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
                <h1>현충시설 방문 준비</h1>
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
            <a className="guide-callout" href="/guide">
              처음 사용하시나요? 화면으로 보는 사용 가이드{' '}
              <ArrowUpRight size={17} />
            </a>
            <details className="data-photo-disclosure">
              <summary>사진 출처와 이용조건</summary>
              <PhotoCredits />
            </details>
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
              {live.message && <p className="warning">{live.message}</p>}
              <p>
                출처: ⓒ한국관광공사 · 국문 관광정보 서비스_GW / 무장애 여행 정보
              </p>
              <p className="status-line">
                {live.mode === 'live'
                  ? '실시간 호출 성공'
                  : '실시간 호출 미완료'}{' '}
                {live.error &&
                  '· ' +
                    (live.error === 'DAILY_QUOTA_EXCEEDED'
                      ? '오늘의 관광정보 요청 한도 초과'
                      : live.error === 'RATE_LIMITED'
                        ? '요청 제한 중'
                        : live.error)}
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
                같은 관광정보는 이 페이지가 열려 있는 동안 재사용합니다.
                새로고침하거나 다시 조회하면 갱신합니다. 서버 DB 저장은
                제공기관·공모전의 별도 신청 조건을 확인한 후 도입할 수 있습니다.
                유형별 첫 100개를 후보로 사용합니다.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  clearPageCache();
                  setRefresh((x) => x + 1);
                }}
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
                GPS 자동 수집, 군번, 작전·근무 정보, 휴가증·신분증 이미지 입력
                기능이 없습니다. 공유 결과는 허용된 관광 기록만 포함합니다.
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
          안전마진은 만남 장소까지의 참고값입니다. 실제 교통과 소속 부대 복귀
          규정은 직접 확인해 주세요.
        </p>
        <a href="/guide">
          사용 가이드 <ArrowUpRight size={14} />
        </a>
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
      {groupSharing && (
        <GroupShare
          entries={entries}
          groups={groupStore.groups}
          entry={groupSharing.entry}
          groupId={groupSharing.groupId}
          record={groupSharing.record}
          onClose={() => {
            if (groupSharing.resume) setComposer(groupSharing.resume);
            setGroupSharing(null);
          }}
          onSave={async (groupId, plan, record) => {
            await groupStore.action({
              action: 'savePlan',
              groupId,
              plan,
              planId: record?.id,
              version: record?.version,
            });
            setGroupSharing(null);
            setSelectedGroupId(groupId);
            setGroupReload((v) => v + 1);
            go('groups');
            setNotice('그룹에 여행을 공유했어요.');
          }}
        />
      )}
      <Sheet open={photoOpen} onOpenChange={setPhotoOpen}>
        <SheetContent side="bottom" className="photo-credit-sheet">
          <SheetHeader>
            <SheetTitle>사진 출처</SheetTitle>
            <SheetDescription>장소별 사진 원문과 이용조건</SheetDescription>
          </SheetHeader>
          <PhotoCredits />
        </SheetContent>
      </Sheet>
      {composer && (
        <TripBuilder
          key={composer.key}
          initial={composer.entry}
          mode={composer.mode}
          initialDirty={
            !!composer.advice || (!!composer.group && !!composer.entry)
          }
          saveTarget={composer.group ? 'group' : 'personal'}
          places={places}
          placesLoading={catalogLoading || live.mode === 'loading'}
          initialOrigin={origin}
          settings={settings}
          mapKey={mapKey}
          favorites={favorites}
          onFavoritesChange={setFavorites}
          onClose={() => {
            if (composer.resumeOuting) {
              setOutingDeadline(composer.outingDeadline);
              setStartCandidate(composer.entry);
            }
            setComposer(null);
          }}
          onSave={async (entry, memoryPlaces, returnAt) => {
            if (composer.group) {
              setExtraPlaces((v) => [...v, ...memoryPlaces]);
              setGroupSharing({
                entry,
                groupId: composer.group.id,
                record: composer.groupPlan,
                resume: { ...composer, entry, mode: 'edit' },
              });
              setComposer(null);
              return;
            }
            const old =
              composer.mode === 'edit' &&
              composer.entry &&
              entries.some((e) => entryKey(e) === entryKey(composer.entry!)) &&
              !hasVisitRecord(composer.entry)
                ? entryKey(composer.entry)
                : null;
            if (old && composer.entry?.adviceShareId)
              entry.adviceShareId = composer.entry.adviceShareId;
            if (old && composer.entry?.adviceReceipt)
              entry.adviceReceipt = composer.entry.adviceReceipt;
            const adopted =
              composer.advice &&
              adviceIsApplied(entry, composer.advice.suggestion)
                ? composer.advice
                : null;
            if (adopted)
              entry.adviceReceipt = {
                shareId: adopted.shareId,
                suggestionId: adopted.suggestion.id,
              };
            const nextEntries = old
              ? entries.map((e) => (entryKey(e) === old ? entry : e))
              : [entry, ...entries];
            let durable = false;
            try {
              const previous = JSON.parse(
                localStorage.getItem(STORAGE) || '{}',
              );
              localStorage.setItem(
                STORAGE,
                JSON.stringify({
                  ...previous,
                  version: 3,
                  entries: nextEntries,
                }),
              );
              durable = true;
            } catch {
              /* Never mark a suggestion applied until the itinerary is stored. */
            }
            setEntries(nextEntries);
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
              startedAt: entry.plan!.departureAt || v.startedAt,
              duration: entry.plan!.timeBudgetMinutes || v.duration,
              returnAt,
              weather: 'unknown',
              weatherForecast: undefined,
            }));
            setComposer(null);
            setRecordTab('plans');
            if (composer.resumeOuting) {
              setOutingDeadline(composer.outingDeadline);
              setStartCandidate(entry);
              go('outing');
            } else go('passport');
            setNotice(
              durable
                ? '여행 계획을 저장했습니다. 내 여행에서 언제든 이어서 만들 수 있어요.'
                : '브라우저 저장 공간을 확인해 주세요. 지금 변경은 현재 화면에만 남아 있습니다.',
            );
            if (adopted && durable) {
              try {
                await adviceRequest('/api/advice', {
                  action: 'adopt',
                  id: adopted.shareId,
                  suggestionId: adopted.suggestion.id,
                });
                setEntries((v) =>
                  v.map((e) =>
                    entryKey(e) === entryKey(entry)
                      ? { ...e, adviceReceipt: undefined }
                      : e,
                  ),
                );
                setNotice(
                  '한 수를 내 계획에 저장했어요. 공개 페이지에도 반영 표시를 남겼습니다.',
                );
              } catch {
                setNotice(
                  '계획은 저장했지만 공개 반영 표시는 연결되지 않았어요. 받은 한 수 보기에서 다시 마무리할 수 있습니다.',
                );
              }
            }
          }}
        />
      )}
      {adviceManaging && (
        <AdviceManager
          entry={
            entries.find((e) => entryKey(e) === entryKey(adviceManaging)) ||
            adviceManaging
          }
          places={places}
          onClose={() => setAdviceManaging(null)}
          onPublish={(id) => {
            setEntries((v) =>
              v.map((e) =>
                entryKey(e) === entryKey(adviceManaging)
                  ? { ...e, adviceShareId: id }
                  : e,
              ),
            );
            setAdviceManaging((e) => (e ? { ...e, adviceShareId: id } : e));
          }}
          onReceiptCleared={() =>
            setEntries((v) =>
              v.map((e) =>
                entryKey(e) === entryKey(adviceManaging)
                  ? { ...e, adviceReceipt: undefined }
                  : e,
              ),
            )
          }
          onReview={(suggestion, shareId) => {
            const current = entries.find(
              (e) => entryKey(e) === entryKey(adviceManaging),
            );
            if (
              !current ||
              hasVisitRecord(current) ||
              (activeOuting &&
                entryKey(activeOuting.entry) === entryKey(current))
            ) {
              setAdviceManaging(null);
              setNotice(
                '이 브라우저에 준비 중인 원본 계획이 있어야 반영할 수 있어요. 완료한 기록과 현재 출타는 변경하지 않습니다.',
              );
              return;
            }
            const adjusted = applyAdvice(current, suggestion);
            if (!adjusted) {
              setAdviceManaging(null);
              setNotice(
                '원래 계획이 달라졌거나 장소가 겹쳐요. 코스 수정에서 현재 장소를 확인해 주세요.',
              );
              return;
            }
            setAdviceManaging(null);
            setComposer({
              key: crypto.randomUUID(),
              entry: adjusted,
              mode: 'edit',
              advice: { shareId, suggestion },
            });
            setNotice(
              '한 수를 넣은 초안이에요. 시간과 장소를 확인하고 저장하면 반영됩니다. 취소하면 원래 계획을 유지해요.',
            );
          }}
        />
      )}
      {adviceImport && (
        <Sheet open onOpenChange={(v) => !v && setAdviceImport(null)}>
          <SheetContent side="bottom" className="advice-sheet">
            <SheetHeader>
              <SheetTitle>이 여행안에서 나의 하루 시작하기</SheetTitle>
              <SheetDescription>
                공개된 관광지 순서만 가져옵니다. 출발 날짜, 만남 장소와 복귀
                기준은 직접 정해 주세요.
              </SheetDescription>
            </SheetHeader>
            <div className="advice-manager-body">
              <AdviceRoute
                snapshot={adviceImport.snapshot}
                places={adviceImport.places}
              />
              <p className="advice-note">
                원래 여행과 별개의 새 계획입니다. 받은 제안은 이 공개안에 자동
                포함되지 않아요.
              </p>
              <Button
                className="advice-submit"
                onClick={() => {
                  const imported = adviceEntry(adviceImport.snapshot);
                  setAdviceImport(null);
                  openBuilder(imported, 'copy');
                }}
              >
                이 장소로 새 계획 편집
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
      {recordEditing && (
        <TripCompletion
          key={entryKey(recordEditing)}
          editing
          entry={recordEditing}
          places={places}
          onClose={() => setRecordEditing(null)}
          onConfirm={(stamps, visited, title) => {
            setEntries((v) =>
              v.map((e) =>
                entryKey(e) === entryKey(recordEditing)
                  ? reviseVisitRecord(e, title, stamps, visited)
                  : e,
              ),
            );
            setRecordEditing(null);
            setNotice(
              '여행 기록을 수정했어요. 이미 저장한 공유 이미지는 새로 저장해 주세요.',
            );
          }}
        />
      )}
      {recordRestoring && (
        <AlertDialog open onOpenChange={(v) => !v && setRecordRestoring(null)}>
          <AlertDialogContent>
            <AlertDialogTitle>여행 계획으로 되돌릴까요?</AlertDialogTitle>
            <AlertDialogDescription>
              이 여행의 완료 표시와 방문 스탬프를 지우고 준비 중인 계획으로
              옮겨요. 장소와 일정은 유지되고, 현재 출타는 시작되지 않습니다.
              원래 기록도 남기려면 ‘새 여행으로 가져오기’를 선택하세요.
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>기록 유지</AlertDialogCancel>
              <Button
                onClick={() => {
                  setEntries((v) =>
                    v.map((e) =>
                      entryKey(e) === entryKey(recordRestoring)
                        ? restoreTravelPlan(e)
                        : e,
                    ),
                  );
                  setRecordRestoring(null);
                  setRecordTab('plans');
                  setNotice(
                    '계획으로 되돌렸어요. 날짜와 장소를 확인하고 이어서 준비하세요.',
                  );
                }}
              >
                계획으로 되돌리기 확인
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {completion && (
        <TripCompletion
          key={entryKey(completion)}
          entry={completion}
          places={places}
          onClose={() => setCompletion(null)}
          onConfirm={(stamps, visitedPlaceIds) => {
            const finished = completeTrip(
              completion,
              stamps,
              new Date(),
              visitedPlaceIds,
            );
            setEntries((v) =>
              v.map((e) => (entryKey(e) === entryKey(finished) ? finished : e)),
            );
            if (
              activeOuting &&
              entryKey(activeOuting.entry) === entryKey(finished)
            )
              setActiveOuting(null);
            setCompletion(null);
            setRecordTab('memories');
            go('passport');
            setNotice(
              '하루의 한 장을 만들었어요. 공유 카드에서 저장할 수 있습니다.',
            );
          }}
        />
      )}
      <Sheet
        open={Boolean(meetingContext)}
        onOpenChange={(v) => {
          if (!v) {
            if (meetingContext === 'draft') setEditing(true);
            setMeetingContext(null);
          }
        }}
      >
        <SheetContent side="bottom" className="meeting-sheet">
          <SheetHeader>
            <SheetTitle>만나는 장소</SheetTitle>
            <SheetDescription>
              자주 만나는 곳을 저장하거나 지도에서 직접 골라요.
            </SheetDescription>
          </SheetHeader>
          <div className="editor-body">
            <MeetingPicker
              favorites={favorites}
              onFavoritesChange={setFavorites}
              region={draft?.region || settings.region}
              mapKey={mapKey}
              center={
                origin && validCoord(origin)
                  ? { lat: origin.lat!, lon: origin.lon! }
                  : undefined
              }
              onChoose={(p) => {
                setExtraPlaces((v) => [...v.filter((x) => x.id !== p.id), p]);
                if (meetingContext === 'draft') {
                  draftChange('originId', p.id);
                  setEditing(true);
                } else setSettings((v) => ({ ...v, originId: p.id }));
                setMeetingContext(null);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
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
                    출발 예정 시각
                    <input
                      type="datetime-local"
                      aria-label="출발 예정 시각"
                      value={localInputDate(draft.startedAt)}
                      onChange={(e) => {
                        const iso = parseKoreaInput(e.target.value);
                        if (iso)
                          setDraft((v) => ({
                            ...v!,
                            startedAt: iso,
                            returnAt: new Date(
                              Date.parse(iso) + v!.duration * 60000,
                            ).toISOString(),
                          }));
                      }}
                    />
                  </label>
                  <label className="field">
                    돌아올 예정 시각
                    <input
                      type="datetime-local"
                      aria-label="돌아올 예정 시각"
                      value={localInputDate(draft.returnAt)}
                      onChange={(e) => {
                        const iso = parseKoreaInput(e.target.value);
                        if (iso)
                          setDraft((v) => ({
                            ...v!,
                            returnAt: iso,
                            duration: Math.max(
                              1,
                              Math.round(
                                (Date.parse(iso) - Date.parse(v!.startedAt)) /
                                  60000,
                              ),
                            ),
                          }));
                      }}
                    />
                  </label>
                  <p className="helper">
                    계획은 출발 예정 시각을 기준으로 계산합니다. 현재 시각은
                    현재 출타에서만 사용해요.
                  </p>
                  <button
                    className="meeting-summary"
                    onClick={() => {
                      setEditing(false);
                      setMeetingContext('draft');
                    }}
                  >
                    <span>
                      <small>만나는 장소 · 돌아올 곳</small>
                      <strong>
                        {places.find((p) => p.id === draft.originId)?.title ||
                          '즐겨찾기 또는 지도에서 설정'}
                      </strong>
                    </span>
                    <ChevronRight size={18} />
                  </button>
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
      {notice &&
        !shared &&
        !composer &&
        !completion &&
        !recordEditing &&
        !adviceManaging &&
        !adviceImport &&
        !recordRestoring &&
        !startCandidate &&
        !photoOpen &&
        !groupSharing &&
        !placeOpen &&
        !editing && (
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
