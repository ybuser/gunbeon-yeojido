'use client';
import { useEffect, useState } from 'react';
import { CloudRain, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Settings } from '@/lib/domain';
type Forecast = {
  mode: string;
  condition?: Settings['weather'];
  maxRainProbability?: number | null;
  maxWindSpeed?: number | null;
  base_date?: string;
  base_time?: string;
  error?: string;
  coverageComplete?: boolean;
  missingTimes?: string[];
};
export default function WeatherCard({
  region,
  onApply,
}: {
  region: string;
  onApply?: (value: Settings['weather']) => void;
}) {
  const [forecast, setForecast] = useState<Forecast>({ mode: 'idle' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setForecast({ mode: 'loading' });
    fetch('/api/weather?region=' + encodeURIComponent(region), {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((data) => {
        if (!controller.signal.aborted) setForecast(data as Forecast);
      })
      .catch(() => {
        if (!controller.signal.aborted) setForecast({ mode: 'unavailable' });
      });
    return () => controller.abort();
  }, [region, revision]);
  return (
    <div className="weather-card">
      <div className="weather-title">
        <CloudRain size={19} />
        <b>{region} 출발 전 날씨</b>
        <button
          aria-label="날씨 다시 확인"
          onClick={() => setRevision((x) => x + 1)}
        >
          <RefreshCw size={15} />
        </button>
      </div>
      {forecast.mode === 'loading' ? (
        <p role="status">기상청 예보를 확인하고 있어요.</p>
      ) : forecast.mode !== 'live' ? (
        <p>
          예보를 연결하지 못했습니다. 현지 날씨를 확인한 뒤 여행 조건을 정해
          주세요.
        </p>
      ) : (
        <>
          <p>
            {forecast.coverageComplete ? '향후 8시간' : '수신한 시간대'} 최대
            강수확률 {forecast.maxRainProbability ?? '미제공'}
            {forecast.maxRainProbability == null ? '' : '%'} · 풍속{' '}
            {forecast.maxWindSpeed ?? '미제공'}
            {forecast.maxWindSpeed == null ? '' : 'm/s'}
          </p>
          <small>
            시군청 대표 격자 · {forecast.base_date}{' '}
            {forecast.base_time?.slice(0, 2)}시 발표 · 출처: 기상청
          </small>
          {!forecast.coverageComplete && (
            <p className="warning">
              8시간 예보 중 {forecast.missingTimes?.length ?? '일부'}개 시간대가
              불완전합니다. 날씨가 괜찮다고 판단할 수 없습니다.
            </p>
          )}
          {forecast.condition === 'snow' && (
            <p className="warning">
              눈 또는 비·눈 예보가 있습니다. 결빙과 도로 통제를 확인하세요.
            </p>
          )}
          {onApply && forecast.condition && (
            <Button
              variant="outline"
              onClick={() => onApply(forecast.condition!)}
            >
              이 예보를 시간 보정에 반영
            </Button>
          )}
        </>
      )}
      <small>
        개별 산·해안 날씨와 다를 수 있습니다. 비·강수확률 60% 이상 또는 풍속
        8m/s 이상에 앱의 보수적 버퍼를 적용하며, 기상특보 판정이 아닙니다.
      </small>
    </div>
  );
}
