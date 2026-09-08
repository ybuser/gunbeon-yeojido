'use client';
import { useState } from 'react';
import { Star, MapPin, Plus, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PublicPlacePicker from './public-place-picker';
import {
  manualToPlace,
  validManualPlace,
  validCoord,
  type ManualPlace,
  type Place,
} from '@/lib/domain';

export function FavoritePlaces({
  favorites,
  onChoose,
  onRemove,
  onEdit,
}: {
  favorites: ManualPlace[];
  onChoose: (p: Place) => void;
  onRemove?: (id: string) => void;
  onEdit?: (p: ManualPlace) => void;
}) {
  return (
    <div className="favorite-places">
      {favorites.map((p) => (
        <article key={p.id} className="favorite-place">
          <button
            className="favorite-choose"
            onClick={() => onChoose(manualToPlace(p))}
          >
            <Star size={19} />
            <span>
              <strong>{p.title}</strong>
              <small>
                {p.address ||
                  (p.lat === null ? '위치는 나중에 설정' : '내가 지정한 위치')}
              </small>
            </span>
          </button>
          {onEdit && (
            <button
              aria-label={p.title + ' 즐겨찾기 수정'}
              onClick={() => onEdit(p)}
            >
              <Pencil size={17} />
            </button>
          )}
          {onRemove && (
            <button
              aria-label={p.title + ' 즐겨찾기 삭제'}
              onClick={() => onRemove(p.id)}
            >
              <Trash2 size={17} />
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
export default function MeetingPicker({
  favorites,
  onFavoritesChange,
  onChoose,
  region,
  mapKey,
  center,
}: {
  favorites: ManualPlace[];
  onFavoritesChange: (places: ManualPlace[]) => void;
  onChoose: (p: Place) => void;
  region: string;
  mapKey: string;
  center?: { lat: number; lon: number };
}) {
  const [form, setForm] = useState<ManualPlace | null>(null);
  const [saveFavorite, setSaveFavorite] = useState(false);
  const [error, setError] = useState('');
  function begin(favorite: boolean, existing?: ManualPlace) {
    setError('');
    setSaveFavorite(favorite);
    setForm(
      existing || {
        id: 'manual:' + crypto.randomUUID(),
        title: '',
        address: '',
        lat: null,
        lon: null,
        sigungu: region,
        category: 'other',
      },
    );
  }
  if (form)
    return (
      <div className="meeting-picker meeting-form">
        <button
          className="text-action"
          onClick={() => {
            setForm(null);
            setError('');
          }}
        >
          ← 즐겨찾기로 돌아가기
        </button>
        <h3>{saveFavorite ? '즐겨찾는 장소 설정' : '만나는 장소 직접 설정'}</h3>
        <label className="builder-field">
          장소 이름
          <Input
            aria-label="만남 장소 이름"
            value={form.title}
            placeholder="예: 늘 만나는 정문 앞"
            maxLength={60}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>
        <PublicPlacePicker
          mapKey={mapKey}
          region={region}
          center={center}
          value={
            form.lat !== null && form.lon !== null
              ? { lat: form.lat, lon: form.lon }
              : null
          }
          onChange={(v) => setForm({ ...form, ...v })}
        />
        <label className="builder-field">
          주소 또는 만날 지점 · 선택
          <Input
            aria-label="만남 장소 설명"
            value={form.address}
            maxLength={160}
            placeholder="예: 정문 맞은편 버스 정류장"
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </label>
        <p className="helper">
          이 브라우저에만 보관합니다. 가족·공개 공유 카드에는 이 장소가 표시되지
          않아요.
        </p>
        {error && (
          <p role="alert" className="builder-notice">
            {error}
          </p>
        )}
        <Button
          className="primary-cta"
          onClick={() => {
            if (!validManualPlace(form) || !validCoord(manualToPlace(form))) {
              setError('장소 이름을 입력하고 지도에서 위치를 골라주세요.');
              return;
            }
            if (saveFavorite)
              onFavoritesChange([
                ...favorites.filter((p) => p.id !== form.id),
                form,
              ]);
            onChoose(manualToPlace(form));
            setForm(null);
          }}
        >
          {saveFavorite ? '즐겨찾기에 저장하고 선택' : '이 위치로 설정'}
        </Button>
      </div>
    );
  return (
    <div className="meeting-picker">
      <div className="meeting-heading">
        <Star size={20} />
        <h3>즐겨찾는 장소</h3>
      </div>
      {favorites.length ? (
        <FavoritePlaces
          favorites={favorites}
          onChoose={onChoose}
          onEdit={(p) => begin(true, p)}
          onRemove={(id) =>
            onFavoritesChange(favorites.filter((p) => p.id !== id))
          }
        />
      ) : (
        <div className="meeting-empty">
          <MapPin size={30} />
          <strong>자주 만나는 곳을 저장해 두세요</strong>
          <p>다음 계획에서도 바로 고를 수 있어요.</p>
        </div>
      )}
      <div className="meeting-actions">
        <Button onClick={() => begin(true)}>
          <Plus size={17} />
          즐겨찾기 추가하기
        </Button>
        <Button variant="outline" onClick={() => begin(false)}>
          직접 설정하기
        </Button>
      </div>
    </div>
  );
}
