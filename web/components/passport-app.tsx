'use client';
import { useEffect, useMemo, useState } from 'react';
import {
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
  Sun,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import WeatherCard from './weather-card';
import { VerifiedFacts, ApiFacts } from './place-facts';
import {
  regions,
  chapters,
  chapterStories,
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
} from '@/lib/domain';
import type {
  Place,
  Settings,
  Mission,
  Entry,
  Family,
  Scopes,
} from '@/lib/domain';
const PHOTO =
  'https://www.kogl.or.kr/upload_recommend/thumb_V/%EC%A7%80%EC%97%AD%EB%B3%84%EA%B4%80%EA%B4%91%EC%A7%80/%EA%B0%95%EC%9B%90%EB%8F%84/%EC%B2%A0%EC%9B%90/thumb_%EA%B3%A0%EC%84%9D%EC%A0%95_05.jpg';
const LABELS = {
  home: '오늘의 여행',
  planner: '복귀 미션',
  family: '부모 브리핑',
  passport: '패스포트',
  radar: '휴가회수 레이더',
  data: '데이터·출처',
};
const STORAGE = 'gangwon-passport-v1';
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
export default function PassportApp() {
  const [basePlaces, setBasePlaces] = useState<Place[]>([]);
  const [view, setView] = useState('home');
  const [settings, setSettings] = useState<Settings>(() => defaultSettings());
  const [now, setNow] = useState(() => new Date());
  const [live, setLive] = useState<Live>({ mode: 'loading', places: [] });
  const [refresh, setRefresh] = useState(0);
  const [mapKey, setMapKey] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [notice, setNotice] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [family, setFamily] = useState<Family | null>(null);
  const [invite, setInvite] = useState('');
  const [joined, setJoined] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [proposal, setProposal] = useState('');
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
      if (saved?.version === 1) {
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
        JSON.stringify({ version: 1, entries, family }),
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
    () => [...live.places, ...basePlaces],
    [live.places, basePlaces],
  );
  const local = useMemo(
    () => regionPlaces(places, settings.region),
    [places, settings.region],
  );
  const origin = useMemo(
    () => chooseOrigin(places, settings),
    [places, settings],
  );
  const missions = useMemo(
    () => makeMissions(places, settings),
    [places, settings],
  );
  const selected = missions.find((m) => m.id === selectedId) || missions[0];
  const score =
    selected && origin ? assess(selected, settings, origin, now) : null;
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
    companion: '부모님',
    walkLimit: parseInt(familyWalk),
    theme: '회복',
    meal: familyMeal,
    transport: familyTransport === '자차' ? 'car' : 'transit',
  } as Settings;
  const familyPlaces = [...familyLive.places, ...places];
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
  function change<K extends keyof Settings>(k: K, v: Settings[K]) {
    setSettings((s) => ({
      ...s,
      [k]: v,
      ...(k === 'region' ? { originId: '' } : {}),
    }));
    if (k === 'region') setSelectedId('');
    if (k === 'weather' && (v === 'rain' || v === 'wind' || v === 'snow'))
      setSelectedId(settings.region + '-실내');
  }
  function preset(minutes: number) {
    const d = new Date();
    setNow(d);
    setSettings((s) => ({
      ...s,
      duration: minutes,
      startedAt: d.toISOString(),
      returnAt: new Date(d.getTime() + minutes * 60000).toISOString(),
    }));
  }
  function go(v: string) {
    setView(v);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function saveMission() {
    if (!selected) return;
    setEntries((e) =>
      e.some((x) => x.missionId === selected.id)
        ? e
        : [
            ...e,
            {
              missionId: selected.id,
              title: selected.title,
              region: selected.region,
              stamps: [],
            },
          ],
    );
    setNotice(
      '미션을 패스포트에 담았습니다. 방문 스탬프는 여행 후 직접 기록해 주세요.',
    );
  }
  function addStamp(id: string, stamp: string) {
    if (stamp === '동행' && !projected?.scopes.stamp) {
      setNotice('동행 스탬프 권한이 있는 가족 초대 연결이 필요합니다.');
      return;
    }
    setEntries((e) =>
      e.map((x) =>
        x.missionId === id
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
  async function loadDetail(p: Place) {
    if (p.source !== 'tourapi') return;
    setDetail({ id: p.id, data: null, loading: true });
    try {
      const r = await fetch(
        '/api/place-detail?id=' + p.source_id + '&type=' + p.content_type_id,
        { cache: 'no-store' },
      );
      const data = await r.json();
      setDetail({ id: p.id, data, loading: false });
    } catch {
      setDetail({
        id: p.id,
        data: { error: '상세 데이터를 연결하지 못했습니다.' },
        loading: false,
      });
    }
  }
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
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080"><rect width="1080" height="1080" fill="#f4f2eb"/><rect x="70" y="70" width="940" height="940" rx="26" fill="#172f43"/><text x="130" y="190" fill="#b6d3dc" font-family="sans-serif" font-size="28">GANGWON PEACE PASSPORT</text><text x="130" y="310" fill="white" font-family="sans-serif" font-size="58">군번여지도 강원</text><text x="130" y="430" fill="white" font-family="sans-serif" font-size="34">${safe(card.region)} 여행 기록</text><text x="130" y="510" fill="white" font-family="sans-serif" font-size="29">${safe(card.mission)}</text><text x="130" y="650" fill="#b6d3dc" font-family="sans-serif" font-size="30">${safe(card.stamps.join(' · ') || '계획한 미션')}</text><text x="130" y="850" fill="white" font-family="sans-serif" font-size="30">복무 경험을 관광 경험으로.</text></svg>`;
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
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => go('home')}>
          <BookOpen />
          <span>
            군번여지도 <b>강원</b>
          </span>
        </button>
        <span className="eyebrow">GANGWON PEACE PASSPORT</span>
        <button className="top-link" onClick={() => go('data')}>
          <Layers3 size={17} /> 데이터·출처
        </button>
      </header>
      <Tabs value={view} onValueChange={(v) => go(String(v))}>
        <TabsList className="main-nav" variant="line">
          {Object.entries(LABELS).map(([key, label]) => (
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
          <main className="workspace">
            <section className="intro">
              <span className="kicker">나의 하루, 우리의 여행</span>
              <h1>
                휴전선 밖<br />첫 하루.
              </h1>
              <p>
                복무 경험을 관광 경험으로.
                <br />
                장병과 가족이 함께 만드는 강원 DMZ 관광 여권.
              </p>
              <Choices
                label="누구의 여행을 준비할까요?"
                value={settings.role}
                options={['현역 장병', '부모님', '여자친구·친구', '면회객']}
                onChange={(v) => change('role', v)}
              />
              <div className="preview-brief">
                <span>
                  <MapPin size={18} /> 강원 접경 5군 · 7개의 챕터
                </span>
                <h2>갈 곳보다, 함께할 하루부터.</h2>
                <p>
                  공개 만남 거점에서 출발해 돌아올 여유까지. 가족의 속도로
                  여행을 계획하세요.
                </p>
                <Button
                  className="primary-cta"
                  onClick={() =>
                    go(settings.role === '부모님' ? 'family' : 'planner')
                  }
                >
                  {settings.role === '부모님'
                    ? '부모 브리핑 만들기'
                    : '오늘의 복귀 미션 만들기'}{' '}
                  <ArrowUpRight />
                </Button>
                <button className="text-action" onClick={() => go('passport')}>
                  나의 비무장 패스포트 <ArrowRight size={15} />
                </button>
              </div>
              <p className="privacy-note">
                <ShieldCheck size={16} /> 부대명·군번·정확한 복무지는 묻지
                않습니다.
              </p>
            </section>
            <section className="first-slice">
              <img
                className="hero-photo"
                src={PHOTO}
                alt="철원 고석정의 강과 기암"
              />
              <div className="photo-title">
                <span className="kicker">CHAPTER 01 · 철원</span>
                <h2>
                  경계가
                  <br />
                  풍경이 되는 곳.
                </h2>
                <span className="photo-caption">
                  오늘은 가족의 눈으로, 강원을 만나요.
                </span>
              </div>
              <a
                className="photo-credit"
                href="https://www.kogl.or.kr/recommend/recommendDivView.do?division=img&oc=&recommendIdx=2453"
                target="_blank"
                rel="noreferrer"
              >
                고석정 · 한국문화관광연구원(2015), 공공누리 제1유형
              </a>
            </section>
            <section className="home-shortcuts">
              <button onClick={() => go('family')}>
                <HeartHandshake />
                <span>
                  <b>부모 브리핑룸</b>
                  <small>우리 가족의 속도로 계획해요</small>
                </span>
                <ChevronRight />
              </button>
              <button onClick={() => go('radar')}>
                <Leaf />
                <span>
                  <b>휴가회수 레이더</b>
                  <small>현충시설 방문과 제도 확인 준비</small>
                </span>
                <ChevronRight />
              </button>
            </section>
            <section className="chapter-strip">
              <span className="kicker">YOUR NEXT CHAPTER</span>
              <div>
                {regions.map((r, i) => (
                  <button
                    key={r}
                    onClick={() => {
                      change('region', r);
                      go('planner');
                    }}
                  >
                    <span>0{i + 1}</span>
                    <b>{chapters[i]}</b>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              </div>
            </section>
          </main>
        </TabsContent>
        <TabsContent value="planner">
          <main className="page-container">
            <div className="page-heading">
              <div>
                <span className="kicker">RETURN CLOCK · 오늘의 미션</span>
                <h1>돌아갈 여유를 남기는 여행</h1>
                <p>
                  공개 거점부터 시작하는 계획입니다. 실제 부대 복귀 경로는
                  수집하지 않습니다.
                </p>
              </div>
              <span className="local-label">
                <LockKeyhole size={14} /> 기준시각은 현재 화면에서만 사용
              </span>
            </div>
            <div className="planner-grid">
              <aside className="panel settings-panel">
                <h2>
                  <Compass size={20} /> 오늘의 조건
                </h2>
                <div className="form-grid">
                  <Field
                    label="상황"
                    value={settings.situation}
                    options={[
                      '휴가',
                      '외출',
                      '면회',
                      '수료식',
                      '전역 전',
                      '입영 전날',
                    ]}
                    onChange={(v) => change('situation', v)}
                  />
                  <Field
                    label="강원 권역"
                    value={settings.region}
                    options={[...regions]}
                    onChange={(v) => change('region', v)}
                  />
                  <Field
                    label="동행자"
                    value={settings.companion}
                    options={['혼자', '전우', '부모님', '가족', '연인', '친구']}
                    onChange={(v) => change('companion', v)}
                  />
                  <Field
                    label="이동수단"
                    value={
                      {
                        car: '자차',
                        transit: '대중교통',
                        taxi: '택시+버스',
                        unknown: '미정',
                      }[settings.transport]
                    }
                    options={['자차', '대중교통', '택시+버스', '미정']}
                    onChange={(v) =>
                      change(
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
                </div>
                <Choices
                  label="남은 시간"
                  value={
                    settings.duration === 120
                      ? '2시간'
                      : settings.duration === 240
                        ? '4시간'
                        : settings.duration === 480
                          ? '8시간'
                          : settings.duration === 1440
                            ? '1박 2일'
                            : '직접 설정'
                  }
                  options={['2시간', '4시간', '8시간', '1박 2일']}
                  onChange={(v) =>
                    preset(
                      {
                        '2시간': 120,
                        '4시간': 240,
                        '8시간': 480,
                        '1박 2일': 1440,
                      }[v] || 240,
                    )
                  }
                />
                <label className="field">
                  복귀 기준시각 · 공개 거점 도착 목표
                  <input
                    type="datetime-local"
                    value={localInputDate(settings.returnAt)}
                    onChange={(e) => {
                      const iso = parseKoreaInput(e.target.value);
                      if (iso) {
                        const d = new Date();
                        setSettings((s) => ({
                          ...s,
                          returnAt: iso,
                          startedAt: d.toISOString(),
                          duration: Math.max(
                            1,
                            Math.ceil((Date.parse(iso) - d.getTime()) / 60000),
                          ),
                        }));
                      }
                    }}
                  />
                </label>
                <p className="helper">
                  한국 시각 기준. 거점 이후 부대 이동·수속 시간을 직접 남겨
                  주세요. 출발 전 거점까지 이동은 계산에 포함되지 않습니다.
                </p>
                {origin && (
                  <Field
                    label="공개 만남·복귀 거점"
                    value={origin.title}
                    options={local
                      .filter(
                        (p) =>
                          p.category === 'attraction' ||
                          p.category === 'culture',
                      )
                      .slice(0, 80)
                      .map((p) => p.title)}
                    onChange={(v) =>
                      change(
                        'originId',
                        local.find((p) => p.title === v)?.id || '',
                      )
                    }
                  />
                )}
                <Choices
                  label="원하는 경험"
                  value={settings.theme}
                  options={['회복', '평화', '호국', '가족', '기록', '보상']}
                  onChange={(v) => change('theme', v)}
                />
                <div className="form-grid">
                  <Field
                    label="전체 도보 상한"
                    value={settings.walkLimit + '분'}
                    options={['15분', '30분', '60분', '90분']}
                    onChange={(v) => change('walkLimit', parseInt(v))}
                  />
                  <Field
                    label="추가 안전 버퍼"
                    value={settings.extraBuffer + '분'}
                    options={['15분', '30분', '60분', '90분']}
                    onChange={(v) => change('extraBuffer', parseInt(v))}
                  />
                </div>
                <WeatherCard
                  region={settings.region}
                  onApply={(v) => change('weather', v)}
                />
                <Choices
                  label="계산에 적용할 날씨 버퍼"
                  value={
                    {
                      unknown: '미확인',
                      clear: '기본 버퍼',
                      rain: '비 보정',
                      wind: '강풍 보정',
                      snow: '눈·결빙 보정',
                    }[settings.weather]
                  }
                  options={[
                    '미확인',
                    '기본 버퍼',
                    '비 보정',
                    '강풍 보정',
                    '눈·결빙 보정',
                  ]}
                  onChange={(v) =>
                    change(
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
                <button className="text-action" onClick={() => preset(240)}>
                  <RefreshCw size={14} /> 지금부터 4시간으로 다시 시작
                </button>
              </aside>
              <section className="mission-workspace">
                <div
                  className={
                    'live-strip ' + (live.mode === 'live' ? 'connected' : '')
                  }
                >
                  <Database size={16} />
                  <span>
                    {live.mode === 'live'
                      ? '한국관광공사 API 실시간 연결 · ' +
                        live.places.length +
                        '개 수신'
                      : live.mode === 'loading'
                        ? '한국관광공사 관광정보 연결 중'
                        : '통일부·보훈부 원천 자료로 둘러보기 · 관광공사 연결 전'}
                  </span>
                  <button
                    aria-label="관광정보 다시 불러오기"
                    onClick={() => setRefresh((x) => x + 1)}
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
                {!selected || !origin ? (
                  <div className="panel empty">
                    <MapPin />
                    <h2>이 권역은 실시간 관광정보 연결이 필요합니다</h2>
                    <p>
                      검증되지 않은 장소를 임의로 채우지 않았습니다. 접경 5군을
                      선택하거나 관광공사 데이터를 연결해 주세요.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className={'return-banner ' + score?.band}>
                      <div>
                        <span>
                          <Clock3 size={16} /> 복귀시계 · {bandLabel}
                        </span>
                        <strong>
                          {score?.margin === null
                            ? '계산 보류'
                            : `${(score?.margin || 0) >= 0 ? '+' : ''}${score?.margin}분`}
                        </strong>
                      </div>
                      <p>
                        {score?.conditionsConfirmed
                          ? '방문 조건 데이터 확인됨'
                          : '방문 조건 확인 필요'}
                        <br />
                        <small>공개 거점까지의 추정 안전마진</small>
                      </p>
                    </div>
                    <MissionMap
                      mission={selected}
                      origin={origin}
                      mapKey={mapKey}
                    />
                    <div className="mission-options">
                      {missions.map((m) => {
                        const a = assess(m, settings, origin, now);
                        return (
                          <button
                            key={m.id}
                            onClick={() => setSelectedId(m.id)}
                            className={
                              m.id === selected.id
                                ? 'option selected'
                                : 'option'
                            }
                          >
                            <span>
                              {m.variant === '회복' ? (
                                <Leaf size={16} />
                              ) : m.variant === '실내' ? (
                                <CloudRain size={16} />
                              ) : (
                                <Compass size={16} />
                              )}{' '}
                              {m.variant}
                            </span>
                            <b>
                              {a.margin === null
                                ? '확인 필요'
                                : `${a.margin >= 0 ? '+' : ''}${a.margin}분`}
                            </b>
                          </button>
                        );
                      })}
                    </div>
                    <article className="panel mission-detail">
                      <div className="section-head">
                        <span className="kicker">
                          MISSION BRIEF / {selected.stops.length} PLACES
                        </span>
                        <span className="tag">{selected.region}</span>
                      </div>
                      <h2>{selected.title}</h2>
                      <p>{selected.brief}</p>
                      <div className="badge-row">
                        <span>
                          <Clock3 size={15} /> 여유 포함 {score?.total}분 추정
                        </span>
                        <span>
                          <Footprints size={15} /> 도보 약 {score?.walk}분
                        </span>
                        <span>
                          <Users size={15} /> {settings.companion}
                        </span>
                      </div>
                      {settings.duration > 600 && (
                        <div className="warning">
                          1박 일정 초안 · 숙박·휴식 10시간을 확보했지만 숙소와
                          다음 날 운영은 미확인입니다.
                        </div>
                      )}
                      <div className="timeline">
                        <div className="timeline-origin">
                          <MapPin size={17} />
                          <span>
                            출발·돌아올 공개 거점 <b>{origin.title}</b>
                          </span>
                        </div>
                        {selected.stops.map((stop, i) => (
                          <section className="stop" key={stop.place.id}>
                            <span className="stop-number">0{i + 1}</span>
                            <div>
                              <small>
                                {
                                  [
                                    '풍경과 만남',
                                    '잠시 쉬어가는 자리',
                                    '기억을 남기는 곳',
                                  ][i]
                                }{' '}
                                · 체류 {stop.stay}분 추정
                              </small>
                              <h3>{stop.place.title}</h3>
                              <p className="address">{stop.place.address}</p>
                              <Source p={stop.place} />
                              <VerifiedFacts place={stop.place} />
                              <div className="stop-actions">
                                <a
                                  href={kakaoLink(stop.place)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Navigation size={13} /> 카카오맵 길찾기
                                </a>
                                {stop.place.source === 'tourapi' && (
                                  <button
                                    onClick={() => loadDetail(stop.place)}
                                  >
                                    <Database size={13} /> 상세·무장애 정보 조회
                                  </button>
                                )}
                              </div>
                              {detail?.id === stop.place.id && (
                                <details open className="api-detail">
                                  <summary>
                                    {detail.loading
                                      ? '정보 조회 중'
                                      : '공사 API 상세 응답 · 빈 값은 미확인'}
                                  </summary>
                                  <ApiFacts
                                    data={detail.data}
                                    loading={detail.loading}
                                  />
                                </details>
                              )}
                            </div>
                          </section>
                        ))}
                        <div className="timeline-origin">
                          <Check size={17} />
                          <span>
                            {origin.title}로 돌아오기 · 이동 추정에 포함
                          </span>
                        </div>
                      </div>
                      <div className="decoder">
                        <h3>
                          <ShieldCheck size={19} /> 방문 조건 · 민통선 디코더
                        </h3>
                        {selected.stops.map((s) => (
                          <div className="condition-row" key={s.place.id}>
                            <b>{s.place.title}</b>
                            <span>
                              예약{' '}
                              {s.place.reservation_required === null
                                ? '확인 필요'
                                : s.place.reservation_required
                                  ? '필요'
                                  : '불필요'}{' '}
                              · 신분증{' '}
                              {s.place.id_check_required === null
                                ? '확인 필요'
                                : s.place.id_check_required
                                  ? '필요'
                                  : '불필요'}
                            </span>
                            <small>
                              운영{' '}
                              {s.place.opening_status === 'unknown'
                                ? '확인 필요'
                                : s.place.opening_status}{' '}
                              · 주차·경사·실내 여부 별도 확인
                            </small>
                          </div>
                        ))}
                        <p>
                          QR·입장 마감·민통선 출입 조건은 시설별로 다릅니다.
                          원문과 운영기관에 확인한 후 출발하세요.
                        </p>
                      </div>
                      <details className="calculation">
                        <summary>
                          왜 이 안전마진인가요? <span>계산 근거 보기</span>
                        </summary>
                        <dl>
                          <div>
                            <dt>지금부터 남은 시간</dt>
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
                          직선거리 × 우회계수 1.6, 수단별 가정 속도와 버퍼를
                          적용했습니다. 실제 도로·통행 가능성·교통량을 측정한
                          값이 아닙니다.
                        </p>
                      </details>
                      <div className="risk-list">
                        {score?.issues.map((x) => (
                          <span key={x}>
                            <AlertTriangle size={13} />
                            {x}
                          </span>
                        ))}
                      </div>
                      {score?.band === 'avoid' && (
                        <div className="warning">
                          현재 조건에서는 추천하지 않습니다. 회복 미션을
                          선택하거나 장소 수·도보 부담을 줄이고 다시 계산해
                          주세요.
                        </div>
                      )}
                      <Button className="primary-cta" onClick={saveMission}>
                        <BookOpen size={18} /> 패스포트에 계획 담기{' '}
                        <ArrowRight size={18} />
                      </Button>
                      <p className="helper">
                        안전마진은 참고값이며 실제 교통과 소속 부대 복귀 규정은
                        직접 확인 필요합니다.
                      </p>
                    </article>
                  </>
                )}
              </section>
            </div>
          </main>
        </TabsContent>
        <TabsContent value="family">
          <main className="page-container">
            <div className="page-heading">
              <div>
                <span className="kicker">FAMILY BRIEFING ROOM</span>
                <h1>같이 가는 하루, 같이 정해요.</h1>
                <p>
                  부모님도 여행의 기획자입니다. 걷는 시간과 좋아하는 식사부터
                  맞춰보세요.
                </p>
              </div>
              <HeartHandshake size={44} />
            </div>
            <div className="two-columns">
              <section className="panel">
                <h2>가족 여권 연결</h2>
                <div className="demo-note">
                  로컬 체험 · 같은 브라우저에서 역할을 바꿔 시연합니다. 다른
                  기기 연결은 아직 지원하지 않습니다.
                </div>
                <label className="field">
                  자녀 초대코드
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
                    placeholder="8자리 체험 코드"
                    autoComplete="off"
                  />
                </label>
                <Button onClick={join} className="primary-cta">
                  허용된 정보로 연결하기 <ArrowRight size={17} />
                </Button>
                {projected ? (
                  <div className="connection">
                    <Check size={19} />
                    <b>가족 연결됨</b>
                    <div>
                      {Object.entries(projected.scopes)
                        .filter(([, v]) => v)
                        .map(([k]) => (
                          <span className="tag" key={k}>
                            {scopeLabels[k as keyof Scopes]}
                          </span>
                        ))}
                    </div>
                    <p>
                      {projected.mission
                        ? '공유된 미션: ' + projected.mission.title
                        : '미션 범위는 공유되지 않았습니다.'}
                    </p>
                    <p>
                      {projected.meal
                        ? '공유된 식사 선호: ' + projected.meal
                        : '식사 선호는 공유되지 않았습니다.'}
                    </p>
                    {projected.scopes.passport && (
                      <p>공유된 여권 기록 {projected.passport.length}개</p>
                    )}
                  </div>
                ) : (
                  <p className="helper">
                    초대 전에도 부모님의 조건으로 여행안을 만들 수 있습니다.
                  </p>
                )}
                <button className="text-action" onClick={() => go('passport')}>
                  자녀 역할로 초대코드 만들기 <ChevronRight size={14} />
                </button>
              </section>
              <section className="panel">
                <h2>부모님의 여행 조건</h2>
                <div className="form-grid">
                  <Field
                    label="방문 권역"
                    value={familyRegion}
                    options={[...regions]}
                    onChange={(v) => {
                      setFamilyRegion(v);
                      setBrief(false);
                    }}
                  />
                  <label className="field">
                    방문 날짜
                    <input
                      type="date"
                      value={familyDate}
                      onChange={(e) => setFamilyDate(e.target.value)}
                    />
                  </label>
                  <Field
                    label="이동수단"
                    value={familyTransport}
                    options={['자차', '대중교통']}
                    onChange={setFamilyTransport}
                  />
                  <Field
                    label="편안한 전체 도보 시간"
                    value={familyWalk}
                    options={['15분', '20분', '30분', '60분']}
                    onChange={setFamilyWalk}
                  />
                  <Field
                    label="식사 선호"
                    value={familyMeal}
                    options={[
                      '한식',
                      '국물요리',
                      '가벼운 식사',
                      '카페에서 쉬기',
                    ]}
                    onChange={setFamilyMeal}
                  />
                </div>
                <Button className="primary-cta" onClick={() => setBrief(true)}>
                  <HeartHandshake size={18} /> 우리 가족 브리핑 만들기{' '}
                  <ArrowRight size={18} />
                </Button>
              </section>
            </div>
            {brief && (
              <section className="panel family-result">
                <span className="kicker">우리 가족에게 맞춘 제안</span>
                {familyLive.mode === 'loading' && (
                  <p role="status">
                    방문 권역의 관광·식사 후보를 확인하고 있어요.
                  </p>
                )}
                {familyLive.mode === 'unavailable' && (
                  <p className="helper">
                    관광공사 연결을 확인하지 못해 공개 원천 자료로 여행안을
                    만들었습니다.
                  </p>
                )}
                <h2>
                  {familyMission?.title ||
                    familyRegion + ' 여행 정보 연결이 필요합니다'}
                </h2>
                <p>
                  {familyDate || '날짜 미정'} · {familyTransport} · 도보 상한{' '}
                  {familyWalk} · {familyMeal}
                </p>
                <div className="brief-grid">
                  <div>
                    <Footprints />
                    <h3>많이 걷지 않도록</h3>
                    <p>
                      장소 유형 기준 약{' '}
                      {familyMission?.stops.reduce((a, b) => a + b.walk, 0) ||
                        0}
                      분 추정. 계단·경사는 운영기관 확인이 필요합니다.
                    </p>
                  </div>
                  <div>
                    <CarFront />
                    <h3>만남과 주차</h3>
                    <p>
                      {familyMission?.stops[0]?.place.title ||
                        '공개 거점 선택 필요'}
                      . 주차 가능 여부와 혼잡은 미확인입니다.
                    </p>
                  </div>
                  <div>
                    <CloudRain />
                    <h3>비가 오면</h3>
                    <p>
                      {familyIndoor.map((p) => p.title).join(' 또는 ') ||
                        '실내 대체지를 추가 확인해야 합니다.'}
                    </p>
                    <small>실내 후보 · 운영시간 별도 확인</small>
                  </div>
                  <div>
                    <HeartHandshake />
                    <h3>따뜻한 한 끼</h3>
                    <p>
                      {meals.length
                        ? meals.map((p) => p.title).join(', ')
                        : '음식점 API 연결 후 실제 식사 후보를 표시합니다.'}
                    </p>
                    <small>
                      선호 {familyMeal} · 메뉴·알레르기 적합성 미검증
                    </small>
                  </div>
                </div>
                {familyMission && (
                  <>
                    <div className="brief-stops">
                      {familyMission.stops.map((x) => (
                        <span key={x.place.id}>
                          {x.place.title} <Source p={x.place} />
                        </span>
                      ))}
                    </div>
                    {familyMission.stops.reduce((a, b) => a + b.walk, 0) >
                      parseInt(familyWalk) && (
                      <p className="warning">
                        선택한 도보 상한을 초과합니다. 이 여행안은 조건에 맞지
                        않아 추가 조정이 필요합니다.
                      </p>
                    )}
                    <Button
                      disabled={!projected?.scopes.propose}
                      onClick={() => {
                        if (projected?.scopes.propose) {
                          setProposal(familyMission.title);
                          setNotice(
                            '가족의 미션 제안을 자녀 역할 화면에 남겼습니다.',
                          );
                        }
                      }}
                    >
                      자녀에게 이 미션 제안 <ArrowUpRight size={16} />
                    </Button>
                    {!projected?.scopes.propose && (
                      <p className="helper">
                        미션 제안 권한으로 초대 연결하면 제안을 남길 수
                        있습니다.
                      </p>
                    )}
                  </>
                )}
              </section>
            )}
            {brief && <WeatherCard region={familyRegion} />}
            {brief && (
              <section className="panel accessibility-panel">
                <span className="kicker">부모님과 출발하기 전</span>
                <h2>계단과 주차부터 확인해요.</h2>
                <p>
                  여행안과 비교할 수 있는 {familyRegion} 편의시설 정보입니다.
                  시설 안내가 있어도 전체 동선이 무장애라는 뜻은 아닙니다.
                </p>
                {access.mode === 'loading' && (
                  <p role="status">
                    한국관광공사 무장애 여행 정보를 확인하고 있어요.
                  </p>
                )}
                {access.mode === 'unavailable' && (
                  <p className="warning">
                    편의시설 정보를 연결하지 못했습니다. 시설에 직접 확인해
                    주세요.
                  </p>
                )}
                {access.mode === 'live' && (
                  <p className="helper">
                    무장애 목록 {access.total}곳 중 관광·문화시설{' '}
                    {access.items.length}곳 상세 확인 · 출처: ⓒ한국관광공사
                  </p>
                )}
                {access.items.map((item) => (
                  <details className="accessibility-item" key={item.place.id}>
                    <summary>
                      {item.place.title}
                      <span>주차·접근 동선 보기</span>
                    </summary>
                    <ApiFacts data={item} loading={false} />
                    <VerifiedFacts place={item.place} />
                    <a
                      className="source-link"
                      href={kakaoLink(item.place)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      장소 위치 확인 <ExternalLink size={13} />
                    </a>
                  </details>
                ))}
                {access.mode === 'live' && !access.items.length && (
                  <p>
                    조회된 관광·문화시설 상세 후보가 없습니다. 편의시설의 부재를
                    뜻하지 않습니다.
                  </p>
                )}
              </section>
            )}
            <div className="privacy-panel">
              <ShieldCheck />
              <p>
                부모 브리핑에는 정확한 복귀시각·좌표·군번·실명·부대 정보가
                공유되지 않습니다. 식단 온기카드는 현재 가족이 직접 선택한 식사
                선호만 사용합니다.
              </p>
            </div>
          </main>
        </TabsContent>
        <TabsContent value="passport">
          <main className="page-container">
            <div className="page-heading">
              <div>
                <span className="kicker">DEMILITARIZED PASSPORT</span>
                <h1>나의 비무장 패스포트</h1>
                <p>함께 다녀온 강원, 한 장씩 남겨요.</p>
              </div>
              <span className="passport-count">
                {entries.length.toString().padStart(2, '0')}{' '}
                <small>MISSIONS</small>
              </span>
            </div>
            <div className="two-columns">
              <section className="passport-cover">
                <BookOpen size={42} />
                <span>REPUBLIC OF OUR DAYS</span>
                <h2>
                  비무장
                  <br />
                  패스포트
                </h2>
                <div className="seal">
                  <Compass />
                  <b>GANGWON</b>
                  <small>평화 · 회복 · 동행</small>
                </div>
                <p>군번 대신, 우리의 여행을 기록합니다.</p>
              </section>
              <section className="panel">
                <h2>가족에게 여권 초대하기</h2>
                <p>허용한 정보만 부모님과 동행자에게 열어주세요.</p>
                <div className="demo-note">
                  같은 브라우저 전용 체험. 실제 가족 인증·다른 기기 공유는
                  연결되지 않았습니다.
                </div>
                {family ? (
                  <>
                    <div className="invite-code">
                      {family.code}
                      <button
                        onClick={() => copy(family.code)}
                        aria-label="초대코드 복사"
                      >
                        <Copy size={19} />
                      </button>
                    </div>
                    <p className="helper">
                      생성 후 24시간 유효 · 코드 재생성 시 이전 연결 해제
                    </p>
                    {(Object.keys(scopeLabels) as (keyof Scopes)[]).map((k) => (
                      <Toggle
                        key={k}
                        label={scopeLabels[k]}
                        checked={family.scopes[k]}
                        onChange={(v) =>
                          setFamily((f) =>
                            f
                              ? { ...f, scopes: { ...f.scopes, [k]: v } }
                              : null,
                          )
                        }
                      />
                    ))}
                    <div className="button-row">
                      <Button variant="outline" onClick={createInvite}>
                        코드 재생성
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setFamily(null);
                          setJoined('');
                          setNotice('초대와 가족 연결을 해제했습니다.');
                        }}
                      >
                        공유 해제
                      </Button>
                    </div>
                    <Button
                      className="primary-cta"
                      onClick={() => {
                        setInvite(family.code);
                        go('family');
                      }}
                    >
                      부모 역할로 연결 체험 <ArrowRight size={16} />
                    </Button>
                  </>
                ) : (
                  <Button className="primary-cta" onClick={createInvite}>
                    가족 초대코드 만들기 <ArrowUpRight size={16} />
                  </Button>
                )}
                {proposal && (
                  <div className="connection">
                    <b>가족이 제안한 미션</b>
                    <p>{proposal}</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const found = missions.find(
                          (m) => m.title === proposal,
                        );
                        if (found) {
                          setSelectedId(found.id);
                          go('planner');
                        } else {
                          setNotice(
                            '가족이 선택한 권역으로 변경해 미션을 검토해 주세요.',
                          );
                          go('planner');
                        }
                      }}
                    >
                      제안 검토하기
                    </Button>
                  </div>
                )}
              </section>
            </div>
            <div className="passport-chapters">
              {chapters.slice(0, 5).map((chapter, i) => (
                <section key={chapter} className="chapter-page">
                  <header>
                    <span>0{i + 1}</span>
                    <div>
                      <h2>{chapter}</h2>
                      <p>{chapterStories[i]}</p>
                    </div>
                    <Stamp size={26} />
                  </header>
                  {entries.filter((e) => e.region === regions[i]).length ? (
                    entries
                      .filter((e) => e.region === regions[i])
                      .map((e) => (
                        <div className="entry" key={e.missionId}>
                          <h3>{e.title}</h3>
                          <div className="stamp-row">
                            {['입경', '전환', '복귀', '동행'].map((s) => (
                              <button
                                key={s}
                                className={
                                  e.stamps.includes(s)
                                    ? 'stamp marked'
                                    : 'stamp'
                                }
                                onClick={() => addStamp(e.missionId, s)}
                              >
                                <Check size={15} />
                                {s}
                              </button>
                            ))}
                            {e.stamps.includes('휴가 씨앗') && (
                              <span className="stamp marked">휴가 씨앗</span>
                            )}
                          </div>
                          <p className="helper">
                            여행 후 직접 기록 · 공적 방문 인증이나 복귀 확인이
                            아닙니다.
                          </p>
                          <button
                            className="text-action"
                            onClick={() => setShared(e)}
                          >
                            개인정보 없는 공유 카드 만들기{' '}
                            <ArrowUpRight size={14} />
                          </button>
                        </div>
                      ))
                  ) : (
                    <div className="empty-chapter">
                      <span>아직 쓰지 않은 우리의 하루</span>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          change('region', regions[i]);
                          go('planner');
                        }}
                      >
                        이 장의 미션 찾기 <ArrowRight size={15} />
                      </Button>
                    </div>
                  )}
                </section>
              ))}
            </div>
            {shared && (
              <section className="panel share-panel">
                <span className="kicker">공개해도 좋은 여행 이야기</span>
                <h2>{shared.title}</h2>
                <p>
                  {shared.region}에서 남긴{' '}
                  {shared.stamps.join(' · ') || '여행 계획'}
                </p>
                <p>복무 경험을 관광 경험으로. 군번여지도 강원</p>
                <div className="button-row">
                  <Button onClick={() => downloadCard(shared)}>
                    <Download size={16} /> 공유 이미지 저장
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      copy(JSON.stringify(publicCard(shared), null, 2))
                    }
                  >
                    <Copy size={16} /> 공유 문구 복사
                  </Button>
                </div>
                <p className="helper">
                  정확한 시간·좌표·실명·군번·복귀시각·상세 경로를 포함하지
                  않습니다.
                </p>
              </section>
            )}
            <div className="privacy-panel">
              <LockKeyhole />
              <p>
                여권 기록은 이 기기의 브라우저에 저장됩니다. 브라우저 데이터를
                지우면 기록도 사라집니다.
              </p>
              {installPrompt && (
                <Button onClick={() => installPrompt.prompt()}>
                  홈 화면에 추가
                </Button>
              )}
            </div>
          </main>
        </TabsContent>
        <TabsContent value="radar">
          <main className="page-container">
            <div className="page-heading">
              <div>
                <span className="kicker">A SEED OF LEAVE</span>
                <h1>휴가회수 레이더</h1>
                <p>호국의 기억을 돌아보는 여행, 제도 확인을 위한 첫 준비.</p>
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
                <Button
                  className="primary-cta"
                  disabled={!radarChecks.every(Boolean) || !entries.length}
                  onClick={() => {
                    if (radarChecks.every(Boolean) && entries[0])
                      addStamp(entries[0].missionId, '휴가 씨앗');
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
                <span className="kicker">DATA, WITH CONTEXT</span>
                <h1>여행 판단의 근거를 공개합니다.</h1>
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
                  날씨·혼잡·교통·도보 시간은 가정값입니다. 보훈시설은 보상
                  가능성이 검증된 목록이 아닙니다.
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
      </footer>
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
