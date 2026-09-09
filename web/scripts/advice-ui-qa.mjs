import { enterGuest, recordMenu } from './qa-navigation.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const base = process.env.QA_BASE_URL || 'http://localhost:3000',
  out = path.resolve(process.env.QA_OUT_DIR || '../tmp/qa/advice-ui');
await fs.mkdir(out, { recursive: true });
const catalog = JSON.parse(
  await fs.readFile(
    new URL('../lib/data/places.json', import.meta.url),
    'utf8',
  ),
);
const names = ['고성 왕곡마을', '송지호관망타워', '송지호 해수욕장'],
  stops = names.map((name) => catalog.find((p) => p.title === name));
const meeting = {
  id: 'manual:advice-meeting',
  title: '늘 만나는 곳',
  address: '개인 만남 SECRET',
  lat: 38.335,
  lon: 128.515,
  sigungu: '고성군',
  category: 'other',
};
const fixture = {
  recordId: 'qa-advice',
  missionId: 'custom:qa-advice',
  title: '친구들과 바다 보러 가는 날',
  region: '고성군',
  stamps: [],
  plan: {
    kind: 'custom',
    originId: meeting.id,
    manualPlaces: [meeting],
    variant: '내 코스',
    departureAt: '2026-10-03T01:00:00Z',
    timeBudgetMinutes: 600,
    transport: 'car',
    stops: stops.map((p) => ({ placeId: p.id, stay: 45, walk: 10 })),
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
    const options = {
      viewport: { width: size.width, height: size.height },
      isMobile: size.width < 500,
      hasTouch: size.width < 500,
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      reducedMotion: 'reduce',
    };
    const owner = await browser.newContext(options),
      guest = await browser.newContext(options),
      p = await owner.newPage(),
      g = await guest.newPage();
    const result = {
      channel,
      version: browser.version(),
      viewport: size,
      status: 'running',
      checks: [],
      errors: [],
      providers:
        'TourAPI regional endpoint isolated as unavailable; real base catalog and D1; Kakao disabled in this workflow check',
    };
    let id;
    for (const ctx of [owner, guest]) {
      await ctx.route('**/api/places?*', (r) =>
        r.fulfill({
          status: 503,
          json: {
            mode: 'unavailable',
            places: [],
            error: 'DAILY_QUOTA_EXCEEDED',
          },
        }),
      );
      await ctx.route('**/api/status', (r) =>
        r.fulfill({ json: { kakaoMapKey: '' } }),
      );
    }
    for (const page of [p, g]) {
      page.setDefaultTimeout(12000);
      page.on('pageerror', (e) => result.errors.push(e.message));
    }
    const state = () =>
      p.evaluate(() => JSON.parse(localStorage.getItem('gangwon-passport-v1')));
    const shot = async (page, name) => {
      await Promise.race([
        Promise.all(
          (await page.locator('img').all()).map((i) =>
            i.evaluate((el) => el.decode()).catch(() => {}),
          ),
        ),
        new Promise((resolve) => setTimeout(resolve, 4500)),
      ]);
      await page.screenshot({
        path: path.join(out, `${channel}-${size.name}-${name}.png`),
        animations: 'disabled',
      });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        'horizontal overflow at ' + name,
      );
    };
    const closeManager = () =>
      p
        .locator('.advice-sheet')
        .getByRole('button', { name: 'Close', exact: true })
        .click();
    const manage = async () => {
      await (await recordMenu(p, '받은 한 수 보기'))
        .click();
      await p.locator('.advice-response').first().waitFor();
    };
    try {
      await owner.request.post(base + '/api/test-access', {
        headers: { origin: base },
        data: { password: process.env.QA_PASSWORD || '1234' },
      });
      await p.goto(base);
      await p.locator('.app-shell[data-ready=true]').waitFor();
      await p.evaluate(
        ({ fixture, meeting }) => {
          const s = JSON.parse(localStorage.getItem('gangwon-passport-v1'));
          s.entries = [fixture];
          s.favorites = [meeting];
          s.activeOuting = null;
          localStorage.setItem('gangwon-passport-v1', JSON.stringify(s));
        },
        { fixture, meeting },
      );
      await p.reload();
      await p.locator('.app-shell[data-ready=true]').waitFor();
      await p.getByRole('tab', { name: '내 여행', exact: true }).click();
      await (await recordMenu(p, '한 수 부탁하기'))
        .click();
      await p.locator('.advice-publish-places').waitFor();
      await shot(p, '01-preview');
      const [created] = await Promise.all([
        p.waitForResponse(
          (r) =>
            r.url().endsWith('/api/advice') && r.request().method() === 'POST',
        ),
        p
          .getByRole('button', {
            name: '이 내용으로 공유 링크 만들기',
            exact: true,
          })
          .click(),
      ]);
      assert.equal(created.status(), 201);
      id = (await created.json()).id;
      await p
        .getByRole('button', { name: '스토리 이미지', exact: true })
        .waitFor();
      const [download] = await Promise.all([
        p.waitForEvent('download'),
        p.getByRole('button', { name: '스토리 이미지', exact: true }).click(),
      ]);
      await download.saveAs(
        path.join(out, `${channel}-${size.name}-story.png`),
      );
      assert.equal(
        (await fs.readFile(await download.path())).subarray(1, 4).toString(),
        'PNG',
      );
      await closeManager();
      result.checks.push(
        'Publish safe snapshot and export real PNG without private meeting, time or title',
      );
      await g.goto(base + '/p/' + id);
      await g.locator('.advice-page[data-ready=true]').waitFor();
      assert.equal(await g.locator('.test-entry').count(), 0);
      assert(!(await g.locator('body').innerText()).includes('SECRET'));
      assert(!(await g.locator('body').innerText()).includes(meeting.title));
      assert(!(await g.locator('body').innerText()).includes(fixture.title));
      await shot(g, '02-public');
      await g
        .getByLabel('어느 장소를 바꿀까요?', { exact: true })
        .selectOption(stops[2].id);
      const candidate = g.locator('.advice-candidates button').first(),
        candidateName = await candidate.locator('strong').innerText();
      await candidate.click();
      await g.locator('.advice-panel').scrollIntoViewIfNeeded();
      await shot(g, '02b-proposal');
      await g
        .getByRole('button', { name: '이렇게 한 수 보태기', exact: true })
        .click();
      await g.locator('.advice-thanks').waitFor();
      await shot(g, '03-suggestion');
      result.checks.push(
        'Anonymous guest submits a concrete replacement without test password',
      );
      await manage();
      await p
        .getByRole('button', { name: '내 계획에서 검토', exact: true })
        .click();
      await p.getByLabel('코스 이름', { exact: true }).waitFor();
      await p.getByLabel('코스 편집 닫기', { exact: true }).click();
      await p.getByRole('button', { name: '변경 버리기', exact: true }).click();
      assert.deepEqual(
        (await state()).entries[0].plan.stops,
        fixture.plan.stops,
      );
      await manage();
      await p
        .getByRole('button', { name: '내 계획에서 검토', exact: true })
        .click();
      await p.getByLabel('코스 이름', { exact: true }).waitFor();
      await shot(p, '04-review');
      await p
        .getByRole('button', { name: '변경사항 저장', exact: true })
        .click();
      await p.locator('.saved-mission').waitFor();
      await p.waitForFunction(
        () =>
          JSON.parse(localStorage.getItem('gangwon-passport-v1')).entries[0]
            .plan.stops.length === 3 &&
          JSON.parse(localStorage.getItem('gangwon-passport-v1')).entries[0]
            .adviceReceipt === undefined,
      );
      const adopted = (await state()).entries[0];
      assert.equal(adopted.plan.originId, meeting.id);
      assert.equal(
        Date.parse(adopted.plan.departureAt),
        Date.parse(fixture.plan.departureAt),
      );
      assert.notEqual(adopted.plan.stops[2].placeId, stops[2].id);
      await g
        .getByRole('button', { name: '새 한 수 확인', exact: true })
        .click();
      await g
        .getByText('작성자가 계획에 반영했어요', { exact: true })
        .waitFor();
      await shot(g, '05-adopted');
      result.checks.push(
        'Cancel keeps original; save applies exact replacement and only then marks it adopted',
      );
      await p.getByRole('button', { name: '여행 완료', exact: true }).click();
      await p.getByRole('checkbox', { name: names[0], exact: true }).check();
      await p.getByRole('checkbox', { name: names[1], exact: true }).check();
      await p
        .getByRole('button', { name: '여행 완료로 기록', exact: true })
        .click();
      await (await recordMenu(p, '기록 수정')).waitFor();
      const completionDate = (await state()).entries[0].completedAt;
      await (await recordMenu(p, '기록 수정')).click();
      await p
        .getByLabel('기록 이름', { exact: true })
        .fill('다시 꺼내 보는 고성의 하루');
      await p.getByRole('checkbox', { name: names[1], exact: true }).uncheck();
      await p
        .getByRole('checkbox', {
          name: '복귀 여행을 마치고 돌아왔어요',
          exact: true,
        })
        .uncheck();
      await shot(p, '06-record-edit');
      await p
        .getByRole('button', { name: '기록 수정 저장', exact: true })
        .click();
      const corrected = (await state()).entries[0];
      assert.equal(corrected.completedAt, completionDate);
      assert.deepEqual(corrected.visitedPlaceIds, [stops[0].id]);
      assert(!corrected.stamps.includes('복귀'));
      await (await recordMenu(p, '새 여행으로 가져오기'))
        .click();
      await p.getByLabel('코스 이름', { exact: true }).waitFor();
      await p
        .getByRole('button', { name: '내 코스 저장', exact: true })
        .click();
      await p.locator('.saved-mission').first().waitFor();
      const copied = (await state()).entries.find(
        (e) => e.recordId !== fixture.recordId,
      );
      assert(copied);
      assert.deepEqual(copied.stamps, []);
      assert.equal(copied.completedAt, undefined);
      assert.equal(copied.adviceShareId, undefined);
      await p.locator('.record-tabs button').nth(1).click();
      await (await recordMenu(p, '계획으로 되돌리기'))
        .click();
      await shot(p, '07-restore');
      await p.getByRole('button', { name: '계획 유지', exact: true }).count();
      await p
        .getByRole('button', { name: '계획으로 되돌리기 확인', exact: true })
        .click();
      await (await recordMenu(p, '받은 한 수 보기'))
        .waitFor();
      const restored = (await state()).entries.find(
        (e) => e.recordId === fixture.recordId,
      );
      assert.equal(restored.completedAt, undefined);
      assert.equal(restored.visitedPlaceIds, undefined);
      assert.deepEqual(restored.stamps, []);
      assert.equal((await state()).activeOuting, null);
      result.checks.push(
        'Record edit preserves completion date; new copy preserves record; restoration keeps original itinerary and does not start outing',
      );
      await g
        .getByRole('link', {
          name: '이 공개안으로 내 여행 만들기',
          exact: true,
        })
        .click();
      await enterGuest(g);
      await g.locator('.test-entry[data-ready=true]').waitFor();
      assert(new URL(g.url()).searchParams.get('advice') === id);
      await enterGuest(g);
      await g
        .getByLabel('테스트 비밀번호', { exact: true })
        .fill(process.env.QA_PASSWORD || '1234');
      await g
        .getByRole('button', { name: '여행 시작하기', exact: true })
        .click();
      await g
        .getByRole('button', { name: '이 장소로 새 계획 편집', exact: true })
        .waitFor();
      await shot(g, '08-import');
      await g
        .getByRole('button', { name: '이 장소로 새 계획 편집', exact: true })
        .click();
      await g.getByLabel('코스 이름', { exact: true }).waitFor();
      assert(!(await g.locator('body').innerText()).includes('SECRET'));
      result.checks.push(
        'Public import survives password gate and opens a fresh private editor',
      );
      await g.route('**/api/public-advice/' + id + '?*', (r) =>
        r.request().method() === 'GET'
          ? r.fulfill({
              status: 410,
              json: { message: '공유 기간이 끝났어요.' },
            })
          : r.continue(),
      );
      await g.goto(base + '/p/' + id);
      await g
        .getByRole('button', { name: '내가 남긴 제안 삭제', exact: true })
        .click();
      await g
        .getByText('이 브라우저에서 남긴 제안을 삭제했어요.', { exact: true })
        .waitFor();
      const afterWithdraw = await (
        await owner.request.get(base + '/api/advice?id=' + id)
      ).json();
      assert.equal(afterWithdraw.suggestions.length, 0);
      result.checks.push(
        'Expired-screen simulation allows cookie-bound withdrawal with real D1 deletion',
      );
      assert.deepEqual(result.errors, []);
      result.status = 'passed';
    } catch (e) {
      result.status = 'failed';
      result.error = e.message;
      await shot(p, 'failure-owner').catch(() => {});
      await shot(g, 'failure-guest').catch(() => {});
      throw e;
    } finally {
      if (id)
        await owner.request.post(base + '/api/advice', {
          headers: { origin: base },
          data: { action: 'delete', id },
        });
      results.push(result);
      await fs.writeFile(
        path.join(out, 'results.json'),
        JSON.stringify(results, null, 2),
      );
      await owner.close();
      await guest.close();
    }
  }
  await browser.close();
}
console.log(
  JSON.stringify(
    results.map(({ channel, viewport, status, checks }) => ({
      channel,
      viewport,
      status,
      checks,
    })),
    null,
    2,
  ),
);
