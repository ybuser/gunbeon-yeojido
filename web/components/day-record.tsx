'use client';
import { Check } from 'lucide-react';
import { dayRecord } from '@/lib/day-passport';
import type { Entry, Place } from '@/lib/domain';
export default function DayRecord({
  entry,
  places,
  compact = false,
}: {
  entry: Entry;
  places: Place[];
  compact?: boolean;
}) {
  const record = dayRecord(entry, places);
  return (
    <div
      className={'day-record' + (compact ? ' compact' : '')}
      aria-label="하루의 한 장"
    >
      <div className="day-record-top">
        <span>군번여지도 강원</span>
        <span>{record.region}</span>
      </div>
      <span className="day-record-caption">하루의 한 장</span>
      <h2>{record.title}</h2>
      {record.places.length ? (
        <ol>
          {record.places.slice(0, 4).map((p) => (
            <li key={p.id}>
              <span />
              <span>{p.title}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p>
          {record.missingCount
            ? '다녀온 관광지 정보를 불러와야 해요.'
            : record.confirmed
              ? '장소 목록 없이 하루를 기록했어요.'
              : '이전 기록에는 다녀온 장소를 따로 남기지 않았어요.'}
        </p>
      )}
      {record.missingCount > 0 && (
        <p role="status">
          관광지 {record.missingCount}곳을 아직 불러오지 못했어요. 여행 정보에서
          다시 조회할 수 있습니다.
        </p>
      )}
      {record.places.length > 4 && (
        <small>함께 기록한 관광지 {record.places.length}곳 중 대표 4곳</small>
      )}
      <div className="day-record-stamps">
        {record.stamps.map((stamp) => (
          <span key={stamp}>
            <Check size={13} />
            {stamp}
          </span>
        ))}
      </div>
      {!compact && (
        <div className="day-record-footer">
          기다리던 하루를, 함께.<small>내가 직접 남긴 여행 기록</small>
        </div>
      )}
    </div>
  );
}
