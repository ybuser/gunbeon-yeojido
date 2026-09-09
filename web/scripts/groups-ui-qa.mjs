import { enterGuest, recordMenu } from './qa-navigation.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const base = process.env.QA_BASE_URL || 'http://localhost:3000';
const out = path.resolve(process.env.QA_OUT_DIR || '../tmp/qa/groups-ui');
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
  base,
  startedAt: new Date().toISOString(),
  deviceMode:
    'Desktop Chrome/Edge viewport and touch emulation; not physical phones',
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
      viewport: size,
      isMobile: size.width < 500,
      hasTouch: size.width < 500,
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      reducedMotion: 'reduce',
    });
    const p = await ctx.newPage();
    p.setDefaultTimeout(25000);
    const result = {
      channel,
      version: browser.version(),
      size,
      checks: [],
      errors: [],
      screenshots: [],
      status: 'running',
    };
    let groups = [];
    const apiCounts = {};
    p.on('pageerror', (e) =>
      result.errors.push(
        e.message.replace(
          /([?&](?:appkey|serviceKey)=)[^&\s]+/gi,
          '$1[redacted]',
        ),
      ),
    );
    p.on('request', (r) => {
      const u = new URL(r.url());
      if (u.origin === new URL(base).origin && u.pathname.startsWith('/api/'))
        apiCounts[u.pathname] = (apiCounts[u.pathname] || 0) + 1;
    });
    // Daily quota is exhausted. Exercise explicit failure handling without spending more live TourAPI calls.
    await ctx.route('**/api/places?*', (r) =>
      r.fulfill({
        status: 503,
        json: {
          mode: 'unavailable',
          places: [],
          error: 'DAILY_QUOTA_EXCEEDED',
          message:
            '관광공사 일일 호출 한도를 초과했습니다. 현재 화면에서는 확인된 기본 장소를 사용합니다.',
        },
      }),
    );
    async function shot(name) {
      if (name === 'group-plans')
        await p.locator('.group-share-sheet').waitFor({ state: 'hidden' });
      const close = p.getByRole('button', { name: '알림 닫기', exact: true });
      if (await close.count()) await close.click();
      await p.evaluate(() => scrollTo(0, 0));
      await p.screenshot({
        path: path.join(out, `${channel}-${size.name}-${name}.png`),
        animations: 'disabled',
      });
      result.screenshots.push(name);
      const width = await p.evaluate(
        () => document.documentElement.scrollWidth,
      );
      assert(width <= size.width + 1, `${name} horizontal overflow ${width}`);
    }
    async function post(body) {
      return p.evaluate(async (body) => {
        let r = await fetch('/api/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        return { status: r.status, data: await r.json() };
      }, body);
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
      await p
        .getByRole('heading', { name: '우리의 다음 여행', exact: true })
        .waitFor();
      assert.equal(await p.locator('.main-nav [role=tab]').count(), 5);
      await shot('home-empty');
      await tab(p, '둘러보기').click();
      await p.locator('.journey-card').first().waitFor();
      assert.equal(await p.locator('input[type=datetime-local]').count(), 0);
      const firstCount = apiCounts['/api/places'];
      await tab(p, '홈').click();
      await tab(p, '둘러보기').click();
      assert.equal(apiCounts['/api/places'], firstCount);
      result.checks.push(
        'Date-free recommendations; page navigation reuses list response',
      );
      await shot('browse');
      await tab(p, '그룹').click();
      await p
        .getByRole('button', { name: '그룹 만들기', exact: true })
        .first()
        .click();
      await p.getByLabel('그룹에서 사용할 이름').fill('테스트 여행자');
      await p
        .getByLabel('그룹 이름', { exact: true })
        .fill('우리 가족의 가을 여행');
      await p
        .getByLabel('함께하는 사람', { exact: true })
        .selectOption('family');
      await p
        .locator('.group-form')
        .getByRole('button', { name: '그룹 만들기', exact: true })
        .click();
      await p
        .getByRole('heading', { name: '우리 가족의 가을 여행', exact: true })
        .waitFor();
      const list = await p.evaluate(() =>
        fetch('/api/groups').then((r) => r.json()),
      );
      groups.push(list.groups[0].id);
      await p
        .getByRole('button', { name: '새 그룹 여행', exact: true })
        .click();
      await p
        .getByLabel('코스 이름', { exact: true })
        .fill('철원에서 함께 보내는 토요일');
      await p
        .getByRole('button', { name: '공유 범위 확인', exact: true })
        .click();
      await p
        .getByRole('button', { name: '이 그룹에 공유', exact: true })
        .click();
      await p.locator('.group-plan-card').first().waitFor();
      assert.match(await p.locator('.group-plan-card').innerText(), /0곳/);
      result.checks.push('Create family group and empty itinerary through UI');
      await p
        .getByRole('button', { name: '일정 보기·수정', exact: true })
        .click();
      await p
        .getByLabel('코스 이름', { exact: true })
        .fill('철원, 느긋하게 만나는 하루');
      await p
        .getByRole('button', { name: '공유 범위 확인', exact: true })
        .click();
      await p
        .getByRole('button', { name: '변경사항 공유', exact: true })
        .click();
      await p
        .getByRole('heading', {
          name: '철원, 느긋하게 만나는 하루',
          exact: true,
        })
        .waitFor();
      await shot('group-plans');
      await p.getByRole('button', { name: '멤버·초대', exact: true }).click();
      await p.getByRole('button', { name: '초대 만들기', exact: true }).click();
      await p.locator('.invite-tools input').waitFor();
      assert.equal(
        (await p.locator('.invite-tools input').inputValue()).length,
        48,
      );
      result.checks.push('Group edit saved and invitation generated');
      const inviteCode = await p.locator('.invite-tools input').inputValue();
      const guestContext = await browser.newContext({
        viewport: size,
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
      });
      const guest = await guestContext.newPage();
      await guestContext.route('**/api/places?*', (r) =>
        r.fulfill({
          status: 503,
          json: {
            mode: 'unavailable',
            places: [],
            error: 'DAILY_QUOTA_EXCEEDED',
          },
        }),
      );
      await guest.goto(base + '/?join=' + inviteCode + '#groups');
      await enterGuest(guest);
      await guest.locator('.test-entry[data-ready="true"]').waitFor();
      await enterGuest(guest);
      await guest.getByLabel('테스트 비밀번호', { exact: true }).fill('1234');
      await guest
        .getByRole('button', { name: '여행 시작하기', exact: true })
        .click();
      await guest.getByLabel('그룹에서 사용할 이름').fill('동행 테스트');
      await guest
        .getByRole('button', { name: '초대 확인', exact: true })
        .click();
      await guest.locator('.group-join-preview').waitFor();
      assert.match(
        await guest.locator('.group-join-preview').innerText(),
        /우리 가족의 가을 여행/,
      );
      await guest
        .getByRole('button', { name: '이 그룹에 참여', exact: true })
        .click();
      await guest
        .getByRole('heading', {
          name: '철원, 느긋하게 만나는 하루',
          exact: true,
        })
        .waitFor();
      await guestContext.close();
      result.checks.push(
        'Invitation survives test login; another browser session joins and reads the same plan',
      );

      await p.getByRole('button', { name: '내 그룹', exact: true }).click();
      await p.getByRole('button', { name: '그룹 만들기', exact: true }).click();
      await p
        .getByLabel('그룹 이름', { exact: true })
        .fill('친구들과 고성 바다');
      await p
        .getByLabel('함께하는 사람', { exact: true })
        .selectOption('friends');
      await p
        .locator('.group-form')
        .getByRole('button', { name: '그룹 만들기', exact: true })
        .click();
      await p
        .getByRole('heading', { name: '친구들과 고성 바다', exact: true })
        .waitFor();
      const list2 = await p.evaluate(() =>
        fetch('/api/groups').then((r) => r.json()),
      );
      groups = list2.groups.map((g) => g.id);
      await tab(p, '홈').click();
      assert.equal(await p.locator('.group-tile').count(), 2);
      await p.getByRole('button', { name: '새 여행', exact: true }).click();
      await p
        .getByLabel('코스 이름', { exact: true })
        .fill('다음 휴가에 채울 나의 일정');
      await p
        .getByRole('button', { name: '내 코스 저장', exact: true })
        .click();
      await tab(p, '홈').click();
      await p.locator('.day-passport-cover').waitFor();
      await shot('home');
      await p.locator('.group-tile').filter({ hasText: '우리 가족' }).click();
      await p
        .getByRole('heading', {
          name: '철원, 느긋하게 만나는 하루',
          exact: true,
        })
        .waitFor();
      result.checks.push(
        'Home shows personal upcoming plan and two groups; group opens its own plans',
      );
      await p
        .getByRole('button', { name: '일정 보기·수정', exact: true })
        .click();
      await shot('editor');
      await p
        .getByRole('button', { name: '코스 편집 닫기', exact: true })
        .click();
      await p.getByRole('alertdialog').waitFor();
      await p.getByRole('button', { name: '계속 편집', exact: true }).click();
      result.checks.push('Group draft close confirmation retains changes');
      result.status = 'passed';
      assert.equal(result.errors.length, 0);
    } catch (e) {
      result.status = 'failed';
      result.error = e.message;
      await p
        .screenshot({
          path: path.join(out, `${channel}-${size.name}-failure.png`),
        })
        .catch(() => {});
      console.log(channel, size.name, result.error);
    } finally {
      for (const id of groups)
        await post({ action: 'deleteGroup', groupId: id }).catch(() => {});
      report.cases.push(result);
      await ctx.close();
      await fs.writeFile(
        path.join(out, 'report.json'),
        JSON.stringify(report, null, 2),
      );
    }
  }
  await browser.close();
}
console.log(
  JSON.stringify(
    report.cases.map(({ channel, size, status, error }) => ({
      channel,
      size: size.name,
      status,
      error,
    })),
    null,
    2,
  ),
);
if (report.cases.some((c) => c.status !== 'passed')) process.exitCode = 1;
