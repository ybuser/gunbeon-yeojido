/**
 * Isolated group API integration QA. No UI, tourism API, or existing group writes.
 * Run from the repo root or web directory:
 *   node /tmp/gunbeon-groups-api-qa.mjs
 * Optional: QA_BASE_URL, QA_WEB_DIR, QA_OUT_FILE, QA_REQUEST_TIMEOUT_MS.
 * Only test-created groups are deleted. Profile rows are retained because the
 * public API does not provide profile deletion. Invite/cookie values stay in RAM.
 */
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let playwright;
for (const anchor of [
  import.meta.url,
  pathToFileURL(
    path.resolve(process.env.QA_WEB_DIR || process.cwd(), 'package.json'),
  ),
  pathToFileURL(path.resolve(process.cwd(), 'web/package.json')),
]) {
  try {
    playwright = createRequire(anchor)('playwright');
    break;
  } catch {
    /* Try the next local dependency location; never install packages. */
  }
}
if (!playwright)
  throw new Error('Playwright not found; set QA_WEB_DIR to the web directory.');

const target = new URL(process.env.QA_BASE_URL || 'http://localhost:3000');
if (target.username || target.password)
  throw new Error('QA_BASE_URL must not contain credentials.');
const base = target.origin;
const runId = randomUUID().slice(0, 8);
const prefix = `qa-api-${runId}-`;
const output = path.resolve(
  process.env.QA_OUT_FILE || '/tmp/gunbeon-groups-api-qa-results.json',
);
const timeout = Number(process.env.QA_REQUEST_TIMEOUT_MS || 20000);
const contexts = {};
const created = [];
let requestCount = 0;
const report = {
  startedAt: new Date().toISOString(),
  base,
  mode: 'Playwright APIRequestContext; three isolated cookie jars, no browser UI or device claim',
  scope: 'Group API only; no tourism/weather/map API calls',
  runId,
  status: 'running',
  cases: [],
  cleanup: [],
};
class CheckFailure extends Error {}
function check(condition, message) {
  // Do not use assertion diffs: they can print invitation tokens or payloads.
  if (!condition) throw new CheckFailure(message);
}
function equalKeys(value, expected, label) {
  check(
    value && typeof value === 'object' && !Array.isArray(value),
    `${label}: object required`,
  );
  check(
    Object.keys(value).sort().join('|') === [...expected].sort().join('|'),
    `${label}: unexpected field set`,
  );
}
function recordOf(group, id) {
  const result = group?.plans?.find((p) => p.id === id);
  check(Boolean(result), 'Expected plan missing from group response');
  return result;
}
const copy = (value) => structuredClone(value);
async function step(name, task) {
  const started = Date.now();
  try {
    await task();
    report.cases.push({
      name,
      status: 'passed',
      durationMs: Date.now() - started,
    });
    console.log(`PASS ${name}`);
  } catch (error) {
    const message =
      error instanceof CheckFailure
        ? error.message
        : 'Unexpected local QA error (raw details suppressed)';
    report.cases.push({
      name,
      status: 'failed',
      message,
      durationMs: Date.now() - started,
    });
    console.log(`FAIL ${name}: ${message}`);
    throw new CheckFailure(message);
  }
}
async function call(
  actor,
  label,
  {
    method = 'POST',
    endpoint = '/api/groups',
    body,
    raw,
    status = 200,
    origin = base,
    json = true,
    cacheRequired = true,
  } = {},
) {
  requestCount += 1;
  let response;
  try {
    response = await contexts[actor].fetch(endpoint, {
      method,
      timeout,
      maxRedirects: 0,
      headers:
        method === 'POST'
          ? { 'Content-Type': 'application/json', Origin: origin }
          : {},
      ...(method === 'POST' ? { data: raw !== undefined ? raw : body } : {}),
    });
  } catch {
    throw new CheckFailure(
      `${label}: transport failure (request details suppressed)`,
    );
  }
  const http = response.status();
  const accepted = Array.isArray(status) ? status : [status];
  if (!accepted.includes(http)) {
    await response.dispose();
    throw new CheckFailure(
      `${label}: HTTP ${http}; expected ${accepted.join('/')}`,
    );
  }
  let data = null;
  if (json) {
    try {
      data = await response.json();
    } catch {
      await response.dispose();
      throw new CheckFailure(`${label}: non-JSON response`);
    }
  }
  const cache = response.headers()['cache-control'] || '';
  await response.dispose();
  if (cacheRequired)
    check(/no-store/.test(cache), `${label}: response must be no-store`);
  return { status: http, data };
}
const post = (actor, label, body, status = 200) =>
  call(actor, label, { body, status });
const get = (actor, label, groupId, status = 200) =>
  call(actor, label, {
    method: 'GET',
    endpoint:
      '/api/groups' + (groupId ? `?id=${encodeURIComponent(groupId)}` : ''),
    status,
  });
async function createGroup(actor, kind, suffix) {
  const name = prefix + suffix;
  const { data } = await post(
    actor,
    `Create ${kind} group`,
    {
      action: 'create',
      kind,
      name,
      nickname: `QA-${actor}-${runId}`,
    },
    201,
  );
  check(
    data.group?.name === name && data.group?.kind === kind,
    'Created group identity mismatch',
  );
  check(
    typeof data.group?.id === 'string' &&
      data.group.ownerId === data.profile?.id,
    'Created group owner mismatch',
  );
  created.push({ actor, id: data.group.id, name, deleted: false });
  return data;
}
async function invite(actor, groupId) {
  const { data } = await post(actor, 'Create invitation', {
    action: 'invite',
    groupId,
  });
  check(
    typeof data.code === 'string' && /^[a-f0-9]{48}$/.test(data.code),
    'Invalid invitation shape',
  );
  check(
    Number.isFinite(Date.parse(data.expiresAt)),
    'Invalid invitation expiry',
  );
  return data.code;
}
async function deleteOwned(actor, groupId) {
  const resource = created.find((g) => g.actor === actor && g.id === groupId);
  check(
    resource && resource.name.startsWith(prefix),
    'Refusing to delete a non-test group',
  );
  await post(actor, 'Delete owned test group', {
    action: 'deleteGroup',
    groupId,
  });
  resource.deleted = true;
}
function publicPlan(title = 'QA 공공 관광 계획') {
  return {
    title,
    region: '철원군',
    departureAt: '2026-09-12T10:00:00+09:00',
    transport: 'car',
    meetingId: '',
    stops: [{ placeId: `qa-public-${runId}`, stay: 30, walk: 10 }],
    manualPlaces: [],
  };
}
function checkSharedWhitelist(plan, manualExpected) {
  equalKeys(
    plan,
    [
      'title',
      'region',
      'departureAt',
      'transport',
      'meetingId',
      'stops',
      'manualPlaces',
    ],
    'Shared plan',
  );
  for (const stop of plan.stops)
    equalKeys(stop, ['placeId', 'stay', 'walk'], 'Shared stop');
  check(
    plan.manualPlaces.length === (manualExpected ? 1 : 0),
    'Manual-place inclusion mismatch',
  );
  for (const manual of plan.manualPlaces)
    equalKeys(
      manual,
      ['id', 'title', 'address', 'lat', 'lon', 'sigungu', 'category'],
      'Shared manual place',
    );
  const forbidden = new Set([
    'returnAt',
    'timeBudgetMinutes',
    'activeOuting',
    'startedAt',
    'completedAt',
    'stamps',
    'token_hash',
    'secretMarker',
    'privateNote',
  ]);
  const scan = (item) => {
    if (!item || typeof item !== 'object') return;
    for (const [key, value] of Object.entries(item)) {
      check(!forbidden.has(key), `Non-shared field retained: ${key}`);
      scan(value);
    }
  };
  scan(plan);
}

try {
  for (const actor of ['owner', 'member', 'outsider']) {
    contexts[actor] = await playwright.request.newContext({
      baseURL: base,
      timeout,
    });
  }
  await step('test gate and three isolated sessions', async () => {
    for (const actor of Object.keys(contexts)) {
      await get(actor, 'Unauthenticated gate', undefined, 401);
      await call(actor, 'Test password entry', {
        endpoint: '/api/test-access',
        body: { password: '1234' },
      });
      const { data } = await get(actor, 'Fresh isolated group state');
      check(
        data.profile === null && data.groups?.length === 0,
        'Fresh context inherited another profile',
      );
    }
  });

  let alpha,
    beta,
    ownerId,
    memberId,
    outsiderId,
    oldInvite,
    ownerPlanId,
    memberPlanId;
  await step(
    'create family and friends groups under distinct profiles',
    async () => {
      const a = await createGroup('owner', 'family', '가족');
      const b = await createGroup('outsider', 'friends', '친구');
      alpha = a.group.id;
      beta = b.group.id;
      ownerId = a.profile.id;
      outsiderId = b.profile.id;
      check(
        ownerId !== outsiderId,
        'Isolated contexts share a profile identity',
      );
      check(
        a.group.memberCount === 1 && b.group.memberCount === 1,
        'Fresh group member count mismatch',
      );
      check(
        (await get('owner', 'Owner group list')).data.groups.length === 1,
        'Owner list contains another profile group',
      );
      check(
        (await get('outsider', 'Outsider group list')).data.groups.length === 1,
        'Outsider list contains another profile group',
      );
    },
  );
  await step(
    'cross-context invitation preview, join, and idempotent membership',
    async () => {
      oldInvite = await invite('owner', alpha);
      const preview = (
        await post('member', 'Invitation preview', {
          action: 'preview',
          code: oldInvite,
        })
      ).data.invitation;
      equalKeys(preview, ['id', 'name', 'kind'], 'Invitation preview');
      check(
        preview.id === alpha && preview.kind === 'family',
        'Preview targets the wrong group',
      );
      const joined = (
        await post('member', 'Join invitation', {
          action: 'join',
          code: oldInvite,
          nickname: `QA-member-${runId}`,
        })
      ).data;
      memberId = joined.profile?.id;
      check(
        memberId && memberId !== ownerId && memberId !== outsiderId,
        'Member context has no distinct identity',
      );
      check(joined.group?.memberCount === 2, 'Joined member absent from group');
      const again = (
        await post('member', 'Repeat join', { action: 'join', code: oldInvite })
      ).data;
      check(
        again.group.memberCount === 2,
        'Repeated invitation created duplicate membership',
      );
      const ownerView = (await get('owner', 'Owner observes member', alpha))
        .data.group;
      check(
        ownerView.members.some((m) => m.id === memberId),
        'Other context cannot observe joined member',
      );
    },
  );
  await step('outsider and ordinary-member permission denials', async () => {
    await get('outsider', 'Outsider cannot read family group', alpha, 403);
    await get('owner', 'Owner cannot read outsider group', beta, 403);
    for (const action of ['invite', 'revoke', 'deleteGroup']) {
      await post(
        'member',
        `Member cannot ${action}`,
        { action, groupId: alpha },
        403,
      );
      await post(
        'outsider',
        `Outsider cannot ${action}`,
        { action, groupId: alpha },
        403,
      );
    }
    await post(
      'member',
      'Member cannot remove another member',
      { action: 'remove', groupId: alpha, userId: outsiderId },
      403,
    );
    await post(
      'owner',
      'Owner must delete rather than leave',
      { action: 'leave', groupId: alpha },
      400,
    );
    await post(
      'outsider',
      'Outsider cannot save a plan',
      { action: 'savePlan', groupId: alpha, plan: publicPlan() },
      403,
    );
    // Vinext may reject cross-origin POST before the route, with a non-JSON 403.
    await call('owner', 'Wrong-origin request rejected', {
      body: { action: 'invite', groupId: alpha },
      origin: 'https://invalid.example',
      status: 403,
      json: false,
      cacheRequired: false,
    });
  });
  await step('explicit manual sharing and server field whitelist', async () => {
    const manualId = `manual:qa-${runId}`;
    const plan = {
      ...publicPlan(),
      meetingId: manualId,
      stops: [
        {
          placeId: manualId,
          stay: 20,
          walk: 5,
          privateNote: 'QA synthetic excluded value',
        },
      ],
      manualPlaces: [
        {
          id: manualId,
          title: 'QA 직접 지정 장소',
          address: 'QA 가상 주소',
          lat: 37.9,
          lon: 127.1,
          sigungu: '철원군',
          category: 'other',
          privateNote: 'QA synthetic excluded value',
        },
      ],
      returnAt: 'QA excluded return criterion',
      timeBudgetMinutes: 999,
      startedAt: 'QA excluded actual start',
      activeOuting: { secretMarker: 'QA excluded outing' },
      stamps: ['복귀'],
      completedAt: 'QA excluded completion',
    };
    const saved = (
      await post('owner', 'Save opted-in manual plan', {
        action: 'savePlan',
        groupId: alpha,
        plan,
        activeOuting: { secretMarker: 'QA excluded envelope' },
      })
    ).data;
    ownerPlanId = saved.planId;
    checkSharedWhitelist(recordOf(saved.group, ownerPlanId).plan, true);
    const shared = recordOf(
      (await get('member', 'Other context sees shared plan', alpha)).data.group,
      ownerPlanId,
    ).plan;
    checkSharedWhitelist(shared, true);
    check(
      shared.manualPlaces[0].title === 'QA 직접 지정 장소' &&
        shared.manualPlaces[0].lat === 37.9 &&
        shared.meetingId === manualId,
      'Explicitly shared manual fields were lost',
    );
    await post(
      'member',
      'Member cannot delete owner plan',
      { action: 'deletePlan', groupId: alpha, planId: ownerPlanId },
      403,
    );
  });
  await step('member saves public-only and empty group plans', async () => {
    const saved = (
      await post('member', 'Member creates public-only plan', {
        action: 'savePlan',
        groupId: alpha,
        plan: publicPlan('QA 멤버 계획'),
      })
    ).data;
    memberPlanId = saved.planId;
    const stored = recordOf(saved.group, memberPlanId);
    check(
      stored.authorId === memberId && stored.version === 1,
      'Member author or initial version mismatch',
    );
    checkSharedWhitelist(stored.plan, false);
    check(saved.group.planCount === 2, 'Multiple group plans not retained');
    const empty = (
      await post('member', 'Member saves empty draft', {
        action: 'savePlan',
        groupId: alpha,
        plan: { ...publicPlan('QA 빈 계획'), stops: [] },
      })
    ).data;
    check(
      recordOf(empty.group, empty.planId).plan.stops.length === 0,
      'Empty draft populated unexpectedly',
    );
    await post('member', 'Author deletes own empty draft', {
      action: 'deletePlan',
      groupId: alpha,
      planId: empty.planId,
    });
    await post(
      'outsider',
      'Outsider cannot edit an existing plan',
      {
        action: 'savePlan',
        groupId: alpha,
        planId: memberPlanId,
        version: 1,
        plan: publicPlan(),
      },
      403,
    );
  });
  await step(
    'stale revision and simultaneous edits return 409 without overwrite',
    async () => {
      const initial = recordOf(
        (await get('member', 'Member reads edit base', alpha)).data.group,
        memberPlanId,
      );
      const first = { ...copy(initial.plan), title: 'QA 먼저 저장한 계획' };
      const updated = (
        await post('owner', 'Owner edits member plan', {
          action: 'savePlan',
          groupId: alpha,
          planId: memberPlanId,
          version: initial.version,
          plan: first,
        })
      ).data;
      const revision = recordOf(updated.group, memberPlanId).version;
      check(
        revision === initial.version + 1,
        'Successful update did not advance one revision',
      );
      await post(
        'member',
        'Stale update rejected',
        {
          action: 'savePlan',
          groupId: alpha,
          planId: memberPlanId,
          version: initial.version,
          plan: { ...copy(first), title: 'QA 덮어쓰면 안 되는 계획' },
        },
        409,
      );
      check(
        recordOf(
          (await get('member', 'Read after conflict', alpha)).data.group,
          memberPlanId,
        ).plan.title === first.title,
        'Stale edit overwrote current payload',
      );
      const changes = ['QA 동시 수정 A', 'QA 동시 수정 B'];
      const attempts = await Promise.all(
        ['owner', 'member'].map((actor, i) =>
          post(
            actor,
            'Concurrent update',
            {
              action: 'savePlan',
              groupId: alpha,
              planId: memberPlanId,
              version: revision,
              plan: { ...copy(first), title: changes[i] },
            },
            [200, 409],
          ),
        ),
      );
      check(
        attempts.filter((x) => x.status === 200).length === 1 &&
          attempts.filter((x) => x.status === 409).length === 1,
        'Concurrent writers must produce one success and one conflict',
      );
      const final = recordOf(
        (await get('owner', 'Final concurrent version', alpha)).data.group,
        memberPlanId,
      );
      check(
        final.version === revision + 1 &&
          final.plan.title ===
            changes[attempts.findIndex((x) => x.status === 200)],
        'Concurrent winner or final revision mismatch',
      );
      await post('member', 'Author deletes own plan', {
        action: 'deletePlan',
        groupId: alpha,
        planId: memberPlanId,
      });
      check(
        (
          await get('owner', 'Other plan survives deletion', alpha)
        ).data.group.plans.some((p) => p.id === ownerPlanId),
        'Deleting one plan removed another plan',
      );
    },
  );
  await step(
    'malformed bodies and malformed shared plans return 400',
    async () => {
      for (const raw of ['{', 'null', '[]', 'true', '"string"']) {
        await call('owner', 'Malformed request envelope', { raw, status: 400 });
      }
      const invalid = [
        null,
        { ...publicPlan(), title: 123 },
        { ...publicPlan(), departureAt: 'invalid' },
        { ...publicPlan(), meetingId: 'invalid id with spaces' },
        { ...publicPlan(), stops: [null] },
        { ...publicPlan(), stops: [{ placeId: 'qa-stop', stay: 2, walk: 3 }] },
        { ...publicPlan(), stops: [{ placeId: 'qa-stop', stay: 0, walk: 0 }] },
        {
          ...publicPlan(),
          stops: [copy(publicPlan().stops[0]), copy(publicPlan().stops[0])],
        },
        {
          ...publicPlan(),
          stops: [{ placeId: 'manual:missing', stay: 10, walk: 0 }],
        },
        { ...publicPlan(), manualPlaces: [null] },
      ];
      for (const plan of invalid)
        await post(
          'owner',
          'Malformed shared plan',
          { action: 'savePlan', groupId: alpha, plan },
          400,
        );
      check(
        (await get('owner', 'Malformed requests do not mutate plans', alpha))
          .data.group.planCount === 1,
        'Malformed request changed stored plan count',
      );
    },
  );
  await step(
    'removed member denied old invitation but accepts a new one',
    async () => {
      await post('owner', 'Remove member', {
        action: 'remove',
        groupId: alpha,
        userId: memberId,
      });
      await get('member', 'Removed member cannot read', alpha, 403);
      await post(
        'member',
        'Removed member cannot write',
        { action: 'savePlan', groupId: alpha, plan: publicPlan() },
        403,
      );
      await post(
        'member',
        'Removed member cannot reuse old invitation',
        { action: 'join', code: oldInvite },
        403,
      );
      const nextInvite = await invite('owner', alpha);
      await post(
        'outsider',
        'Regeneration invalidates previous invitation',
        { action: 'preview', code: oldInvite },
        404,
      );
      const rejoined = (
        await post('member', 'Removed member accepts newly issued invitation', {
          action: 'join',
          code: nextInvite,
        })
      ).data;
      check(
        rejoined.profile.id === memberId && rejoined.group.memberCount === 2,
        'Rejoin changed identity or duplicated membership',
      );
      oldInvite = nextInvite;
    },
  );
  await step(
    'leave requires a newer invitation and revocation preserves joined members',
    async () => {
      await post('member', 'Member leaves group', {
        action: 'leave',
        groupId: alpha,
      });
      await get('member', 'Former member denied after leave', alpha, 403);
      await post(
        'member',
        'Left member cannot reuse old invitation',
        { action: 'join', code: oldInvite },
        403,
      );
      const fresh = await invite('owner', alpha);
      await post('member', 'Left member accepts fresh invitation', {
        action: 'join',
        code: fresh,
      });
      await post('owner', 'Revoke current invitation', {
        action: 'revoke',
        groupId: alpha,
      });
      await post(
        'outsider',
        'Revoked invitation preview fails',
        { action: 'preview', code: fresh },
        404,
      );
      await post(
        'outsider',
        'Revoked invitation join fails',
        { action: 'join', code: fresh },
        404,
      );
      check(
        (
          await get(
            'member',
            'Invite revocation preserves existing membership',
            alpha,
          )
        ).data.group.memberCount === 2,
        'Revocation unexpectedly removed joined member',
      );
    },
  );
  await step(
    'group deletion removes API access and invitations, retaining unrelated group',
    async () => {
      const finalInvite = await invite('owner', alpha);
      await deleteOwned('owner', alpha);
      for (const actor of ['owner', 'member', 'outsider'])
        await get(actor, 'Deleted group cannot be read', alpha, 403);
      await post(
        'member',
        'Deleted group invitation is unavailable',
        { action: 'preview', code: finalInvite },
        404,
      );
      await post(
        'member',
        'Deleted group cannot be rejoined',
        { action: 'join', code: finalInvite },
        404,
      );
      await post(
        'owner',
        'Deleted group rejects plan writes',
        { action: 'savePlan', groupId: alpha, plan: publicPlan() },
        403,
      );
      for (const actor of ['owner', 'member'])
        check(
          !(
            await get(actor, 'Deleted membership absent from list')
          ).data.groups.some((g) => g.id === alpha),
          'Deleted group still listed',
        );
      const remaining = (
        await get('outsider', 'Unrelated owned group remains', beta)
      ).data.group;
      check(
        remaining.kind === 'friends' && remaining.memberCount === 1,
        'Deleting family group affected friends group',
      );
      await deleteOwned('outsider', beta);
      check(
        (await get('outsider', 'Second test group cleanup')).data.groups
          .length === 0,
        'Second test group remains listed',
      );
    },
  );
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure =
    error instanceof CheckFailure
      ? error.message
      : 'Unexpected QA failure (raw details suppressed)';
  process.exitCode = 1;
} finally {
  // Discover a partial create only by this run's unique prefix and current owner.
  // All contexts were born empty; never use global/admin deletion or existing names.
  for (const actor of Object.keys(contexts)) {
    try {
      const { data } = await get(actor, 'Cleanup owned test group discovery');
      for (const g of data.groups || []) {
        if (
          g.ownerId === data.profile?.id &&
          g.name.startsWith(prefix) &&
          !created.some((x) => x.id === g.id)
        ) {
          created.push({ actor, id: g.id, name: g.name, deleted: false });
        }
      }
    } catch {
      /* Existing failure already records inaccessible service; no broad cleanup. */
    }
  }
  for (const resource of created) {
    if (resource.deleted) {
      report.cleanup.push({ actor: resource.actor, status: 'deleted' });
      continue;
    }
    try {
      await deleteOwned(resource.actor, resource.id);
      report.cleanup.push({ actor: resource.actor, status: 'deleted' });
    } catch {
      report.cleanup.push({
        actor: resource.actor,
        status: 'failed',
        groupId: resource.id,
      });
      report.status = 'failed';
      process.exitCode = 1;
    }
  }
  for (const context of Object.values(contexts))
    await context.dispose().catch(() => {});
  report.finishedAt = new Date().toISOString();
  report.requestCount = requestCount;
  report.profileCleanup =
    'No profile deletion API; fresh test profile rows may remain. No existing profiles or groups were modified.';
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      status: report.status,
      passed: report.cases.filter((c) => c.status === 'passed').length,
      failed: report.cases.filter((c) => c.status === 'failed').length,
      requests: requestCount,
      groupsCleaned: report.cleanup.filter((c) => c.status === 'deleted')
        .length,
      report: output,
    }),
  );
}
