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
import type { Entry } from '@/lib/domain';
export default function TripCompletion({
  entry,
  onClose,
  onConfirm,
}: {
  entry: Entry;
  onClose: () => void;
  onConfirm: (stamps: string[]) => void;
}) {
  const [stamps, setStamps] = useState<string[]>(['입경', '복귀']);
  return (
    <AlertDialog open onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent className="trip-completion">
        <AlertDialogTitle>여행, 잘 다녀오셨나요?</AlertDialogTitle>
        <AlertDialogDescription>
          다녀온 여행이라면 기록으로 남겨요. 아래 스탬프는 직접 남기는 여행
          기록입니다.
        </AlertDialogDescription>
        <strong>{entry.title}</strong>
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
          <Button onClick={() => onConfirm(stamps)}>여행 완료로 기록</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
