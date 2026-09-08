import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const base = process.env.QA_BASE_URL || 'http://localhost:3000',
  out = path.resolve(process.env.QA_OUT_DIR || '../tmp/qa/guide-page');
await fs.mkdir(out, { recursive: true });
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
  for (const size of [
    { width: 360, height: 740 },
    { width: 1440, height: 900 },
  ]) {
    const ctx = await browser.newContext({
      viewport: size,
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      isMobile: size.width < 500,
      hasTouch: size.width < 500,
    });
    const p = await ctx.newPage();
    p.setDefaultTimeout(25000);
    const result = {
      channel,
      width: size.width,
      status: 'running',
      checks: [],
      errors: [],
    };
    p.on('pageerror', (e) =>
      result.errors.push(
        e.message.replace(
          /([?&](?:appkey|serviceKey)=)[^&\s]+/gi,
          '$1[redacted]',
        ),
      ),
    );
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
    let photoCalls = 0;
    p.on('request', (r) => {
      if (new URL(r.url()).pathname === '/photos/cheorwon-labor.jpg')
        photoCalls++;
    });
    try {
      await p.goto(base + '/guide');
      await p.locator('.test-entry[data-ready=true]').waitFor();
      await p.getByLabel('테스트 비밀번호').fill('1234');
      await p
        .getByRole('button', { name: '여행 시작하기', exact: true })
        .click();
      await p.locator('.usage-guide').waitFor();
      assert.equal(new URL(p.url()).pathname, '/guide');
      assert.equal(await p.locator('.guide-steps section').count(), 8);
      for (const img of await p.locator('.guide-steps img').all()) {
        await img.scrollIntoViewIfNeeded();
        await img.evaluate((i) => i.decode());
        assert.ok(await img.evaluate((i) => i.naturalWidth > 0));
      }
      await p.evaluate(() => scrollTo(0, 0));
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await p.screenshot({
        path: path.join(out, channel + '-' + size.width + '-guide.png'),
        animations: 'disabled',
      });
      result.checks.push(
        'Guide login returns to requested page; all eight real screenshots load; responsive layout',
      );
      await p
        .getByRole('link', { name: '군번여지도로 돌아가기', exact: true })
        .click();
      await p.locator('.app-shell[data-ready=true]').waitFor();
      await p.getByRole('tab', { name: '둘러보기', exact: true }).click();
      await p.locator('.journey-card').first().waitFor();
      await p
        .getByRole('button', { name: '사진 출처와 이용조건', exact: true })
        .click();
      await p.locator('.photo-credit-sheet').waitFor();
      const target = p.locator('.photo-credit-sheet img').first();
      await target.scrollIntoViewIfNeeded();
      await p.waitForFunction(() => {
        const i = document.querySelector('.photo-credit-sheet img');
        return (
          i instanceof HTMLImageElement &&
          !!i.currentSrc &&
          i.complete &&
          i.naturalWidth > 0
        );
      });
      assert.equal(photoCalls, 1);
      await p.keyboard.press('Escape');
      await p.locator('.photo-credit-sheet').waitFor({ state: 'hidden' });
      await p
        .getByRole('button', { name: '사진 출처와 이용조건', exact: true })
        .click();
      await p.waitForFunction(() => {
        const i = document.querySelector('.photo-credit-sheet img');
        return (
          i instanceof HTMLImageElement &&
          !!i.currentSrc &&
          i.complete &&
          i.naturalWidth > 0
        );
      });
      assert.equal(photoCalls, 1);
      result.checks.push(
        'Authenticated local photo fetched once across repeated opening via page-memory reuse',
      );
      assert.equal(result.errors.length, 0);
      result.status = 'passed';
    } catch (e) {
      result.status = 'failed';
      result.error = e.message;
      await p
        .screenshot({
          path: path.join(out, channel + '-' + size.width + '-failure.png'),
        })
        .catch(() => {});
    }
    results.push(result);
    await ctx.close();
  }
  await browser.close();
}
await fs.writeFile(
  path.join(out, 'results.json'),
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results));
if (results.some((r) => r.status !== 'passed')) process.exitCode = 1;
