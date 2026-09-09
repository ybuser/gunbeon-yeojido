import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const base = process.env.QA_BASE_URL || 'http://localhost:3000';
const out = path.resolve(process.env.QA_OUT_DIR || '../tmp/qa/day-passport');
const live = process.env.QA_LIVE === '1';
await fs.mkdir(out, { recursive: true });
const catalog = JSON.parse(
  await fs.readFile(
    new URL('../lib/data/places.json', import.meta.url),
    'utf8',
  ),
);
const names = ['고성 왕곡마을', '송지호관망타워', '송지호 해수욕장'];
const stops = names.map((name) => catalog.find((p) => p.title === name));
assert(
  stops.every(Boolean),
  'Guide places must exist in the actual public catalogue',
);
const meeting = {
  id: 'manual:qa-meeting',
  title: '늘 만나는 곳',
  address: '개인 만남 장소',
  lat: 38.335,
  lon: 128.515,
  sigungu: '고성군',
  category: 'other',
};
const entry = {
  recordId: 'qa-day',
  missionId: 'custom:qa-day',
  title: '친구들과 바다 보러 가는 날',
  region: '고성군',
  stamps: [],
  plan: {
    kind: 'custom',
    originId: meeting.id,
    manualPlaces: [meeting],
    variant: '내 코스',
    departureAt: '2026-10-03T01:00:00Z',
    timeBudgetMinutes: 480,
    transport: 'car',
    stops: stops.map((p) => ({ placeId: p.id, stay: 50, walk: 10 })),
  },
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
const mockSDK = `(()=>{window.__mapStats={constructed:0,bounds:0,overlays:0};const stats=window.__mapStats;class LatLng{constructor(a,b){this.a=a;this.b=b;}getLat(){return this.a}getLng(){return this.b}}class Map{constructor(el,o){this.el=el;this.center=o.center;stats.constructed++;}setBounds(){stats.bounds++}relayout(){}getCenter(){return this.center}setCenter(p){this.center=p}}class CustomOverlay{constructor(o){this.content=o.content;}setMap(m){this.content.remove();if(m){m.el.append(this.content);stats.overlays++}}}class Marker{setMap(){}setPosition(){}}window.kakao={maps:{load:cb=>cb(),LatLng,Map,CustomOverlay,Marker,LatLngBounds:class{extend(){}},event:{addListener(){},removeListener(){}}}}})();`;
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
      viewport: { width: size.width, height: size.height },
      isMobile: size.width < 500,
      hasTouch: size.width < 500,
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      reducedMotion: 'reduce',
    });
    let providerCalls = 0,
      sdkRequests = 0;
    await ctx.route('**/api/places?*', (r) => {
      providerCalls++;
      return r.fulfill({
        status: 503,
        json: {
          mode: 'unavailable',
          places: [],
          error: 'DAILY_QUOTA_EXCEEDED',
        },
      });
    });
    if (!live) {
      await ctx.route('**/api/status', (r) =>
        r.fulfill({ json: { kakaoMapKey: 'qa-isolated-sdk' } }),
      );
      await ctx.route('https://dapi.kakao.com/**', (r) => {
        sdkRequests++;
        return r.fulfill({
          contentType: 'application/javascript',
          body: mockSDK,
        });
      });
    }
    const p = await ctx.newPage();
    p.setDefaultTimeout(10000);
    const result = {
      channel,
      version: browser.version(),
      viewport: size,
      device: 'desktop viewport/touch emulation',
      tourApi: 'isolated quota response; actual public base catalogue',
      kakao: live ? 'real SDK' : 'instrumented SDK double',
      checks: [],
      errors: [],
      status: 'running',
    };
    p.on('pageerror', (e) =>
      result.errors.push(
        e.message.replace(
          /([?&](?:appkey|serviceKey)=)[^&\s]+/gi,
          '$1[redacted]',
        ),
      ),
    );
    const tab = (name) => p.getByRole('tab', { name, exact: true });
    const state = () =>
      p.evaluate(() => JSON.parse(localStorage.getItem('gangwon-passport-v1')));
    const shot = async (name) => {
      await p.waitForTimeout(200);
      const toast = p.getByRole('button', { name: '알림 닫기', exact: true });
      if (await toast.count()) await toast.click();
      await p.screenshot({
        path: path.join(out, `${channel}-${size.name}-${name}.png`),
        animations: 'disabled',
      });
    };
    try {
      await p.goto(base);
      await p.locator('.test-entry[data-ready=true]').waitFor();
      await p.getByLabel('테스트 비밀번호', { exact: true }).fill('1234');
      await p
        .getByRole('button', { name: '여행 시작하기', exact: true })
        .click();
      await p.locator('.app-shell[data-ready=true]').waitFor();
      await p.evaluate(
        ({ entry, meeting }) => {
          const s = JSON.parse(localStorage.getItem('gangwon-passport-v1'));
          s.entries = [entry];
          s.favorites = [meeting];
          s.activeOuting = null;
          localStorage.setItem('gangwon-passport-v1', JSON.stringify(s));
        },
        { entry, meeting },
      );
      await p.reload();
      await p.locator('.app-shell[data-ready=true]').waitFor();
      await p.locator('.day-passport-cover').waitFor();
      await p
        .locator('.day-passport-cover img')
        .first()
        .evaluate((i) => i.decode())
        .catch(() => {});
      await shot('home');
      assert.equal(await p.locator('.day-story-dialog').count(), 0);
      const beforeStory = providerCalls;
      await p
        .getByRole('button', { name: '16초로 사용법 보기', exact: true })
        .click();
      await p.locator('.day-story-dialog').waitFor();
      assert(
        await p.getByRole('button', { name: '재생', exact: true }).isVisible(),
      );
      await p.clock.install({ time: new Date('2026-10-03T01:00:00Z') });
      await p.clock.fastForward(5000);
      assert.equal(await p.locator('.scene-0').count(), 1);
      await p.getByRole('button', { name: '다음 장면', exact: true }).click();
      await p.getByRole('button', { name: '다음 장면', exact: true }).click();
      await shot('story');
      await p.getByRole('button', { name: '바로 시작', exact: true }).click();
      await p.locator('.day-story-dialog').waitFor({ state: 'hidden' });
      assert.equal(providerCalls, beforeStory);
      result.checks.push(
        'Guide is optional, reduced motion starts paused, manual navigation and skip work without provider calls',
      );
      await p
        .getByRole('button', { name: '계속 계획하기', exact: true })
        .click();
      await p.locator('.course-builder').waitFor();
      await p.locator('.kakao-map').waitFor({ state: 'visible' });
      const initialStats = !live
        ? await p.evaluate(() => ({ ...window.__mapStats }))
        : null;
      await p
        .getByLabel('코스 이름', { exact: true })
        .fill('친구들과 바다 보러 가는 날');
      await p.getByLabel('1번 머무는 시간', { exact: true }).fill('55');
      if (!live) {
        assert.equal(
          await p.evaluate(() => window.__mapStats.constructed),
          initialStats.constructed,
        );
        assert.equal(
          await p.evaluate(() => window.__mapStats.bounds),
          initialStats.bounds,
        );
      }
      await p.getByRole('button', { name: '여유 조정', exact: true }).click();
      await p.locator('.day-comparison').waitFor();
      await shot('comparison');
      const gain = await p.locator('.day-adjust-difference').innerText();
      assert.match(gain, /늘어요/);
      await p
        .getByRole('button', { name: '이 안으로 일정표에 적용', exact: true })
        .click();
      await p.locator('.day-adjust-dialog').waitFor({ state: 'hidden' });
      assert.equal(await p.locator('.builder-stop').count(), 2);
      await p
        .getByRole('button', { name: '방금 조정 되돌리기', exact: true })
        .click();
      assert.equal(await p.locator('.builder-stop').count(), 3);
      await p.getByRole('button', { name: '여유 조정', exact: true }).click();
      await p
        .getByRole('button', { name: '이 안으로 일정표에 적용', exact: true })
        .click();
      await p.getByLabel('1번 머무는 시간', { exact: true }).fill('50');
      assert.equal(
        await p
          .getByRole('button', { name: '방금 조정 되돌리기', exact: true })
          .count(),
        0,
      );
      await p
        .getByRole('button', { name: '1번 장소 아래로', exact: true })
        .click();
      if (!live) {
        assert.equal(
          await p.evaluate(() => window.__mapStats.constructed),
          initialStats.constructed,
        );
        assert(
          (await p.evaluate(() => window.__mapStats.overlays)) >
            initialStats.overlays,
        );
        assert.equal(sdkRequests, 1);
      }
      result.checks.push(
        'Comparison recalculates route; explicit apply, undo and stale undo prevention; map instance survives title/stay/stop edits',
      );
      await p.getByLabel('돌아올 예정 시각', { exact: true }).fill('');
      await p
        .getByLabel('출발 날짜·시간', { exact: true })
        .fill('2026-10-03T11:00');
      await p
        .getByLabel('돌아올 예정 시각', { exact: true })
        .fill('2026-10-03T10:00');
      await p.getByRole('button', { name: '여유 조정', exact: true }).click();
      assert.equal(await p.locator('.day-comparison').count(), 0);
      assert.equal(
        await p
          .getByRole('button', { name: '이 안으로 일정표에 적용', exact: true })
          .count(),
        0,
      );
      await p
        .getByRole('button', { name: '여유 조정 닫기', exact: true })
        .click();
      await p
        .getByLabel('출발 날짜·시간', { exact: true })
        .fill('2026-10-03T10:00');
      await p
        .getByLabel('돌아올 예정 시각', { exact: true })
        .fill('2026-10-03T18:00');
      await p
        .getByRole('button', { name: '변경사항 저장', exact: true })
        .click();
      await p.locator('.course-builder').waitFor({ state: 'hidden' });
      const saved = (await state()).entries[0];
      assert.equal(saved.plan.stops.length, 2);
      assert.equal(
        Date.parse(saved.plan.departureAt),
        Date.parse(entry.plan.departureAt),
      );
      result.checks.push(
        'Empty return field then changed departure does not crash; reversed time blocks comparison; save preserves adjustment',
      );
      await tab('내 여행').click();
      await p.locator('.saved-mission').waitFor();
      await p.getByRole('button', { name: '여행 완료', exact: true }).click();
      await p.getByRole('alertdialog').waitFor();
      assert(
        await p
          .getByRole('button', { name: '여행 완료로 기록', exact: true })
          .isDisabled(),
      );
      await p
        .getByRole('button', { name: '아직 다녀오기 전이에요', exact: true })
        .click();
      assert(!(await state()).entries[0].completedAt);
      await p.getByRole('button', { name: '여행 완료', exact: true }).click();
      await p.getByRole('checkbox', { name: names[0], exact: true }).check();
      await shot('completion');
      await p
        .getByRole('button', { name: '여행 완료로 기록', exact: true })
        .click();
      await p.locator('.day-record').waitFor();
      assert.deepEqual((await state()).entries[0].visitedPlaceIds, [
        stops[0].id,
      ]);
      await p.getByRole('button', { name: '공유 카드', exact: true }).click();
      await p.locator('.share-sheet').waitFor();
      await shot('record');
      const [download] = await Promise.all([
        p.waitForEvent('download'),
        p
          .getByRole('button', { name: '카드 이미지 저장', exact: true })
          .click(),
      ]);
      const svg = await fs.readFile(await download.path(), 'utf8');
      assert(svg.includes(names[0]));
      for (const text of [
        names[1],
        names[2],
        entry.title,
        meeting.title,
        entry.plan.departureAt,
        String(meeting.lat),
      ])
        assert(!svg.includes(text), text);
      result.checks.push(
        'Cancel leaves plan; explicit visited subset only; exported card omits other stops and personal title/time/coordinates',
      );
      await p.keyboard.press('Escape');
      await p.locator('.share-sheet').waitFor({ state: 'hidden' });
      await tab('홈').click();
      await p
        .getByRole('button', { name: '16초로 사용법 보기', exact: true })
        .click();
      await p.getByRole('button', { name: '재생', exact: true }).click();
      await p.clock.runFor(16100);
      assert(
        await p
          .getByRole('button', { name: '다시 보기', exact: true })
          .isVisible(),
      );
      await p.getByRole('button', { name: '바로 시작', exact: true }).click();
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      assert.equal(result.errors.length, 0);
      result.checks.push(
        'All four story scenes finish; no horizontal overflow or uncaught page errors',
      );
      result.status = 'passed';
    } catch (e) {
      result.status = 'failed';
      result.error = e.message.replace(
        /([?&](?:appkey|serviceKey)=)[^&\s]+/gi,
        '$1[redacted]',
      );
      await shot('failure').catch(() => {});
    }
    results.push(result);
    console.log(JSON.stringify(result));
    await ctx.close();
  }
  await browser.close();
}
await fs.writeFile(
  path.join(out, 'results.json'),
  JSON.stringify(results, null, 2),
);
if (results.some((r) => r.status !== 'passed')) process.exitCode = 1;
