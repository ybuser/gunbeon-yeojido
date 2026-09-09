'use client';
import { useEffect, useRef, useState } from 'react';
import type { Mission, Place } from '@/lib/domain';
import { validCoord } from '@/lib/domain';
import { loadKakaoMaps, type KMap, type KakaoAPI } from '@/lib/kakao-maps';
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
  const instance = useRef<{ map: KMap; api: KakaoAPI } | null>(null);
  const [ready, setReady] = useState(false);
  const selectRef = useRef(onSelectPlace);
  selectRef.current = onSelectPlace;
  const places = [origin, ...mission.stops.map((s) => s.place)].filter(
    (p, i, all) => validCoord(p) && all.findIndex((x) => x.id === p.id) === i,
  );
  const latest = useRef({ places, mission, origin });
  latest.current = { places, mission, origin };
  const hasCoordinates = places.length > 0;
  const geometry = JSON.stringify([
    origin.id,
    places.map((p) => [p.id, p.lat, p.lon, p.title]),
    mission.stops.map((s) => s.place.id),
  ]);
  useEffect(() => {
    if (!mapKey || !ref.current || !hasCoordinates) return;
    let canceled = false;
    let resize: ResizeObserver | undefined;
    setReady(false);
    loadKakaoMaps(mapKey)
      .then((api) => {
        if (canceled || !ref.current) return;
        const first = latest.current.places[0];
        if (!first) return;
        const map = new api.Map(ref.current, {
          center: new api.LatLng(first.lat!, first.lon!),
          level: 7,
        });
        instance.current = { map, api };
        resize = new ResizeObserver(() => {
          const center = map.getCenter();
          map.relayout();
          map.setCenter(center);
        });
        resize.observe(ref.current);
        setReady(true);
      })
      .catch(() => {
        if (!canceled) setReady(false);
      });
    return () => {
      canceled = true;
      resize?.disconnect();
      instance.current = null;
    };
  }, [mapKey, hasCoordinates]);
  useEffect(() => {
    if (!ready || !instance.current) return;
    const { map, api } = instance.current;
    const { places: nodes, mission: trip, origin: hub } = latest.current;
    const bounds = new api.LatLngBounds();
    const overlays = nodes.map((place) => {
      const point = new api.LatLng(place.lat!, place.lon!);
      bounds.extend(point);
      const number = trip.stops.findIndex((s) => s.place.id === place.id) + 1;
      const label = document.createElement('button');
      label.type = 'button';
      label.className =
        'map-place-pin' + (place.id === hub.id ? ' hub-pin' : '');
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
      label.title = place.title + (place.id === hub.id ? ' · 만남 거점' : '');
      label.addEventListener('click', () =>
        selectRef.current?.(
          latest.current.places.find((p) => p.id === place.id) || place,
        ),
      );
      const overlay = new api.CustomOverlay({
        position: point,
        content: label,
        yAnchor: 1,
        zIndex: 5,
      });
      overlay.setMap(map);
      return overlay;
    });
    if (nodes.length) map.setBounds(bounds);
    return () => overlays.forEach((overlay) => overlay.setMap(null));
  }, [geometry, ready]);
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
