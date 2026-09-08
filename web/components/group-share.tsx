'use client';
import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from './ui/sheet';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { entryKey } from '@/lib/domain';
import type { Entry } from '@/lib/domain';
import { sharePlan } from '@/lib/group-model';
import type { GroupSummary, GroupPlan } from '@/lib/group-model';
export default function GroupShare({
  entries,
  groups,
  entry,
  groupId,
  record,
  onClose,
  onSave,
}: {
  entries: Entry[];
  groups: GroupSummary[];
  entry?: Entry;
  groupId?: string;
  record?: GroupPlan;
  onClose: () => void;
  onSave: (
    g: string,
    p: ReturnType<typeof sharePlan>,
    record?: GroupPlan,
  ) => Promise<void>;
}) {
  const [selected, setSelected] = useState(
      entry
        ? entryKey(entry)
        : entries.find((e) => e.plan)
          ? entryKey(entries.find((e) => e.plan)!)
          : '',
    ),
    [group, setGroup] = useState(groupId || groups[0]?.id || '');
  const [manual, setManual] = useState(
      Boolean(record?.plan.manualPlaces.length),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [conflict, setConflict] = useState(false);
  const e = entry || entries.find((e) => entryKey(e) === selected),
    count = e?.plan?.manualPlaces?.length || 0;
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <SheetContent side="bottom" className="group-share-sheet">
        <SheetHeader>
          <SheetTitle>
            {record ? '그룹 여행 변경사항 저장' : '그룹에 여행 공유'}
          </SheetTitle>
          <SheetDescription>
            출발 예정 시각과 장소 순서를 함께 봅니다.
          </SheetDescription>
        </SheetHeader>
        <div className="editor-body">
          {!entry && (
            <label className="field">
              가져올 내 여행
              <select
                value={selected}
                onChange={(v) => setSelected(v.target.value)}
              >
                <option value="">여행을 선택하세요</option>
                {entries
                  .filter((e) => e.plan)
                  .map((e) => (
                    <option key={entryKey(e)} value={entryKey(e)}>
                      {e.title}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {entry && <h3>{entry.title}</h3>}
          <label className="field">
            공유할 그룹
            <select
              value={group}
              onChange={(v) => setGroup(v.target.value)}
              disabled={!!record}
            >
              <option value="">그룹을 선택하세요</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <p className="helper">
            그룹 멤버가 이 일정을 보고 수정할 수 있습니다. 개인 복귀 기준시각,
            현재 출타 진행 상태와 스탬프는 포함하지 않습니다.
          </p>
          {count > 0 && (
            <label className="scope-check">
              <Checkbox
                checked={manual}
                onCheckedChange={(v) => setManual(!!v)}
              />
              <span>
                <strong>직접 지정한 장소도 공유</strong>
                <small>
                  만남 장소를 포함한 개인 장소 {count}개의 이름·주소·선택 좌표를
                  공유합니다.
                </small>
              </span>
            </label>
          )}
          {error && (
            <p className="warning" role="alert">
              {error}
            </p>
          )}
          {conflict && (
            <Button
              variant="outline"
              disabled={busy || !e}
              onClick={async () => {
                if (!e) return;
                setBusy(true);
                try {
                  await onSave(
                    group,
                    sharePlan(
                      { ...e, title: e.title.slice(0, 54) + ' (사본)' },
                      manual,
                    ),
                  );
                } catch (ex) {
                  setError((ex as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              내 변경사항을 새 여행으로 저장
            </Button>
          )}
          <div className="group-card-buttons">
            <Button variant="outline" disabled={busy} onClick={onClose}>
              취소
            </Button>
            <Button
              disabled={busy || !e || !group}
              onClick={async () => {
                if (!e) return;
                setBusy(true);
                setError('');
                try {
                  await onSave(group, sharePlan(e, manual), record);
                } catch (ex) {
                  setError((ex as Error).message);
                  setConflict((ex as { status?: number }).status === 409);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? '저장 중…' : record ? '변경사항 공유' : '이 그룹에 공유'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
