'use client';
import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {} from './mission-map';
type Value = { lat: number; lon: number };
export default function PublicPlacePicker({
  mapKey,
  region,
  value,
  center,
  onChange,
}: {
  mapKey: string;
  region: string;
  value: Value | null;
  center?: Value;
  onChange: (v: Value) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const callback = useRef(onChange);
  const updateMarker = useRef<(v: Value | null) => void>(() => {});
  const chooseCenter = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => {
    updateMarker.current(value);
    if (!value) setMessage('');
  }, [value]);
  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);
  useEffect(() => {
    if (!mapKey || !element.current || (!center && !value)) return;
    let disposed = false;
    let cleanup = () => {};
    const draw = () =>
      window.kakao?.maps.load(() => {
        if (disposed || !element.current || !window.kakao) return;
        const api = window.kakao.maps,
          start = value || center!;
        try {
          const map = new api.Map(element.current, {
            center: new api.LatLng(start.lat, start.lon),
            level: 5,
          });
          const marker = new api.Marker({
            position: new api.LatLng(start.lat, start.lon),
          });
          updateMarker.current = (v) => {
            if (v) {
              marker.setPosition(new api.LatLng(v.lat, v.lon));
              marker.setMap(map);
            } else marker.setMap(null);
          };
          updateMarker.current(value);
          const select = (event: {
            latLng: { getLat: () => number; getLng: () => number };
          }) => {
            const lat = event.latLng.getLat(),
              lon = event.latLng.getLng();
            if (lat <= 33 || lat >= 39.5 || lon <= 124 || lon >= 132) {
              setMessage('국내 지도에서 만날 위치를 골라주세요.');
              return;
            }
            marker.setPosition(new api.LatLng(lat, lon));
            marker.setMap(map);
            setMessage('위치를 선택했습니다.');
            callback.current({ lat, lon });
          };
          api.event.addListener(map, 'click', select);
          chooseCenter.current = () => select({ latLng: map.getCenter() });
          const resize = new ResizeObserver(() => map.relayout());
          resize.observe(element.current);
          setReady(true);
          cleanup = () => {
            updateMarker.current = () => {};
            resize.disconnect();
            api.event.removeListener(map, 'click', select);
            marker.setMap(null);
          };
        } catch {
          setMessage(
            '지도를 연결하지 못했습니다. 위치 없이 먼저 추가할 수 있어요.',
          );
        }
      });
    if (window.kakao) draw();
    else {
      let script = document.getElementById(
        'kakao-sdk',
      ) as HTMLScriptElement | null;
      if (script?.dataset.failed === 'true') {
        script.remove();
        script = null;
      }
      if (!script) {
        script = document.createElement('script');
        script.id = 'kakao-sdk';
        script.src =
          'https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=' +
          encodeURIComponent(mapKey);
        document.head.appendChild(script);
      }
      script.addEventListener('load', draw, { once: true });
      script.addEventListener(
        'error',
        () => {
          if (script) script.dataset.failed = 'true';
          setMessage('지도를 연결하지 못했습니다. 위치 없이 추가할 수 있어요.');
        },
        { once: true },
      );
    }
    return () => {
      disposed = true;
      cleanup();
    };
  }, [mapKey, region]);
  return (
    <div className="public-place-picker">
      <div
        ref={element}
        className="public-pick-map"
        aria-label="장소 위치 선택 지도"
        data-ready={ready}
      />
      {!ready && (
        <p>
          <MapPin size={18} />
          {!mapKey
            ? '지도 연결 전 · 장소 이름과 주소로 먼저 추가할 수 있어요.'
            : !center && !value
              ? '위치가 확인된 만남 거점을 고르면 지도를 사용할 수 있어요.'
              : message || '지도를 불러오고 있어요.'}
        </p>
      )}
      {ready && (
        <Button variant="outline" onClick={() => chooseCenter.current()}>
          지도 중심을 이 장소로 선택
        </Button>
      )}
      <p role="status">{message}</p>
    </div>
  );
}
