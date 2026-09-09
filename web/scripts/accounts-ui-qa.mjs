import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { recordMenu } from './qa-navigation.mjs';
const base = process.env.QA_BASE_URL || 'http://localhost:3000',
  out = path.resolve(process.env.QA_OUT_DIR || '../tmp/qa/accounts-ui');
await fs.mkdir(out, { recursive: true });
const catalog = JSON.parse(
  await fs.readFile(
    new URL('../lib/data/places.json', import.meta.url),
    'utf8',
  ),
);
const stops = ['고성 왕곡마을', '송지호관망타워'].map((n) =>
  catalog.find((p) => p.title === n),
);
const fixture = {
  version: 3,
  entries: [
    {
      recordId: 'qa-memory',
      missionId: 'custom:qa-memory',
      title: '엄마와 다녀온 고성',
      region: '고성군',
      stamps: ['입경', '동행', '복귀'],
      completedAt: '2026-09-07T09:00:00Z',
      recordStatus: 'completed',
      visitedPlaceIds: stops.map((p) => p.id),
      plan: {
        kind: 'custom',
        originId: stops[0].id,
        variant: '내 코스',
        departureAt: '2026-09-07T01:00:00Z',
        transport: 'car',
        timeBudgetMinutes: 480,
        stops: stops.map((p) => ({ placeId: p.id, stay: 40, walk: 10 })),
      },
    },
  ],
  favorites: [],
  activeOuting: null,
};
const sizes = [
  { name: 'small', width: 360, height: 740 },
  { name: 'large', width: 430, height: 932 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'wide', width: 1920, height: 1080 },
].filter(
  (s) =>
    !process.env.QA_CASES || process.env.QA_CASES.split(',').includes(s.name),
);
const results = [];
for (const channel of (process.env.QA_BROWSER_CHANNELS || 'chrome').split(
  ',',
)) {
  const browser = await chromium.launch({
    headless: true,
    ...(channel === 'msedge' && process.env.QA_EDGE_EXECUTABLE
      ? { executablePath: process.env.QA_EDGE_EXECUTABLE }
      : channel === 'chromium'
        ? {}
        : { channel }),
  });
  for (const size of sizes) {
    const ctx = await browser.newContext({
        viewport: size,
        isMobile: size.width < 500,
        hasTouch: size.width < 500,
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
        reducedMotion: 'reduce',
      }),
      second = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        locale: 'ko-KR',
      });
    const p = await ctx.newPage(),
      q = await second.newPage();
    p.setDefaultTimeout(15000);
    q.setDefaultTimeout(15000);
    const handle = 'qa_ui_' + Date.now().toString(36),
      password = randomBytes(24).toString('hex'),
      r = {
        channel,
        version: browser.version(),
        viewport: size,
        checks: [],
        screenshots: [],
      };
    results.push(r);
    const shot = async (name) => {
      const file = channel + '-' + size.name + '-' + name + '.png';
      await p.screenshot({ path: path.join(out, file), fullPage: true });
      r.screenshots.push(file);
    };
    const post = (context, url, data) =>
      context.request.post(base + url, { headers: { Origin: base }, data });
    const server = async () => {
      const response = await ctx.request.get(base + '/api/account/state');
      assert(response.ok());
      return response.json();
    };
    for (const context of [ctx, second]) {
      await context.route('**/api/places?*', (route) =>
        route.fulfill({
          status: 503,
          json: {
            mode: 'unavailable',
            message: '키 없는 화면 검사',
            places: [],
          },
        }),
      );
      await context.route('**/api/status', (route) =>
        route.fulfill({ json: { kakaoMapKey: '' } }),
      );
    }
    try {
      await p.goto(base + '/login');
      await p.locator('.account-page[data-ready=true]').waitFor();
      await shot('01-login');
      await p.evaluate(
        (value) =>
          localStorage.setItem('gangwon-passport-v1', JSON.stringify(value)),
        fixture,
      );
      await p.getByRole('tab', { name: '계정 만들기', exact: true }).click();
      await p.getByLabel('별명', { exact: true }).fill('민서');
      await p.getByLabel('아이디', { exact: true }).fill(handle);
      await p.getByLabel('비밀번호', { exact: true }).fill(password);
      await p.getByLabel('체험 초대 비밀번호', { exact: true }).fill('1234');
      await p
        .getByRole('button', { name: '내 여행 계정 만들기', exact: true })
        .click();
      await p.locator('.app-shell[data-ready=true]').waitFor();
      await p.locator('.travel-save-status.saved').waitFor();
      assert.equal((await server()).state.entries.length, 0);
      await p
        .getByRole('link', { name: '내 계정으로 가져오기', exact: true })
        .click();
      await p
        .getByRole('button', { name: '이 기기의 여행·그룹 연결', exact: true })
        .click();
      await shot('02-import');
      await p
        .getByRole('button', { name: '가져오기 확인', exact: true })
        .click();
      await p
        .getByText('이 기기의 여행과 참여 권한을 계정에 연결했어요.', {
          exact: false,
        })
        .waitFor();
      assert.equal(
        await p.evaluate(() => localStorage.getItem('gangwon-passport-v1')),
        null,
      );
      await p.getByRole('link', { name: '내 여행으로', exact: true }).click();
      await p.locator('.app-shell[data-ready=true]').waitFor();
      await p.locator('.record-tabs button').nth(1).click();
      await p.locator('.saved-mission').waitFor();
      assert.equal(
        await p.getByRole('button', { name: '기록 수정', exact: true }).count(),
        0,
      );
      assert(
        await p
          .getByRole('button', { name: '공유 카드', exact: true })
          .isVisible(),
      );
      await (await recordMenu(p, '기록 수정')).waitFor();
      await shot('03-record-menu');
      await p.keyboard.press('Escape');
      await p.getByRole('menu').waitFor({ state: 'hidden' });
      await (await recordMenu(p, '기록 수정')).click();
      await p
        .getByLabel('기록 이름', { exact: true })
        .fill('고성에서 함께 보낸 하루');
      await shot('04-record-edit');
      await p
        .getByRole('button', { name: '기록 수정 저장', exact: true })
        .click();
      await p.locator('.travel-save-status.saved').waitFor();
      const saved = await server();
      assert.equal(saved.state.entries[0].title, '고성에서 함께 보낸 하루');
      assert.equal(
        saved.state.entries[0].completedAt,
        fixture.entries[0].completedAt,
      );
      r.checks.push(
        'Real registration → explicit import → overflow record editing → server save; share card remains visible',
      );
      await q.goto(base + '/login');
      await q.locator('.account-page[data-ready=true]').waitFor();
      await q.getByLabel('아이디', { exact: true }).fill(handle);
      await q.getByLabel('비밀번호', { exact: true }).fill(password);
      await q.getByRole('button', { name: '로그인', exact: true }).click();
      await q.locator('.app-shell[data-ready=true]').waitFor();
      await q.getByRole('tab', { name: '내 여행', exact: true }).click();
      await q.locator('.record-tabs button').nth(1).click();
      await q
        .getByRole('heading', { name: '고성에서 함께 보낸 하루', exact: true })
        .waitFor();
      r.checks.push(
        'Second browser signs in to same account and restores edited record without localStorage seed',
      );
      await p.route('**/api/account/state', (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({
              status: 503,
              json: { message: 'QA 저장 연결 끊김' },
            })
          : route.continue(),
      );
      await (await recordMenu(p, '기록 수정')).click();
      await p
        .getByLabel('기록 이름', { exact: true })
        .fill('연결이 돌아와도 남길 하루');
      await p
        .getByRole('button', { name: '기록 수정 저장', exact: true })
        .click();
      await p.locator('.travel-save-status.error').waitFor();
      assert.equal(
        (await server()).state.entries[0].title,
        '고성에서 함께 보낸 하루',
      );
      await p.unroute('**/api/account/state');
      await p.getByRole('button', { name: '저장 재시도', exact: true }).click();
      await p.locator('.travel-save-status.saved').waitFor();
      assert.equal(
        (await server()).state.entries[0].title,
        '연결이 돌아와도 남길 하루',
      );
      const other = await second.request.get(base + '/api/account/state'),
        otherState = await other.json();
      await post(second, '/api/account/state', {
        revision: otherState.revision,
        state: {
          ...otherState.state,
          entries: [
            { ...otherState.state.entries[0], title: '다른 기기의 최신 기록' },
          ],
        },
      });
      await (await recordMenu(p, '기록 수정')).click();
      await p.getByLabel('기록 이름', { exact: true }).fill('충돌한 현재 화면');
      await p
        .getByRole('button', { name: '기록 수정 저장', exact: true })
        .click();
      await p.locator('.travel-save-status.conflict').waitFor();
      await shot('05-save-conflict');
      assert.equal(
        (await server()).state.entries[0].title,
        '다른 기기의 최신 기록',
      );
      r.checks.push(
        'Offline write remains in UI with retry; stale revision cannot overwrite another device',
      );
      const layout = await p.evaluate(() => ({
        w: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      assert(layout.scroll <= layout.w + 2);
      r.status = 'passed';
    } catch (e) {
      r.status = 'failed';
      r.error = e.stack;
      await shot('failure').catch(() => {});
      process.exitCode = 1;
    } finally {
      await ctx.close();
      await second.close();
    }
  }
  await browser.close();
}
await fs.writeFile(
  path.join(out, 'result.json'),
  JSON.stringify(
    { base, checkedAt: new Date().toISOString(), results },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    results.map(({ screenshots, ...r }) => r),
    null,
    2,
  ),
);
