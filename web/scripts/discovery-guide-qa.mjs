import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const base = process.env.QA_BASE_URL || 'http://localhost:3000';
const out = path.resolve(
  process.env.QA_OUT_DIR ||
    path.resolve(import.meta.dirname, '../../tmp/qa/usage-guide'),
);
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({
  viewport: { width: 430, height: 932 },
  isMobile: true,
  hasTouch: true,
  locale: 'ko-KR',
  timezoneId: 'Asia/Seoul',
  reducedMotion: 'reduce',
});
await ctx.route('**/api/places?*', (r) =>
  r.fulfill({
    status: 503,
    json: { mode: 'unavailable', places: [], error: 'DAILY_QUOTA_EXCEEDED' },
  }),
);
const p = await ctx.newPage();
p.setDefaultTimeout(30000);
await p.clock.install({ time: new Date('2026-10-03T10:00:00+09:00') });
const report = {
  base,
  startedAt: new Date().toISOString(),
  browser: 'Chrome',
  viewport: '430×932 touch emulation',
  tourApi: 'isolated quota response',
  kakao: 'real SDK',
  checks: [],
  screenshots: [],
  errors: [],
  status: 'running',
};
p.on('pageerror', (e) =>
  report.errors.push(
    e.message.replace(/([?&](?:appkey|serviceKey)=)[^&\s]+/gi, '$1[redacted]'),
  ),
);
const tab = (name) => p.getByRole('tab', { name, exact: true });
async function shot(name) {
  const toast = p.getByRole('button', { name: '알림 닫기', exact: true });
  if (await toast.count()) await toast.click();
  await p
    .waitForFunction(
      () =>
        [...document.images]
          .filter((i) => {
            const r = i.getBoundingClientRect();
            return r.top < innerHeight && r.bottom > 0;
          })
          .every((i) => i.complete),
      null,
      { timeout: 8000 },
    )
    .catch(() => {});
  await p.screenshot({
    path: path.join(out, name + '.png'),
    animations: 'disabled',
  });
  report.screenshots.push(name);
}
try {
  await p.goto(base);
  await p.locator('.test-entry[data-ready=true]').waitFor();
  await p.getByLabel('테스트 비밀번호', { exact: true }).fill('1234');
  await p.getByRole('button', { name: '여행 시작하기', exact: true }).click();
  await p.locator('.app-shell[data-ready=true]').waitFor();
  await tab('둘러보기').click();
  await p.locator('.journey-card').first().waitFor();
  assert.equal(await p.locator('input[type=datetime-local]').count(), 0);
  await p.getByRole('button', { name: '고성', exact: true }).click();
  await p.getByRole('button', { name: '직접 만들기', exact: true }).click();
  assert.match(
    await p.getByLabel('코스 이름', { exact: true }).inputValue(),
    /고성/,
  );
  assert.equal(await p.locator('.builder-stop').count(), 0);
  await p.getByRole('button', { name: '코스 편집 닫기', exact: true }).click();
  await p.locator('.course-builder').waitFor({ state: 'hidden' });
  report.checks.push(
    'Browse region preserved in blank plan; no inherited meeting',
  );
  await p.getByRole('button', { name: '철원', exact: true }).click();
  await shot('01-discover');
  await p
    .getByRole('button', {
      name: '철원에 남은 기억을 따라 자세히 보기',
      exact: true,
    })
    .click();
  await shot('02-course');
  await p
    .getByRole('button', { name: '이 코스로 일정 만들기', exact: true })
    .click();
  await p
    .getByLabel('출발 날짜·시간', { exact: true })
    .fill('2026-10-03T10:00');
  await p
    .getByLabel('돌아올 예정 시각', { exact: true })
    .fill('2026-10-03T18:00');
  await p.getByRole('button', { name: '내 코스 저장', exact: true }).click();
  await p.locator('.course-builder').waitFor({ state: 'hidden' });
  await p.getByRole('button', { name: '출타 시작', exact: true }).click();
  await p.getByLabel('오늘 돌아올 시각').fill('2026-10-03T18:30');
  await p
    .getByRole('button', { name: '만나는 장소 설정', exact: true })
    .click();
  await p.getByRole('button', { name: '코스 편집 닫기', exact: true }).click();
  assert.equal(
    await p.getByLabel('오늘 돌아올 시각').inputValue(),
    '2026-10-03T18:30',
  );
  await p
    .getByRole('button', { name: '만나는 장소 설정', exact: true })
    .click();
  await p.locator('.builder-origin button').click();
  await p
    .getByRole('button', { name: '즐겨찾기 추가하기', exact: true })
    .click();
  await p
    .getByLabel('만남 장소 이름', { exact: true })
    .fill('노동당사 앞에서 만나기');
  await p.locator('.public-pick-map[data-ready=true]').waitFor();
  await p
    .getByRole('button', { name: '지도 중심을 이 장소로 선택', exact: true })
    .click();
  await shot('03-meeting');
  await p
    .getByRole('button', { name: '즐겨찾기에 저장하고 선택', exact: true })
    .click();
  await shot('04-editor');
  await p.getByRole('button', { name: '변경사항 저장', exact: true }).click();
  await p.locator('.course-builder').waitFor({ state: 'hidden' });
  assert.equal(
    await p.getByLabel('오늘 돌아올 시각').inputValue(),
    '2026-10-03T18:30',
  );
  report.checks.push(
    'First meeting map works without favorites; start deadline survives cancel and save',
  );
  await shot('05-start');
  await p.getByRole('button', { name: '출타 시작', exact: true }).click();
  await p.locator('.outing-clock').waitFor();
  await shot('06-outing');
  const link = p.getByRole('link', { name: '카카오맵 길찾기', exact: true });
  assert.match(await link.getAttribute('href'), /^https:\/\/map.kakao.com/);
  await p.getByRole('button', { name: '방문 정보', exact: true }).click();
  await p.getByRole('dialog').waitFor();
  await p.getByRole('button', { name: '닫기', exact: true }).click();
  await p.getByRole('dialog').waitFor({ state: 'hidden' });
  report.checks.push(
    'Current outing has next-place navigation and visit details',
  );
  await p.getByRole('button', { name: '여행 완료', exact: true }).click();
  await p.getByRole('alertdialog').waitFor();
  await shot('07-completion');
  await p
    .getByRole('button', { name: '아직 다녀오기 전이에요', exact: true })
    .click();
  assert.equal(await p.locator('.outing-clock').count(), 1);
  report.checks.push('Completion cancellation preserves active outing');
  assert.equal(report.errors.length, 0);
  report.status = 'passed';
} catch (e) {
  report.status = 'failed';
  report.error = e.message.replace(
    /([?&](?:appkey|serviceKey)=)[^&\s]+/gi,
    '$1[redacted]',
  );
  await shot('failure').catch(() => {});
}
await fs.writeFile(
  path.join(out, 'report.json'),
  JSON.stringify(report, null, 2),
);
await ctx.close();
await browser.close();
console.log(JSON.stringify(report));
if (report.status !== 'passed') process.exitCode = 1;
