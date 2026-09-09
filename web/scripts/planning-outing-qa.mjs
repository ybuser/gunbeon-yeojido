import { enterGuest, recordMenu } from './qa-navigation.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const base = process.env.QA_BASE_URL || 'http://localhost:3000';
const live = process.env.QA_LIVE !== '0';
const out = path.resolve(process.env.QA_OUT_DIR || '../tmp/qa/planning-outing');
await fs.mkdir(out, { recursive: true });
const sizes = [
  { name: 'small', width: 360, height: 740 },
  { name: 'large', width: 430, height: 932 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'wide', width: 1920, height: 1080 },
].filter(
  (s) =>
    !process.env.QA_CASES || process.env.QA_CASES.split(',').includes(s.name),
);
const report = {
  startedAt: new Date().toISOString(),
  base,
  live,
  deviceMode:
    'Desktop browser viewport/touch emulation, not physical mobile devices',
  cases: [],
};
const tab = (p, name) => p.getByRole('tab', { name, exact: true });
for (const channel of (
  process.env.QA_BROWSER_CHANNELS || 'chrome,msedge'
).split(',')) {
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
    const p = await ctx.newPage();
    p.setDefaultTimeout(25000);
    const result = {
      browser: channel,
      version: browser.version(),
      viewport: size,
      checks: [],
      pageErrors: [],
      status: 'running',
    };
    p.on('pageerror', (e) =>
      result.pageErrors.push(
        e.message.replace(
          /([?&](?:appkey|serviceKey)=)[^&\s]+/gi,
          '$1[redacted]',
        ),
      ),
    );
    if (!live) {
      await ctx.route('**/api/places?*', (r) =>
        r.fulfill({ status: 503, json: { mode: 'unavailable', places: [] } }),
      );
      await ctx.route('**/api/status', (r) =>
        r.fulfill({ json: { kakaoMapKey: '' } }),
      );
    }
    async function shot(name) {
      await p.screenshot({
        path: path.join(out, `${channel}-${size.name}-${name}.png`),
        animations: 'disabled',
      });
    }
    async function state() {
      return p.evaluate(() =>
        JSON.parse(localStorage.getItem('gangwon-passport-v1')),
      );
    }
    try {
      await p.goto(base);
      await enterGuest(p);
      await p.locator('.test-entry[data-ready="true"]').waitFor();
      await enterGuest(p);
      await p.getByLabel('테스트 비밀번호', { exact: true }).fill('1234');
      await p
        .getByRole('button', { name: '여행 시작하기', exact: true })
        .click();
      await p.locator('.app-shell[data-ready="true"]').waitFor();
      await tab(p, '둘러보기').click();
      await p.locator('.journey-card').first().waitFor();
      await p.clock.install({ time: new Date() });
      assert.equal(await p.locator('.main-nav [role=tab]').count(), 5);
      const planBefore = await p.locator('.journey-meta').first().innerText();
      await p.clock.fastForward(30 * 60000);
      assert.equal(
        await p.locator('.journey-meta').first().innerText(),
        planBefore,
      );
      result.checks.push(
        'Date-free discovery estimates remain fixed after 30 minutes; five navigation tabs fit',
      );
      await tab(p, '내 여행').click();
      await p
        .getByRole('button', { name: '새 코스 만들기', exact: true })
        .click();
      await p.getByLabel('코스 이름', { exact: true }).fill('나중에 채울 하루');
      assert.equal(await p.locator('.builder-stop').count(), 0);
      await p
        .getByRole('button', { name: '내 코스 저장', exact: true })
        .click();
      await p.locator('.course-builder').waitFor({ state: 'hidden' });
      assert.equal((await state()).entries[0].plan.stops.length, 0);
      assert(
        await p
          .getByRole('button', { name: '여행 완료', exact: true })
          .isDisabled(),
      );
      await p.reload();
      await p.locator('.app-shell[data-ready="true"]').waitFor();
      await p.locator('.saved-mission').waitFor();
      await (await recordMenu(p, '코스 수정')).click();
      assert.equal(await p.locator('.builder-stop').count(), 0);
      await p
        .getByRole('button', { name: '코스 편집 닫기', exact: true })
        .click();
      result.checks.push(
        'Blank course saves and restores; completion disabled until places exist',
      );
      if (live) {
        let releaseLocation;
        const locationReady = new Promise(
          (resolve) => (releaseLocation = resolve),
        );
        const delayedLocation = async (route) => {
          await locationReady;
          await route.continue();
        };
        await ctx.route('**/api/catalog', delayedLocation);
        await ctx.route('**/api/places?*', delayedLocation);
        await p.reload();
        await p.locator('.app-shell[data-ready="true"]').waitFor();
        await p
          .getByRole('button', { name: '즐겨찾는 장소', exact: true })
          .click();
        await p
          .getByRole('button', { name: '즐겨찾기 추가하기', exact: true })
          .click();
        await p.getByLabel('만남 장소 이름', { exact: true }).fill('정문 앞');
        await p
          .getByLabel('만남 장소 설명', { exact: true })
          .fill('늘 만나는 정문 맞은편');
        assert.equal(await p.getByRole('checkbox').count(), 0);
        await p
          .getByText(
            '위치가 확인된 만남 거점을 고르면 지도를 사용할 수 있어요.',
            { exact: true },
          )
          .waitFor();
        releaseLocation();
        await p.locator('.public-pick-map[data-ready=true]').waitFor();
        await ctx.unroute('**/api/catalog', delayedLocation);
        await ctx.unroute('**/api/places?*', delayedLocation);
        result.checks.push(
          'Map initializes after meeting coordinates arrive later than the SDK key',
        );
        await p
          .getByRole('button', {
            name: '지도 중심을 이 장소로 선택',
            exact: true,
          })
          .click();
        await p
          .getByRole('button', {
            name: '즐겨찾기에 저장하고 선택',
            exact: true,
          })
          .click();
        await p.locator('.meeting-sheet').waitFor({ state: 'hidden' });
      } else {
        await p.evaluate(() => {
          const s = JSON.parse(localStorage.getItem('gangwon-passport-v1'));
          s.favorites = [
            {
              id: 'manual:qa-meet',
              title: '정문 앞',
              address: '늘 만나는 정문 맞은편',
              lat: 38.186,
              lon: 127.287,
              sigungu: '철원군',
              category: 'other',
            },
          ];
          localStorage.setItem('gangwon-passport-v1', JSON.stringify(s));
        });
        await p.reload();
        await p.locator('.app-shell[data-ready="true"]').waitFor();
      }
      assert.equal((await state()).favorites.length, 1);
      await (await recordMenu(p, '코스 수정')).click();
      await p.locator('.builder-origin button').click();
      await p
        .getByRole('heading', { name: '즐겨찾는 장소', exact: true })
        .waitFor();
      assert.equal(
        await p.getByRole('tab', { name: '가까운 후보', exact: true }).count(),
        0,
      );
      assert.equal(
        await p
          .getByRole('tab', { name: '관광정보 검색', exact: true })
          .count(),
        0,
      );
      await p.locator('.favorite-choose').first().click();
      const add = p.getByRole('button', { name: /장소 추가 \d/ });
      await add.click();
      await p.locator('.finder-favorites').waitFor();
      await p.locator('.finder-result button:enabled').first().click();
      await add.click();
      await p.locator('.finder-favorites .favorite-choose').first().click();
      assert.equal(await p.locator('.builder-stop').count(), 2);
      const plannedTime = '2026-09-20T10:00';
      await p.getByLabel('출발 날짜·시간', { exact: true }).fill(plannedTime);
      await p
        .getByRole('button', { name: '변경사항 저장', exact: true })
        .click();
      await p.locator('.course-builder').waitFor({ state: 'hidden' });
      const saved = (await state()).entries[0];
      assert.equal(
        saved.plan.manualPlaces.find((x) => x.id === saved.plan.originId).title,
        '정문 앞',
      );
      assert(saved.plan.timeBudgetMinutes > 0);
      result.checks.push(
        'Meeting picker only offers favorites/map; favorite-first stop selection and personal place declaration removed',
      );
      await p
        .getByRole('button', { name: '즐겨찾는 장소', exact: true })
        .click();
      await p
        .getByRole('button', { name: '정문 앞 즐겨찾기 삭제', exact: true })
        .click();
      await p.getByRole('button', { name: '닫기', exact: true }).click();
      assert.equal((await state()).favorites.length, 0);
      let releaseCatalog, finishCatalog;
      const catalogHandled = new Promise(
        (resolve) => (finishCatalog = resolve),
      );
      const catalogReady = new Promise((resolve) => (releaseCatalog = resolve));
      const delayedCatalog = async (route) => {
        await catalogReady;
        await route.continue();
        finishCatalog();
      };
      await ctx.route('**/api/catalog', delayedCatalog);
      await p.reload();
      await p.locator('.app-shell[data-ready="true"]').waitFor();
      await (await recordMenu(p, '코스 수정')).click();
      await p
        .locator('.builder-origin strong')
        .filter({ hasText: '정문 앞' })
        .waitFor();
      assert.equal(
        await p.getByLabel('출발 날짜·시간', { exact: true }).inputValue(),
        plannedTime,
      );
      assert.equal(
        await p
          .getByText('저장한 장소 정보를 연결하지 못했습니다.', {
            exact: false,
          })
          .count(),
        0,
      );
      releaseCatalog();
      await catalogHandled;
      await ctx.unroute('**/api/catalog', delayedCatalog);
      await p
        .locator('.course-builder button:not([disabled])')
        .filter({ hasText: '변경사항 저장' })
        .waitFor();
      result.checks.push(
        'Delayed catalog shows loading instead of a premature failure; saved places finish restoring',
      );
      await shot('plan');
      await p
        .getByRole('button', { name: '코스 편집 닫기', exact: true })
        .click();
      result.checks.push(
        'Favorite deletion leaves saved meeting snapshot and future plan time intact',
      );
      await p.getByRole('button', { name: '여행 완료', exact: true }).click();
      await p
        .getByRole('heading', { name: '여행, 잘 다녀오셨나요?', exact: true })
        .waitFor();
      await p
        .getByRole('button', { name: '아직 다녀오기 전이에요', exact: true })
        .click();
      assert.equal((await state()).entries[0].stamps.length, 0);
      assert(!(await state()).entries[0].completedAt);
      await p.getByRole('button', { name: '출타 시작', exact: true }).click();
      await p
        .getByRole('heading', { name: '지금 출발할까요?', exact: true })
        .waitFor();
      await p.getByRole('button', { name: '출타 시작', exact: true }).click();
      await p.locator('.outing-clock').waitFor();
      const clockBefore = parseInt(
        await p.locator('.outing-clock>strong').innerText(),
      );
      await p.clock.fastForward(10 * 60000);
      const clockAfter = parseInt(
        await p.locator('.outing-clock>strong').innerText(),
      );
      assert(clockBefore - clockAfter >= 9 && clockBefore - clockAfter <= 11);
      assert.equal(
        (await state()).entries[0].plan.departureAt,
        saved.plan.departureAt,
      );
      await tab(p, '내 여행').click();
      await (await recordMenu(p, '저장한 장소 다시 보기'))
        .click();
      await p.locator('.place-row').first().waitFor();
      await p.locator('.edit-summary').click();
      await p.locator('.outing-clock').waitFor();
      assert.equal(await p.locator('.course-builder').count(), 0);
      await p
        .getByLabel('현재 날씨 보정', { exact: true })
        .selectOption('snow');
      await p.locator('.outing-margin.avoid').waitFor();
      assert.equal((await state()).activeOuting.settings.weather, 'snow');
      await p
        .getByLabel('현재 날씨 보정', { exact: true })
        .selectOption('unknown');
      result.checks.push(
        'Active itinerary edit blocked centrally; current weather correction affects live risk',
      );
      await p
        .getByRole('button', { name: '이 장소 일정 마침', exact: true })
        .click();
      assert.equal((await state()).activeOuting.completedStops, 1);
      await p.reload();
      await p.locator('.app-shell[data-ready="true"]').waitFor();
      await p.locator('.outing-clock').waitFor();
      assert.equal((await state()).activeOuting.completedStops, 1);
      await p
        .getByRole('button', { name: '마지막 진행 되돌리기', exact: true })
        .click();
      assert.equal((await state()).activeOuting.completedStops, 0);
      await p.evaluate(() => scrollTo(0, 0));
      await shot('outing');
      await p
        .getByRole('button', { name: '출타 시계 종료', exact: true })
        .click();
      await p.getByRole('button', { name: '계속 보기', exact: true }).click();
      assert((await state()).activeOuting);
      result.checks.push(
        'Explicit outing start; live clock ticks, progress restores/undoes, cancel preserves current outing',
      );
      await p.getByRole('button', { name: '여행 완료', exact: true }).click();
      await shot('completion');
      await p
        .getByRole('checkbox', { name: '장소 목록 없이 하루만 기록할게요' })
        .check();
      await p
        .getByRole('button', { name: '여행 완료로 기록', exact: true })
        .click();
      await p.locator('.saved-mission').waitFor();
      const completed = (await state()).entries[0];
      assert(completed.completedAt);
      assert.deepEqual(completed.stamps, ['입경', '복귀']);
      assert.equal((await state()).activeOuting, null);
      assert.equal(
        await p.getByRole('button', { name: '입경', exact: true }).count(),
        0,
      );
      result.checks.push(
        'Confirmed completion alone adds selected stamps and ends the clock',
      );
      const box = await p.evaluate(() => ({
        w: innerWidth,
        s: document.documentElement.scrollWidth,
      }));
      assert(box.s <= box.w + 1);
      assert.equal(result.pageErrors.length, 0);
      result.status = 'passed';
    } catch (e) {
      result.status = 'failed';
      result.error = String(e.message).slice(0, 1800);
      await shot('failure').catch(() => {});
    } finally {
      await ctx.close();
      report.cases.push(result);
      await fs.writeFile(
        path.join(out, 'results.json'),
        JSON.stringify(report, null, 2),
      );
      console.log(
        JSON.stringify({
          browser: channel,
          size: size.name,
          status: result.status,
          error: result.error,
        }),
      );
    }
  }
  await browser.close();
}
report.completedAt = new Date().toISOString();
report.passed = report.cases.filter((c) => c.status === 'passed').length;
report.failed = report.cases.length - report.passed;
await fs.writeFile(
  path.join(out, 'results.json'),
  JSON.stringify(report, null, 2) + '\n',
);
if (report.failed) process.exitCode = 1;
