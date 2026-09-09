'use client';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { sensitivePlaceText, type Entry, type Place } from '@/lib/domain';
export default function TripCompletion({
  entry,
  places,
  onClose,
  onConfirm,
}: {
  entry: Entry;
  places: Place[];
  onClose: () => void;
  onConfirm: (stamps: string[], visitedPlaceIds: string[]) => void;
}) {
  const [stamps, setStamps] = useState<string[]>(['입경', '복귀']);
  const [visited, setVisited] = useState<string[]>([]);
  const [withoutPlaces, setWithoutPlaces] = useState(false);
  const candidates = (entry.plan?.stops || []).flatMap((stop) => {
    const place = places.find(
      (p) =>
        p.id === stop.placeId &&
        p.source !== 'manual' &&
        !p.id.startsWith('manual:') &&
        !sensitivePlaceText(p.title),
    );
    return place ? [place] : [];
  });
  return (
    <AlertDialog open onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent className="trip-completion">
        <AlertDialogTitle>여행, 잘 다녀오셨나요?</AlertDialogTitle>
        <AlertDialogDescription>
          다녀온 여행이라면 기록으로 남겨요. 아래 스탬프는 직접 남기는 여행
          기록입니다.
        </AlertDialogDescription>
        <strong>{entry.title}</strong>
        <fieldset className="completion-places">
          <legend>실제로 다녀온 관광지를 골라주세요</legend>
          {candidates.map((place) => (
            <label key={place.id}>
              <Checkbox
                checked={visited.includes(place.id)}
                onCheckedChange={(checked) => {
                  setWithoutPlaces(false);
                  setVisited((v) =>
                    checked
                      ? [...v, place.id]
                      : v.filter((id) => id !== place.id),
                  );
                }}
              />
              <span>{place.title}</span>
            </label>
          ))}
          <p>
            직접 지정한 만남 장소는 공개 기록에 넣지 않아요. 조회되지 않은
            관광지는 이번 카드에서 제외합니다.
          </p>
          <label>
            <Checkbox
              checked={withoutPlaces}
              onCheckedChange={(checked) => {
                setWithoutPlaces(Boolean(checked));
                if (checked) setVisited([]);
              }}
            />
            <span>장소 목록 없이 하루만 기록할게요</span>
          </label>
        </fieldset>
        <div className="completion-stamps">
          {[
            ['입경', '강원에서 하루를 시작했어요'],
            ['전환', '새로운 풍경을 만났어요'],
            ['복귀', '여행을 마치고 돌아왔어요'],
            ['동행', '소중한 사람과 함께했어요'],
          ].map(([name, description]) => (
            <label key={name}>
              <Checkbox
                checked={stamps.includes(name)}
                onCheckedChange={(v) =>
                  setStamps((s) =>
                    v ? [...s, name] : s.filter((x) => x !== name),
                  )
                }
              />
              <span>
                <b>{name}</b>
                <small>{description}</small>
              </span>
            </label>
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>아직 다녀오기 전이에요</AlertDialogCancel>
          <Button
            disabled={!visited.length && !withoutPlaces}
            onClick={() => onConfirm(stamps, visited)}
          >
            여행 완료로 기록
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
