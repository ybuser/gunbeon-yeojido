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
