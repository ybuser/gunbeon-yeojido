/** Reproducible, isolated browser QA. No user profile, provider payload or credential logging. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const base = process.env.QA_BASE_URL || 'http://localhost:3000';
const live = process.env.QA_LIVE !== '0';
const out = path.resolve(process.env.QA_OUT_DIR || '../reports/qa/browser');
await fs.mkdir(out, { recursive: true });
const dimensions = [
  { name: 'small', width: 360, height: 740, mobile: true },
  { name: 'large', width: 430, height: 932, mobile: true },
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'wide', width: 1920, height: 1080, mobile: false },
].filter(
  (d) =>
    !process.env.QA_CASES || process.env.QA_CASES.split(',').includes(d.name),
);
const channels = (process.env.QA_BROWSER_CHANNELS || 'chrome,msedge').split(
  ',',
);
const report = {
  startedAt: new Date().toISOString(),
  base,
  liveApis: live,
  deviceMode:
    'Desktop browsers with viewport/touch emulation; not physical phones or mobile OS browsers',
  cases: [],
};
const scrub = (s) =>
  String(s)
    .replace(/([?&](?:appkey|serviceKey)=)[^&\s]+/gi, '$1[redacted]')
    .slice(0, 1400);
const tab = (p, name) => p.getByRole('tab', { name, exact: true });
async function select(p, label, value) {
  await p.getByRole('combobox', { name: label, exact: true }).click();
  await p.getByRole('option', { name: value, exact: true }).click();
}
async function noOverflow(p, notes, label) {
  const m = await p.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  assert(
    m.document <= m.viewport + 1,
    `${label}: document overflows ${m.document}/${m.viewport}`,
  );
  notes.push(label + ' has no horizontal page overflow');
}
async function shot(p, file) {
  await p
    .waitForFunction(
      () =>
        [...document.images]
          .filter((i) => {
            const b = i.getBoundingClientRect();
            return b.bottom > 0 && b.top < innerHeight;
          })
          .every((i) => i.complete),
      null,
      { timeout: 8000 },
    )
    .catch(() => {});
  await p.screenshot({
    path: path.join(out, file),
    animations: 'disabled',
    fullPage: false,
  });
}
async function readyPlaces(p) {
  await p.locator('.journey-card').first().waitFor();
}
for (const channel of channels) {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(channel === 'msedge' && process.env.QA_EDGE_EXECUTABLE
        ? { executablePath: process.env.QA_EDGE_EXECUTABLE }
        : channel === 'chromium'
          ? {}
          : { channel }),
    });
  } catch (e) {
    report.cases.push({
      browser: channel,
      status: 'unavailable',
      error: scrub(e.message),
    });
    continue;
  }
  for (const size of dimensions) {
    const result = {
      browser: channel,
      version: browser.version(),
      viewport: { width: size.width, height: size.height },
      touchEmulated: size.mobile,
      name: size.name,
      checks: [],
      screenshots: [],
      apiRequests: {},
      pageErrors: [],
      status: 'running',
    };
    const ctx = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.mobile,
      hasTouch: size.mobile,
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      reducedMotion: 'reduce',
    });
    // Restrict the private Sites bearer to this exact first-party origin.
    if (process.env.QA_AUTH_TOKEN)
      await ctx.route(
        (u) => u.origin === new URL(base).origin,
        (route) =>
          route.continue({
            headers: {
              ...route.request().headers(),
              'OAI-Sites-Authorization': 'Bearer ' + process.env.QA_AUTH_TOKEN,
            },
          }),
      );
    if (!live) {
      await ctx.route('**/api/places?*', (r) =>
        r.fulfill({
          status: 503,
          json: { mode: 'unavailable', places: [], error: 'QA_KEYLESS' },
        }),
      );
      await ctx.route('**/api/accessibility?*', (r) =>
        r.fulfill({ status: 503, json: { mode: 'unavailable', items: [] } }),
      );
      await ctx.route('**/api/weather?*', (r) =>
        r.fulfill({ status: 503, json: { mode: 'unavailable' } }),
      );
      await ctx.route('**/api/status', (r) =>
        r.fulfill({ json: { kakaoMapKey: '' } }),
      );
    }
    const p = await ctx.newPage();
    p.setDefaultTimeout(20000);
    p.on('pageerror', (e) => result.pageErrors.push(scrub(e.message)));
    p.on('request', (r) => {
      const u = new URL(r.url());
      if (u.origin === new URL(base).origin && u.pathname.startsWith('/api/'))
        result.apiRequests[u.pathname] =
          (result.apiRequests[u.pathname] || 0) + 1;
    });
    try {
      await p.goto(new URL('/login', base).href);
      await p.locator('.test-entry[data-ready="true"]').waitFor();
      await p
        .getByLabel('테스트 비밀번호', { exact: true })
        .fill(process.env.QA_TEST_PASSWORD || '1234');
      const placeResponse = p.waitForResponse(
        (r) => new URL(r.url()).pathname === '/api/places',
      );
      await p
        .getByRole('button', { name: '여행 시작하기', exact: true })
        .click();
      await p.locator('.app-shell[data-ready="true"]').waitFor();
      await tab(p, '둘러보기').click();
      const response = await placeResponse;
      const responseData = await response.json();
      if (live)
        assert.equal(
          responseData.mode,
          'live',
          'TourAPI must actually be live in a live audit',
        );
      result.checks.push(
        live ? 'Live TourAPI response received' : 'Explicit keyless fallback',
      );
      await readyPlaces(p);
      await noOverflow(p, result.checks, 'Home');
      await tab(p, '그룹').click();
      await p.goBack();
      await p
        .getByRole('heading', {
          name: '강원에서 어떤 하루를 보낼까요?',
          exact: true,
        })
        .waitFor();
      assert.equal(new URL(p.url()).origin, new URL(base).origin);
      result.checks.push('Browser Back returns to the previous app screen');
      assert(
        await p
          .locator('.journey-margin > span:last-child')
          .first()
          .isVisible(),
        'Visit condition hidden at this width',
      );
      const homeShot = channel + '-' + size.name + '-home.png';
      await shot(p, homeShot);
      result.screenshots.push(homeShot);
      await p
        .getByRole('button', { name: '내 조건으로 미션 찾기', exact: true })
        .click();
      await p.getByRole('dialog').waitFor();
      await p.keyboard.press('Escape');
      // The production sheet keeps its DOM until its exit transition finishes.
      await p.getByRole('dialog').waitFor({ state: 'hidden' });
      await p
        .getByRole('button', { name: '내 조건으로 미션 찾기', exact: true })
        .click();
      await p.getByRole('button', { name: '다음', exact: true }).click();
      await p.getByRole('radio', { name: '8시간', exact: true }).check();
      await p.getByRole('button', { name: '다음', exact: true }).click();
      await select(p, '편안한 전체 도보 시간', '60분');
      const editorShot = channel + '-' + size.name + '-editor.png';
      await shot(p, editorShot);
      result.screenshots.push(editorShot);
      await p
        .getByRole('button', { name: '이 조건으로 미션 보기', exact: true })
        .click();
      await p.locator('.place-row').first().waitFor();
      await noOverflow(p, result.checks, 'Mission');
      const before = await p.locator('.place-name').allTextContents();
      assert(
        before.length >= 2 && before.length <= 4,
        'A mission contains 2–4 stops',
      );
      if (live) {
        const pins = p.locator('.map-place-pin');
        await pins.first().waitFor();
        const boxes = await pins.evaluateAll((es) =>
          es.map((e) => ({
            text: e.textContent,
            rect: e.getBoundingClientRect().toJSON(),
          })),
        );
        assert(boxes.length >= 2, 'Kakao custom pins rendered');
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++)
            assert(
              Math.abs(boxes[i].rect.x - boxes[j].rect.x) > 4 ||
                Math.abs(boxes[i].rect.y - boxes[j].rect.y) > 4,
              'Map pins overlap completely',
            );
        await pins.first().click();
        await p.getByRole('dialog').waitFor();
        await p.getByRole('button', { name: '닫기', exact: true }).click();
        result.checks.push(
          'Kakao tiles/pins loaded; pin opens detail and closes',
        );
      } else {
        assert(
          await p
            .getByRole('img', {
              name: '선택한 공개 거점과 미션 장소의 상대적 위치 개략도',
            })
            .isVisible(),
        );
        result.checks.push('Explicit geographic fallback');
      }
      const mapShot = channel + '-' + size.name + '-mission.png';
      await p.evaluate(() => scrollTo(0, 0));
      await shot(p, mapShot);
      result.screenshots.push(mapShot);
      await p
        .getByRole('button', { name: '이 미션 내 여행에 담기', exact: true })
        .click();
      await tab(p, '내 여행').click();
      await p.locator('.saved-mission').first().waitFor();
      const saved = await p.evaluate(() =>
        JSON.parse(localStorage.getItem('gangwon-passport-v1')),
      );
      assert.equal(saved.entries.length, 1);
      assert(saved.entries[0].plan?.stops.length >= 2);
      assert(!JSON.stringify(saved).includes('returnAt'));
      await p.reload();
      await p.locator('.app-shell[data-ready="true"]').waitFor();
      await tab(p, '둘러보기').click();
      await readyPlaces(p);
      await tab(p, '내 여행').click();
      await p
        .getByRole('button', { name: '저장한 장소 다시 보기', exact: true })
        .click();
      await p.locator('.place-row').first().waitFor();
      assert.deepEqual(
        await p.locator('.place-name').allTextContents(),
        before,
        'Saved itinerary survives reload and changed default duration',
      );
      result.checks.push(
        'Three-step edit, save, reload and exact place order restore',
      );
      if (['small', 'desktop'].includes(size.name)) {
        await tab(p, '내 여행').click();
        await p
          .getByRole('button', { name: '동행 브리핑', exact: true })
          .click();
        await p
          .getByRole('button', { name: '우리 가족 여행안 보기', exact: true })
          .click();
        await p.locator('.family-route-preview b').first().waitFor();
        await noOverflow(p, result.checks, 'Family briefing');
        const familyShot = channel + '-' + size.name + '-family.png';
        await p.evaluate(() => scrollTo(0, 0));
        await shot(p, familyShot);
        result.screenshots.push(familyShot);
        result.checks.push(
          'Independent parent briefing; server group invitation is covered in groups QA',
        );
        await tab(p, '내 여행').click();
        await p.getByRole('button', { name: /휴가회수 레이더/ }).click();
        const seed = p.getByRole('button', {
          name: '확인 준비를 휴가 씨앗으로 기록',
          exact: true,
        });
        assert(await seed.isDisabled(), 'Target trip required');
        for (const checkbox of await p.getByRole('checkbox').all())
          await checkbox.check();
        await p
          .getByRole('combobox', { name: '준비 기록을 남길 여행', exact: true })
          .click();
        await p.getByRole('option').first().click();
        await seed.click();
        await tab(p, '내 여행').click();
        assert.equal(
          await p.locator('.saved-mission').count(),
          1,
          'Preparation stays under plans',
        );
        await p.getByRole('button', { name: '여행 완료', exact: true }).click();
        await p
          .getByRole('button', { name: '여행 완료로 기록', exact: true })
          .click();
        await p.getByRole('button', { name: /^여행 기록/ }).click();
        await p.locator('.saved-mission').first().waitFor();
        await p.getByRole('button', { name: '공유 카드', exact: true }).click();
        await p.getByRole('dialog').waitFor();
        const download = p.waitForEvent('download');
        await p
          .getByRole('button', { name: '카드 이미지 저장', exact: true })
          .click();
        const d = await download;
        const temp = await d.path();
        const svg = await fs.readFile(temp, 'utf8');
        assert(svg.includes('<svg'));
        assert(!/returnAt|originId|placeId/.test(svg));
        await p.getByRole('button', { name: '닫기', exact: true }).click();
        result.checks.push(
          'Explicit preparation target; preparation/visit split; SVG share download',
        );
      }
      // Fail both list and saved-place lookup; never replace the preserved itinerary.
      if (live && size.name === 'small') {
        await p.route('**/api/places/resolve', (r) =>
          r.fulfill({ status: 503, json: { places: [], error: 'QA_FAILURE' } }),
        );
        await p.route('**/api/places?*', (r) =>
          r.fulfill({
            status: 503,
            json: { mode: 'unavailable', places: [], error: 'QA_FAILURE' },
          }),
        );
        await p.reload();
        await p.locator('.app-shell[data-ready="true"]').waitFor();
        await tab(p, '둘러보기').click();
        await tab(p, '둘러보기').click();
        await readyPlaces(p);
        await tab(p, '내 여행').click();
        await p.getByRole('button', { name: /^여행 기록/ }).click();
        await p
          .getByRole('button', { name: '저장한 장소 다시 보기', exact: true })
          .click();
        await p
          .getByText(
            '저장한 장소 정보를 연결하지 못했습니다. 다른 장소로 바꾸지 않았어요.',
            { exact: false },
          )
          .waitFor();
        result.checks.push(
          'API failure preserves saved refs and shows explicit unavailable state',
        );
      }
      assert.equal(
        result.pageErrors.length,
        0,
        'Browser runtime errors: ' + result.pageErrors.join(' | '),
      );
      result.status = 'passed';
    } catch (e) {
      result.status = 'failed';
      result.error = scrub(e.message);
      await shot(p, channel + '-' + size.name + '-failure.png').catch(() => {});
    } finally {
      await ctx.close();
      report.cases.push(result);
      await fs.writeFile(
        path.join(out, 'results.json'),
        JSON.stringify(report, null, 2) + '\n',
      );
      console.log(
        JSON.stringify({
          browser: channel,
          case: size.name,
          status: result.status,
          error: result.error,
          checks: result.checks.length,
        }),
      );
    }
  }
  await browser.close();
}
report.completedAt = new Date().toISOString();
report.passed = report.cases.filter((c) => c.status === 'passed').length;
report.failed = report.cases.filter((c) => c.status !== 'passed').length;
await fs.writeFile(
  path.join(out, 'results.json'),
  JSON.stringify(report, null, 2) + '\n',
);
if (report.failed) process.exitCode = 1;
