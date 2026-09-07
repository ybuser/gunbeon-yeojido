'use client';
import { useEffect, useRef, useState } from 'react';
import type { Mission, Place } from '@/lib/domain';
import { validCoord } from '@/lib/domain';
type Point = { getLat: () => number; getLng: () => number };
type KMap = {
  setBounds: (b: unknown) => void;
  relayout: () => void;
  getCenter: () => Point;
  setCenter: (point: Point) => void;
};
type KakaoAPI = {
  load: (f: () => void) => void;
  Map: new (el: HTMLElement, opts: unknown) => KMap;
  LatLng: new (lat: number, lon: number) => Point;
  LatLngBounds: new () => { extend: (p: unknown) => void };
  Marker: new (opts: unknown) => {
    setMap: (map: KMap | null) => void;
    setPosition: (point: Point) => void;
  };
  event: {
    addListener: (
      target: unknown,
      event: string,
      handler: (e: { latLng: Point }) => void,
    ) => void;
    removeListener: (
      target: unknown,
      event: string,
      handler: (e: { latLng: Point }) => void,
    ) => void;
  };
  Polyline: new (opts: unknown) => unknown;
  CustomOverlay: new (opts: unknown) => { setMap: (map: KMap | null) => void };
};
declare global {
  interface Window {
    kakao?: { maps: KakaoAPI };
  }
}
export default function MissionMap({
  mission,
  origin,
  mapKey,
  onSelectPlace,
}: {
  mission: Mission;
  origin: Place;
  mapKey: string;
  onSelectPlace?: (place: Place) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const selectRef = useRef(onSelectPlace);
  useEffect(() => {
    selectRef.current = onSelectPlace;
  }, [onSelectPlace]);
  useEffect(() => {
    if (!mapKey || !ref.current) return;
    let canceled = false;
    let resize: ResizeObserver | undefined;
    const overlays: { setMap: (map: KMap | null) => void }[] = [];
    setReady(false);
    const draw = () => {
      window.kakao?.maps.load(() => {
        if (canceled || !ref.current || !window.kakao) return;
        try {
          const m = window.kakao.maps;
          const bounds = new m.LatLngBounds();
          const nodes = [origin, ...mission.stops.map((x) => x.place)]
            .filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i)
            .filter(validCoord);
          const pts = nodes.map((p) => new m.LatLng(p.lat!, p.lon!));
          if (!pts.length) return;
          const map = new m.Map(ref.current, { center: pts[0], level: 7 });
          pts.forEach((p, index) => {
            bounds.extend(p);
            const place = nodes[index];
            const number =
              mission.stops.findIndex((x) => x.place.id === place.id) + 1;
            const label = document.createElement('button');
            label.className =
              'map-place-pin' + (place.id === origin.id ? ' hub-pin' : '');
            label.textContent = number ? String(number) : '만남';
            const samePoint = nodes.filter(
              (n) =>
                Math.abs(n.lat! - place.lat!) < 0.00001 &&
                Math.abs(n.lon! - place.lon!) < 0.00001,
            );
            if (samePoint.length > 1)
              label.style.transform = `translateX(${(samePoint.findIndex((n) => n.id === place.id) - (samePoint.length - 1) / 2) * 50}px)`;
            label.setAttribute(
              'aria-label',
              (number ? number + '번 ' : '') + place.title + ' 방문 정보',
            );
            label.title =
              place.title + (place.id === origin.id ? ' · 만남 거점' : '');
            label.addEventListener('click', () => selectRef.current?.(place));
            const overlay = new m.CustomOverlay({
              position: p,
              content: label,
              yAnchor: 1,
              zIndex: 5,
            });
            overlay.setMap(map);
            overlays.push(overlay);
          });
          map.setBounds(bounds);
          resize = new ResizeObserver(() => {
            map.relayout();
            map.setBounds(bounds);
          });
          resize.observe(ref.current);
          setReady(true);
        } catch {
          setReady(false);
        }
      });
    };
    if (window.kakao) draw();
    else {
      let tag = document.getElementById(
        'kakao-sdk',
      ) as HTMLScriptElement | null;
      if (tag?.dataset.failed === 'true') {
        tag.remove();
        tag = null;
      }
      if (!tag) {
        tag = document.createElement('script');
        tag.id = 'kakao-sdk';
        tag.src =
          'https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=' +
          encodeURIComponent(mapKey);
        document.head.appendChild(tag);
      }
      tag.addEventListener('load', draw, { once: true });
      tag.addEventListener(
        'error',
        () => {
          if (tag) tag.dataset.failed = 'true';
        },
        { once: true },
      );
    }
    return () => {
      canceled = true;
      resize?.disconnect();
      overlays.forEach((x) => x.setMap(null));
    };
  }, [mapKey, mission, origin]);
  const places = [origin, ...mission.stops.map((s) => s.place)].filter(
    (p, i, a) => validCoord(p) && a.findIndex((x) => x.id === p.id) === i,
  );
  const lats = places.map((x) => x.lat!),
    lons = places.map((x) => x.lon!);
  const minLat = Math.min(...lats),
    minLon = Math.min(...lons),
    rangeLat = Math.max(...lats) - minLat || 0.02,
    rangeLon = Math.max(...lons) - minLon || 0.02;
  const pt = (p: Place) => ({
    x: 65 + ((p.lon! - minLon) / rangeLon) * 440,
    y: 275 - ((p.lat! - minLat) / rangeLat) * 205,
  });
  const path = [...places, ...(validCoord(origin) ? [origin] : [])]
    .map((p) => `${pt(p).x},${pt(p).y}`)
    .join(' ');
  return (
    <div className="map-wrap">
      <div
        ref={ref}
        className="kakao-map"
        style={{
          visibility: ready ? 'visible' : 'hidden',
          position: ready ? 'relative' : 'absolute',
        }}
      />
      {!ready && (
        <svg
          viewBox="0 0 580 360"
          role="img"
          aria-label="선택한 공개 거점과 미션 장소의 상대적 위치 개략도"
        >
          <defs>
            <pattern
              id="grid"
              width="36"
              height="36"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M36 0H0V36"
                fill="none"
                stroke="#e0e4e9"
                strokeWidth=".7"
              />
            </pattern>
          </defs>
          <rect width="580" height="360" fill="#f5f7fa" />
          <rect width="580" height="360" fill="url(#grid)" />
          <polyline
            points={path}
            fill="none"
            stroke="#77899f"
            strokeWidth="2"
            strokeDasharray="7 7"
          />
          {places.map((p, i) => {
            const { x, y } = pt(p);
            const number =
              mission.stops.findIndex((s) => s.place.id === p.id) + 1;
            return (
              <g key={i} transform={`translate(${x},${y})`}>
                <circle
                  r={i === 0 ? 17 : 14}
                  fill={i === 0 ? '#172f43' : '#2872df'}
                  stroke="white"
                  strokeWidth="3"
                />
                <text
                  textAnchor="middle"
                  y="5"
                  fill="white"
                  fontSize="14"
                  fontWeight="bold"
                >
                  {number || '만남'}
                </text>
                <rect
                  x={x > 390 ? -165 : 20}
                  y="-14"
                  width="142"
                  height="30"
                  rx="5"
                  fill="#ffffff"
                />
                <text
                  x={x > 390 ? -156 : 27}
                  y="6"
                  fontSize="12"
                  fill="#172f43"
                >
                  {p.title.slice(0, 12)}
                </text>
              </g>
            );
          })}
          <text x="27" y="32" fontSize="13" fill="#526075">
            N ↑
          </text>
          <text x="27" y="334" fontSize="12" fill="#526075">
            공개 관광장소 좌표 · 연결선은 실제 도로가 아닙니다
          </text>
        </svg>
      )}
      <span className="map-tag">
        {ready
          ? 'Kakao 지도 · 개별 장소 길찾기는 아래에서'
          : '위치 개략도 · 길찾기 지도 연결 전'}
      </span>
    </div>
  );
}
