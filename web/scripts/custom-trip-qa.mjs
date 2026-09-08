import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const base = process.env.QA_BASE_URL || 'http://localhost:3000';
const out = path.resolve(process.env.QA_OUT_DIR || '../tmp/qa/custom');
const live = process.env.QA_LIVE !== '0';
await fs.mkdir(out, { recursive: true });
const report = {
  startedAt: new Date().toISOString(),
  base,
  live,
  deviceMode:
    'Desktop Chrome/Edge with viewport and touch emulation, not physical phones',
  cases: [],
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
const tab = (p, name) => p.getByRole('tab', { name, exact: true });
async function screenshot(p, name) {
  await p
    .waitForFunction(
      () =>
        [...document.images]
          .filter((i) => {
            const r = i.getBoundingClientRect();
            return r.bottom > 0 && r.top < innerHeight;
          })
          .every((i) => i.complete),
      null,
      { timeout: 7000 },
    )
    .catch(() => {});
  await p.screenshot({ path: path.join(out, name), animations: 'disabled' });
}
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
    const r = {
      browser: channel,
      version: browser.version(),
      viewport: size,
      checks: [],
      pageErrors: [],
      apiRequests: {},
      status: 'running',
    };
    const ctx = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.width < 500,
      hasTouch: size.width < 500,
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      reducedMotion: 'reduce',
    });
    const p = await ctx.newPage();
    p.setDefaultTimeout(20000);
    p.on('pageerror', (e) =>
      r.pageErrors.push(
        e.message.replace(
          /([?&](?:appkey|serviceKey)=)[^&\s]+/gi,
          '$1[redacted]',
        ),
      ),
    );
    p.on('request', (req) => {
      const u = new URL(req.url());
      if (u.origin === new URL(base).origin && u.pathname.startsWith('/api/'))
        r.apiRequests[u.pathname] = (r.apiRequests[u.pathname] || 0) + 1;
    });
    if (!live) {
      await ctx.route('**/api/places?*', (route) =>
        route.fulfill({
          status: 503,
          json: { mode: 'unavailable', places: [] },
        }),
      );
      await ctx.route('**/api/places/search?*', (route) =>
        route.fulfill({
          status: 503,
          json: { message: 'QA 검색 장애', places: [] },
        }),
      );
      await ctx.route('**/api/status', (route) =>
        route.fulfill({ json: { kakaoMapKey: '' } }),
      );
    }
    try {
      assert.equal(
        (await ctx.request.get(new URL('/api/catalog', base).href)).status(),
        401,
      );
      await p.goto(base);
      await p.locator('.test-entry[data-ready="true"]').waitFor();
      await p.getByLabel('테스트 비밀번호', { exact: true }).fill('wrong');
      await p
        .getByRole('button', { name: '여행 시작하기', exact: true })
        .click();
      await p.getByText('비밀번호가 맞지 않습니다.', { exact: true }).waitFor();
      await p
        .getByLabel('테스트 비밀번호', { exact: true })
        .fill(process.env.QA_TEST_PASSWORD || '1234');
      await p
        .getByRole('button', { name: '여행 시작하기', exact: true })
        .click();
      await p.locator('.app-shell[data-ready="true"]').waitFor();
      await tab(p, '둘러보기').click();
      await p.locator('.journey-card').first().waitFor();
      r.checks.push(
        'Anonymous API denied; wrong password rejected; correct password admits without ChatGPT',
      );
      for (const cover of await p
        .locator('.journey-image .course-cover')
        .all()) {
        const n = await cover.locator('.course-cover-tile').count();
        assert(n >= 1 && n <= 4);
      }
      await screenshot(p, channel + '-' + size.name + '-collage.png');
      await tab(p, '내 여행').click();
      await p
        .getByRole('button', { name: '새 코스 만들기', exact: true })
        .click();
      await p
        .getByLabel('코스 이름', { exact: true })
        .fill('가족과 만드는 첫 코스');
      const add = p.getByRole('button', { name: /장소 추가 \d/ });
      await add.click();
      await p.locator('.finder-result button:enabled').first().click();
      assert.equal(
        await p.locator('.builder-preview .course-cover-tile').count(),
        1,
      );
      await p.getByLabel('1번 머무는 시간', { exact: true }).fill('35');
      await p.getByLabel('1번 도보 시간', { exact: true }).fill('10');
      await add.click();
      await tab(p, '관광정보 검색').click();
      await p.getByLabel('관광장소 검색어', { exact: true }).fill('고석정');
      await p.getByRole('button', { name: '검색', exact: true }).click();
      if (live) {
        await p.locator('.finder-result').first().waitFor();
        await p.locator('.finder-result button:enabled').first().click();
        r.checks.push('TourAPI keyword search result added to a custom course');
      } else {
        await p.getByText('QA 검색 장애', { exact: true }).waitFor();
        await tab(p, '가까운 후보').click();
        await p.locator('.finder-result button:enabled').first().click();
        r.checks.push('Search outage shown; public catalogue still usable');
      }
      assert.equal(
        await p.locator('.builder-preview .course-cover-tile').count(),
        2,
      );
      await add.click();
      await p.getByRole('button', { name: '직접 추가', exact: true }).click();
      await p
        .getByLabel('장소 이름', { exact: true })
        .fill('가족이 찾은 공개 카페');
      await p
        .getByLabel('주소', { exact: true })
        .fill('강원특별자치도 철원군 공개 카페');
      if (live) {
        await p.locator('.public-pick-map[data-ready="true"]').waitFor();
        await p
          .locator('.public-pick-map')
          .click({ position: { x: 120, y: 140 } });
        await p
          .getByText('위치를 선택했습니다.', {
            exact: true,
          })
          .waitFor();
      }
      assert.equal(
        await p
          .getByRole('checkbox', { name: /군 시설·개인 주소가 아닌/ })
          .count(),
        0,
      );
      await p
        .getByRole('button', { name: '이 장소 코스에 추가', exact: true })
        .click();
      assert.equal(
        await p.locator('.builder-preview .course-cover-tile').count(),
        3,
      );
      await add.click();
      await p.getByRole('button', { name: '직접 추가', exact: true }).click();
      await p
        .getByLabel('장소 이름', { exact: true })
        .fill('위치는 나중에 정할 식당');
      assert.equal(
        await p
          .getByRole('checkbox', { name: /군 시설·개인 주소가 아닌/ })
          .count(),
        0,
      );
      await p
        .getByRole('button', { name: '이 장소 코스에 추가', exact: true })
        .click();
      assert.equal(
        await p.locator('.builder-preview .course-cover-tile').count(),
        4,
      );
      await add.click();
      await p.locator('.finder-result button:enabled').first().click();
      assert.equal(await p.locator('.builder-stop').count(), 5);
      assert.equal(
        await p.locator('.builder-preview .course-cover-tile').count(),
        4,
      );
      await p.getByLabel('5번 장소 위로', { exact: true }).click();
      const names = await p
        .locator('.builder-stop-top strong')
        .allTextContents();
      assert(
        (await p.locator('.builder-margin').innerText()).includes(
          '복귀 여유 확인 전',
        ),
      );
      await screenshot(p, channel + '-' + size.name + '-editor.png');
      const overflow = await p
        .locator('.course-builder')
        .evaluate((e) => ({ width: e.clientWidth, scroll: e.scrollWidth }));
      assert(overflow.scroll <= overflow.width + 1);
      await p
        .getByRole('button', { name: '내 코스 저장', exact: true })
        .click();
      await p.locator('.course-builder').waitFor({ state: 'hidden' });
      await p.locator('.saved-mission').first().waitFor();
      const saved = await p.evaluate(
        () =>
          JSON.parse(localStorage.getItem('gangwon-passport-v1')).entries[0],
      );
      assert.equal(saved.plan.kind, 'custom');
      assert.equal(saved.plan.stops.length, 5);
      assert.equal(saved.plan.manualPlaces.length, 2);
      assert(!JSON.stringify(saved).includes('image_url'));
      assert(!JSON.stringify(saved).includes('returnAt'));
      r.checks.push(
        '1/2/3/4 tile layouts, five-place cap, add/reorder/stay/manual place and missing-coordinate state',
      );
      await p.reload();
      await p.locator('.app-shell[data-ready="true"]').waitFor();
      await tab(p, '둘러보기').click();
      await p.locator('.saved-mission').first().waitFor();
      await p.getByRole('button', { name: '코스 수정', exact: true }).click();
      await p.waitForFunction(
        (expected) =>
          JSON.stringify(
            [...document.querySelectorAll('.builder-stop-top strong')].map(
              (e) => e.textContent,
            ),
          ) === JSON.stringify(expected),
        names,
        { timeout: 45000 },
      );
      assert.deepEqual(
        await p.locator('.builder-stop-top strong').allTextContents(),
        names,
      );
      await p.getByLabel('1번 머무는 시간', { exact: true }).fill('50');
      await p
        .getByRole('button', { name: '변경사항 저장', exact: true })
        .click();
      await p.locator('.course-builder').waitFor({ state: 'hidden' });
      assert.equal(await p.locator('.saved-mission').count(), 1);
      r.checks.push(
        'Reload restores exact manual and provider references; editing updates the same record',
      );
      await p.getByRole('button', { name: '공유 카드', exact: true }).click();
      await p.getByRole('dialog').waitFor();
      const [download] = await Promise.all([
        p.waitForEvent('download'),
        p
          .getByRole('button', { name: '카드 이미지 저장', exact: true })
          .click(),
      ]);
      const svg = await fs.readFile(await download.path(), 'utf8');
      for (const text of [
        '가족과 만드는 첫 코스',
        '가족이 찾은 공개 카페',
        '위치는 나중에 정할 식당',
        'departureAt',
        'returnAt',
        'manual:',
      ])
        assert(!svg.includes(text));
      await p.getByRole('button', { name: '닫기', exact: true }).click();
      await p.getByRole('dialog').waitFor({ state: 'hidden' });
      await tab(p, '둘러보기').click();
      await p.locator('.journey-image').first().click();
      await p
        .getByRole('button', { name: '가져와서 수정', exact: true })
        .click();
      await p
        .getByLabel('코스 이름', { exact: true })
        .fill('추천에서 가져온 코스');
      await p
        .getByRole('button', { name: '내 코스 저장', exact: true })
        .click();
      await p.locator('.course-builder').waitFor({ state: 'hidden' });
      assert.equal(await p.locator('.saved-mission').count(), 2);
      await p
        .getByRole('button', { name: '코스 수정', exact: true })
        .first()
        .click();
      await p
        .getByLabel('코스 이름', { exact: true })
        .fill('저장하지 않을 변경');
      await p
        .getByRole('button', { name: '코스 편집 닫기', exact: true })
        .click();
      await p.getByRole('alertdialog').waitFor();
      await p.getByRole('button', { name: '변경 버리기', exact: true }).click();
      await p.locator('.course-builder').waitFor({ state: 'hidden' });
      assert.equal(
        await p.getByText('저장하지 않을 변경', { exact: true }).count(),
        0,
      );
      r.checks.push(
        'Public share strips free text; importing preserves original; discard leaves saved course intact',
      );
      await screenshot(p, channel + '-' + size.name + '-saved.png');
      assert.equal(r.pageErrors.length, 0);
      r.status = 'passed';
    } catch (e) {
      r.status = 'failed';
      r.error = e.message.slice(0, 1500);
      await screenshot(p, channel + '-' + size.name + '-failure.png').catch(
        () => {},
      );
    } finally {
      await ctx.close();
      report.cases.push(r);
      await fs.writeFile(
        path.join(out, 'results.json'),
        JSON.stringify(report, null, 2),
      );
      console.log(
        JSON.stringify({
          browser: channel,
          size: size.name,
          status: r.status,
          error: r.error,
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
