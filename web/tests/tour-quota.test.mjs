import test from 'node:test';
import assert from 'node:assert/strict';
import { tourRequest, fetchRegion } from '../lib/tour-api.ts';
const quota = {
  OpenAPI_ServiceResponse: { cmmMsgHeader: { returnReasonCode: '22' } },
};
for (const status of [200, 429])
  test(`daily quota envelope is explicit at HTTP ${status}`, async () => {
    await assert.rejects(
      () =>
        tourRequest('KorService2', 'areaBasedList2', 'fixture', {}, async () =>
          Response.json(quota, { status }),
        ),
      (e) => e.code === 'DAILY_QUOTA_EXCEEDED',
    );
  });
test('known quota stops category fan-out', async () => {
  let areas = 0;
  const fake = async (u) => {
    const url = new URL(u);
    if (url.pathname.endsWith('ldongCode2'))
      return Response.json({
        response: {
          header: { resultCode: '0000' },
          body: {
            items: {
              item: url.searchParams.has('lDongRegnCd')
                ? [{ code: '780', name: '철원군' }]
                : [{ code: '51', name: '강원특별자치도' }],
            },
          },
        },
      });
    areas++;
    return Response.json(quota, { status: 429 });
  };
  await assert.rejects(
    () => fetchRegion('fixture', '철원군', fake),
    (e) => e.code === 'DAILY_QUOTA_EXCEEDED',
  );
  assert.equal(areas, 1);
});

for (const [format, body] of [
  [
    'gateway XML',
    '<OpenAPI_ServiceResponse><cmmMsgHeader><returnReasonCode>23</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>',
  ],
  [
    'result XML',
    '<response><header><resultCode>23</resultCode></header></response>',
  ],
  [
    'result JSON',
    JSON.stringify({ response: { header: { resultCode: '23' } } }),
  ],
])
  test(`short rejection is distinguished from daily quota: ${format}`, async () => {
    await assert.rejects(
      () =>
        tourRequest(
          'KorService2',
          'areaBasedList2',
          'fixture',
          {},
          async () => new Response(body),
        ),
      (e) => e.code === 'RATE_LIMITED',
    );
  });
test('daily quota in XML is recognized despite requested JSON', async () => {
  await assert.rejects(
    () =>
      tourRequest(
        'KorService2',
        'areaBasedList2',
        'fixture',
        {},
        async () =>
          new Response('<returnReasonCode>22</returnReasonCode>', {
            status: 429,
          }),
      ),
    (e) => e.code === 'DAILY_QUOTA_EXCEEDED',
  );
});
test('healthy regional requests retain all five normal categories', async () => {
  const types = [];
  const fake = async (u) => {
    const url = new URL(u);
    const isCodes = url.pathname.endsWith('ldongCode2');
    if (!isCodes) types.push(url.searchParams.get('contentTypeId'));
    const item = isCodes
      ? url.searchParams.has('lDongRegnCd')
        ? [{ code: '780', name: '철원군' }]
        : [{ code: '51', name: '강원특별자치도' }]
      : [];
    return Response.json({
      response: {
        header: { resultCode: '0000' },
        body: { items: { item }, totalCount: 0 },
      },
    });
  };
  await fetchRegion('fixture', '철원군', fake);
  assert.deepEqual(types.sort(), ['12', '14', '15', '32', '39']);
});
test('provider Retry-After respected; instantaneous rejection does not inherit a ten minute hold', async () => {
  const { providerRetryDelay } = await import('../lib/tour-api.ts');
  const now = Date.parse('2026-09-09T00:00:00Z');
  assert.equal(providerRetryDelay('RATE_LIMITED', null, now), 30000);
  assert.equal(providerRetryDelay('DAILY_QUOTA_EXCEEDED', null, now), 600000);
  assert.equal(providerRetryDelay('RATE_LIMITED', '2', now), 2000);
  assert.equal(
    providerRetryDelay('RATE_LIMITED', 'Wed, 09 Sep 2026 00:01:00 GMT', now),
    60000,
  );
  assert.equal(providerRetryDelay('RATE_LIMITED', 'nonsense', now), 30000);
});
test('gateway authentication error is not mislabeled as an unknown quota', async () => {
  await assert.rejects(
    () =>
      tourRequest(
        'KorService2',
        'areaBasedList2',
        'fixture',
        {},
        async () =>
          new Response('<returnReasonCode>30</returnReasonCode>', {
            status: 403,
          }),
      ),
    (e) => e.code === 'PROVIDER_30',
  );
});
