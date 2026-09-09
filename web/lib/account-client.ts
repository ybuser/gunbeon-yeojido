import { cleanTravelState, type TravelState } from './account-state.ts';
import type { Entry } from './domain';
export type AccountInfo = {
  id: string;
  nickname: string;
  handle: string | null;
};
export type AccountStatus = {
  account: AccountInfo | null;
  providers: { google: boolean; naver: boolean };
  linked: string[];
};
export const GUEST_STORAGE = 'gangwon-passport-v1';
let identity: AccountInfo | null = null,
  initialized = false,
  revision = 0,
  persisted = '',
  current: any = null;
let queue: Promise<void> = Promise.resolve(),
  blocked = false,
  status = 'loading';
let expectedIdentity: string | undefined;
export const bindAccountContext = (id: string | null) => {
  expectedIdentity = id || 'guest';
};
export const accountContextHeaders = (): Record<string, string> =>
  expectedIdentity ? { 'X-Gunbeon-Account': expectedIdentity } : {};
const listeners = new Set<() => void>();
const changeStatus = (s: string) => {
  status = s;
  listeners.forEach((f) => f());
};
export const subscribeTravelSave = (f: () => void) => {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
};
export const travelSaveStatus = () => status;
export const serverSaveStatus = () => 'loading';
export async function accountRequest<T>(
  path: string,
  body?: unknown,
): Promise<T> {
  const r = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    cache: 'no-store',
    headers: {
      ...accountContextHeaders(),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await r.json()) as T & { message?: string };
  if (!r.ok)
    throw Object.assign(
      new Error(data.message || '저장 서버에 연결하지 못했어요.'),
      { status: r.status },
    );
  return data;
}
export async function initializeTravelStorage() {
  const session = await accountRequest<AccountStatus>('/api/account');
  identity = session.account;
  bindAccountContext(identity?.id || null);
  let saved;
  if (identity) {
    const data = await accountRequest<{
      state: TravelState | null;
      revision: number;
    }>('/api/account/state');
    saved = data.state;
    revision = data.revision;
    persisted = saved ? JSON.stringify(cleanTravelState(saved)) : '';
  } else {
    try {
      saved = JSON.parse(localStorage.getItem(GUEST_STORAGE) || 'null');
    } catch {
      throw new Error(
        '이 기기의 기록을 읽지 못했어요. 원본을 보존한 채 다시 시도해 주세요.',
      );
    }
  }
  initialized = true;
  blocked = false;
  current = saved;
  changeStatus(identity ? 'saved' : 'guest');
  return { saved, account: identity };
}
export function saveTravelStorage(value: unknown): Promise<void> {
  if (!initialized)
    return Promise.reject(new Error('여행 기록을 먼저 불러와 주세요.'));
  const data = identity ? cleanTravelState(value) : value;
  current = data;
  const json = JSON.stringify(data);
  if (!identity) {
    try {
      localStorage.setItem(GUEST_STORAGE, json);
      changeStatus('guest');
      return Promise.resolve();
    } catch {
      changeStatus('error');
      return Promise.reject(
        new Error('이 기기에서 저장하지 못했어요. 현재 내용을 백업해 주세요.'),
      );
    }
  }
  if (blocked)
    return Promise.reject(
      new Error(
        status === 'conflict'
          ? '다른 기기에서 수정된 기록이 있어요. 현재 내용을 백업한 뒤 최신 기록을 불러와 주세요.'
          : '서버에 저장하지 못했어요. 내 계정 옆 저장 상태에서 다시 시도해 주세요.',
      ),
    );
  changeStatus('saving');
  const task = queue.then(async () => {
    if (blocked) throw new Error('서버 저장을 다시 시도해 주세요.');
    if (json === persisted) return;
    try {
      const r = await accountRequest<{ revision: number }>(
        '/api/account/state',
        { revision, state: data },
      );
      revision = r.revision;
      persisted = json;
    } catch (e) {
      blocked = true;
      changeStatus(
        (e as { status?: number }).status === 409 ? 'conflict' : 'error',
      );
      throw e;
    }
  });
  queue = task.catch(() => {});
  task.then(
    () => {
      if (!blocked && JSON.stringify(current) === persisted)
        changeStatus('saved');
    },
    () => {},
  );
  return task;
}
export function retryTravelSave() {
  if (status === 'conflict')
    return Promise.reject(
      new Error(
        '다른 기기의 기록을 덮어쓰지 않도록 최신 기록을 먼저 불러와 주세요.',
      ),
    );
  blocked = false;
  return saveTravelStorage(current);
}
export function currentTravelDraft() {
  return current;
}
export async function saveTravelEntries(entries: Entry[]) {
  await saveTravelStorage({ ...current, version: 3, entries });
}
export async function durableTravelEntry(
  key: string,
): Promise<Entry | undefined> {
  if (identity) {
    await queue;
    const data = await accountRequest<{ state: TravelState | null }>(
      '/api/account/state',
    );
    return data.state?.entries.find((e) => (e.recordId || e.missionId) === key);
  }
  return JSON.parse(localStorage.getItem(GUEST_STORAGE) || '{}').entries?.find(
    (e: Entry) => (e.recordId || e.missionId) === key,
  );
}
export function downloadTravelBackup(value: unknown = current) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = '군번여지도-개인여행-백업.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
