'use client';
import { useEffect, useRef, useState } from 'react';
import type { Mission, Place } from '@/lib/domain';
import { validCoord } from '@/lib/domain';
type KMap = { setBounds: (b: unknown) => void };
type KakaoAPI = {
  load: (f: () => void) => void;
  Map: new (el: HTMLElement, opts: unknown) => KMap;
  LatLng: new (lat: number, lon: number) => unknown;
  LatLngBounds: new () => { extend: (p: unknown) => void };
  Marker: new (opts: unknown) => unknown;
  Polyline: new (opts: unknown) => unknown;
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
}: {
  mission: Mission;
  origin: Place;
  mapKey: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!mapKey || !ref.current) return;
    let canceled = false;
    setReady(false);
    const draw = () => {
      window.kakao?.maps.load(() => {
        if (canceled || !ref.current || !window.kakao) return;
        try {
          const m = window.kakao.maps;
          const bounds = new m.LatLngBounds();
          const pts = [origin, ...mission.stops.map((x) => x.place)]
            .filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i)
            .filter(validCoord)
            .map((p) => new m.LatLng(p.lat!, p.lon!));
          const map = new m.Map(ref.current, { center: pts[0], level: 7 });
          pts.forEach((p) => {
            bounds.extend(p);
            new m.Marker({ map, position: p });
          });
          map.setBounds(bounds);
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
      if (!tag) {
        tag = document.createElement('script');
        tag.id = 'kakao-sdk';
        tag.src =
          'https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=' +
          encodeURIComponent(mapKey);
        document.head.appendChild(tag);
      }
      tag.addEventListener('load', draw, { once: true });
    }
    return () => {
      canceled = true;
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
  const path = [...places, origin]
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
                stroke="#cbd6cb"
                strokeWidth=".7"
              />
            </pattern>
          </defs>
          <rect width="580" height="360" fill="#e3eadf" />
          <rect width="580" height="360" fill="url(#grid)" />
          <polyline
            points={path}
            fill="none"
            stroke="#507c73"
            strokeWidth="2"
            strokeDasharray="7 7"
          />
          {places.map((p, i) => {
            const { x, y } = pt(p);
            return (
              <g key={i} transform={`translate(${x},${y})`}>
                <circle
                  r={i === 0 ? 17 : 14}
                  fill={i === 0 ? '#172f43' : '#447c9d'}
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
                  {i === 0 ? '출' : i}
                </text>
                <rect
                  x={x > 390 ? -165 : 20}
                  y="-14"
                  width="142"
                  height="30"
                  rx="5"
                  fill="#fffef9"
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
          <text x="27" y="32" fontSize="13" fill="#536958">
            N ↑
          </text>
          <text x="27" y="334" fontSize="12" fill="#536958">
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
