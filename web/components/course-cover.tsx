'use client';
import MemoryImage from './memory-image';
import { useState } from 'react';
import { MapPin } from 'lucide-react';
import type { Place } from '@/lib/domain';
function Tile({
  place,
  index,
  eager,
}: {
  place: Pick<Place, 'id' | 'title' | 'image_url'>;
  index: number;
  eager: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="course-cover-tile">
      {place.image_url && !failed ? (
        <MemoryImage
          src={place.image_url}
          alt={`${index + 1}. ${place.title}`}
          loading={eager ? 'eager' : 'lazy'}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="course-cover-missing">
          <MapPin size={22} />
          <span>{place.title}</span>
        </span>
      )}
      <span className="course-cover-number">{index + 1}</span>
    </span>
  );
}
export default function CourseCover({
  places,
  eager = false,
}: {
  places: Pick<Place, 'id' | 'title' | 'image_url'>[];
  eager?: boolean;
}) {
  const unique = places.filter(
    (p, i, list) => list.findIndex((v) => v.id === p.id) === i,
  );
  const tiles = unique.slice(0, 4);
  return (
    <span
      className={`course-cover tiles-${tiles.length || 1}`}
      aria-label={`${unique.length}곳으로 구성된 코스 표지`}
    >
      {tiles.length ? (
        tiles.map((p, i) => (
          <Tile key={p.id + p.image_url} place={p} index={i} eager={eager} />
        ))
      ) : (
        <span className="course-cover-missing">
          <MapPin />
          <span>장소를 담아보세요</span>
        </span>
      )}
      <span className="course-cover-count">
        {unique.length}곳{unique.length > 4 ? ' · 대표 4곳' : ''}
      </span>
    </span>
  );
}
