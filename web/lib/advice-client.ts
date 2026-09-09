import {
  adviceQuestions,
  type AdviceDetail,
  type AdviceSnapshot,
  type PublicPlace,
} from './advice-model';
export async function adviceRequest<T = Record<string, unknown>>(
  path: string,
  body?: unknown,
): Promise<T> {
  const r = await fetch(
    path,
    body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : { cache: 'no-store' },
  );
  const data = (await r.json()) as Record<string, unknown>;
  if (!r.ok)
    throw Object.assign(
      new Error(
        typeof data.message === 'string'
          ? data.message
          : '연결을 확인하고 다시 시도해 주세요.',
      ),
      { status: r.status },
    );
  return data as T;
}
export async function downloadAdviceCard(
  snapshot: AdviceSnapshot,
  places: PublicPlace[],
  url: string,
) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1600;
  const c = canvas.getContext('2d');
  if (!c)
    throw new Error(
      '이 브라우저에서 이미지를 저장할 수 없어요. 링크를 복사해 주세요.',
    );
  await document.fonts.ready;
  c.fillStyle = '#f5f3ee';
  c.fillRect(0, 0, 1080, 1600);
  c.fillStyle = '#152e43';
  c.font = '600 32px sans-serif';
  c.fillText('군번여지도  /  한 수 보태기', 80, 115);
  c.fillStyle = '#2964d7';
  c.font = '600 28px sans-serif';
  c.fillText(snapshot.region.replace(/[군시]$/, '') + '에서의 하루', 80, 250);
  c.fillStyle = '#152e43';
  c.font = '700 62px sans-serif';
  const text = adviceQuestions[snapshot.question];
  let line = '',
    y = 350;
  for (const char of text) {
    if (c.measureText(line + char).width > 900) {
      c.fillText(line, 80, y);
      y += 85;
      line = '';
    }
    line += char;
  }
  c.fillText(line, 80, y);
  y += 110;
  const selected = snapshot.placeIds.slice(0, 6);
  for (let i = 0; i < selected.length; i++) {
    c.fillStyle = 'white';
    c.fillRect(80, y, 920, 100);
    c.fillStyle = '#2964d7';
    c.font = '600 30px sans-serif';
    c.fillText(String(i + 1).padStart(2, '0'), 110, y + 62);
    c.fillStyle = '#152e43';
    c.font = '500 34px sans-serif';
    let name =
      places.find((p) => p.id === selected[i])?.title || '관광정보 조회 대기';
    while (c.measureText(name).width > 730) name = name.slice(0, -2) + '…';
    c.fillText(name, 185, y + 62);
    y += 117;
  }
  c.fillStyle = '#152e43';
  c.font = '600 34px sans-serif';
  c.fillText('너라면, 어느 한 곳을 바꿀래?', 80, 1420);
  c.fillStyle = '#536779';
  c.font = '400 24px sans-serif';
  c.fillText('스토리에 링크 스티커를 붙여 한 수를 받아보세요.', 80, 1470);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  if (!blob) throw new Error('이미지를 만들지 못했어요.');
  const src = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = src;
  a.download = '군번여지도-한수보태기.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(src), 30000);
}
export function adviceLabel(
  s: AdviceDetail['suggestions'][number],
  places: PublicPlace[],
) {
  const title = (id: string | null) =>
    places.find((p) => p.id === id)?.title || '관광정보 조회 대기';
  return s.kind === 'remove'
    ? title(s.targetId) + '은 다음 기회에'
    : s.kind === 'replace'
      ? title(s.targetId) + ' 대신 ' + title(s.placeId)
      : title(s.targetId) + ' 다음에 ' + title(s.placeId);
}
