// Planning model only. Does not read keys, call providers, or alter quotas.
// Usage: node scripts/estimate_api_capacity.mjs [sessions-per-day]
const sessionsPerDay = Number(process.argv[2] ?? 500);
if (!Number.isSafeInteger(sessionsPerDay) || sessionsPerDay < 1) {
  throw new Error('sessions-per-day must be a positive safe integer');
}
const inputs = {
  sessionsPerDay,
  regionLoadsPerSession: 2,
  detailOpensPerSession: 3,
  searchPagesPerSession: 2,
  unresolvedSavedPlacesPerSession: 4,
  accessibilityRegionLoadsPerSession: 0.5,
  accessibilityPreviewDetailsPerLoad: 4,
  reserveMultiplier: 1.5,
};
const { regionLoadsPerSession: R, detailOpensPerSession: D,
  searchPagesPerSession: Q, unresolvedSavedPlacesPerSession: P,
  accessibilityRegionLoadsPerSession: A,
  accessibilityPreviewDetailsPerLoad: W } = inputs;
const definitions = [
  ['KorService2', 'ldongCode2', 2 * R + 2 * Q],
  ['KorService2', 'areaBasedList2', 5 * R],
  ['KorService2', 'searchKeyword2', Q],
  ['KorService2', 'detailCommon2', D + P],
  ['KorService2', 'detailIntro2', D],
  ['KorWithService2', 'ldongCode2', 2 * A],
  ['KorWithService2', 'areaBasedList2', A],
  ['KorWithService2', 'detailWithTour2', D + W * A],
];
const operations = definitions.map(([service, operation, callsPerSession]) => {
  const expectedCallsPerDay = callsPerSession * sessionsPerDay;
  return { service, operation, callsPerSession, expectedCallsPerDay,
    proposedRequestPerDay: Math.ceil(expectedCallsPerDay * inputs.reserveMultiplier / 1000) * 1000 };
});
const totals = Object.fromEntries(['KorService2', 'KorWithService2'].map(service => [
  service, operations.filter(row => row.service === service)
    .reduce((sum, row) => sum + row.expectedCallsPerDay, 0),
]));
const korOnDemandSingleType = (3 * R + 2 * D + 3 * Q + P) * sessionsPerDay;
const korWithValidatedReferenceCodes = (R + 2 * D + Q + P) * sessionsPerDay;
console.log(JSON.stringify({
  status: 'illustrative planning assumptions; not observed traffic or approved quota',
  asOf: '2026-09-08', inputs, operations, totals,
  optimizedKorScenarios: {
    onDemandOneTypePerRegionLoad: korOnDemandSingleType,
    withValidatedReferenceCodesIfPermitted: korWithValidatedReferenceCodes,
    notes: 'Same R/D/Q/P workload. Assumes only one category is needed per regional load. More categories/pages add requests. Reference-code policy and mappings require confirmation.',
  },
  exclusions: ['retries', 'pagination beyond input Q', 'optional APIs', 'weather', 'manual QA', 'sync jobs'],
  approvalNote: 'Confirm whether each service or each operation has its own cap. Round-up values are proposed application amounts, not automatic entitlements.',
}, null, 2));
