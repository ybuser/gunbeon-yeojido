// Minimal live probes for three KTO analytical APIs. Persist metadata only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env.local');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const fallbackNames = ['DATA_GO_KR_SERVICE_KEY', 'TOUR_API_SERVICE_KEY', 'TOUR_API_KOR_SERVICE_KEY'];
const keySource = fallbackNames.find(name => process.env[name]);
const key = keySource ? process.env[keySource] : undefined;
const maxCalls = 12;
let calls = 0;
const verifiedAt = new Date().toISOString();
const now = new Date();
const month = offset => {
  const value = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  return String(value.getUTCFullYear()) + String(value.getUTCMonth() + 1).padStart(2, '0');
};
const report = {
  verified_at: verifiedAt, mode: key ? 'live_check' : 'blocked_missing_key', key_source: keySource || null,
  metadata_only: true, raw_responses_persisted: false, key_logged: false, full_request_urls_logged: false,
  region_code_source: '첨부 v4.1 XLSX 시도,시군구코드: areaCd=51, signguCd는 5자리 법정동 시군구 코드',
  max_api_calls: maxCalls, services: [],
  limitations: [
    'Success verifies access and the sampled response only; it does not certify all dates, districts, or full pagination.',
    'Tourism analytical IDs are not assumed to equal KorService2 contentid.',
    'Concentration is a forecast index, not real-time traffic, parking occupancy, or delay minutes.',
  ],
};
const fields = rows => [...new Set(rows.flatMap(row => Object.keys(row)))].sort();
const nonemptyFields = rows => [...new Set(rows.flatMap(row => Object.keys(row).filter(name => row[name] !== null && row[name] !== undefined && String(row[name]).trim() !== '')))].sort();
const safeCode = value => String(value || 'UNKNOWN').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 80);
async function invoke(service, operation, params) {
  const observation = { requested_at: new Date().toISOString(), service, operation, parameters: { MobileOS: 'WEB', MobileApp: 'GunbeonGangwon', _type: 'json', numOfRows: 1, pageNo: 1, ...params } };
  if (!key) return { ...observation, status: 'blocked_missing_key' };
  if (calls >= maxCalls) return { ...observation, status: 'call_budget_exhausted' };
  calls += 1;
  let normalizedKey = key;
  try { normalizedKey = decodeURIComponent(key); } catch {}
  const url = new URL('https://apis.data.go.kr/B551011/' + service + '/' + operation);
  for (const [name, value] of Object.entries({ ...observation.parameters, serviceKey: normalizedKey })) url.searchParams.set(name, String(value));
  let response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(15000), cache: 'no-store' }); }
  catch { return { ...observation, status: 'network_or_timeout' }; }
  observation.http_status = response.status;
  const raw = await response.text();
  let json;
  try { json = JSON.parse(raw); }
  catch {
    const reason = raw.match(/<returnReasonCode>([^<]*)<\/returnReasonCode>/)?.[1];
    const auth = raw.match(/<returnAuthMsg>([^<]*)<\/returnAuthMsg>/)?.[1];
    return { ...observation, status: reason ? 'gateway_error' : 'non_json_response', gateway_reason_code: reason ? safeCode(reason) : null, gateway_auth_code: auth ? safeCode(auth) : null };
  }
  const header = json.response?.header || {};
  const resultCode = safeCode(header.resultCode);
  if (!response.ok || !['0000', '00'].includes(resultCode)) return { ...observation, status: 'api_error', result_code: resultCode };
  const body = json.response?.body || {};
  const rows = Array.isArray(body.items?.item) ? body.items.item : body.items?.item ? [body.items.item] : [];
  const idFields = ['contentid', 'tAtsCd', 'hubTatsCd', 'rlteTatsCd'];
  return {
    ...observation, status: 'success', authorization_outcome: 'request_accepted', result_code: resultCode,
    total_count: Number(body.totalCount || 0), row_count: rows.length, response_fields: fields(rows), nonempty_fields: nonemptyFields(rows),
    base_month_values: [...new Set(rows.map(row => String(row.baseYm || '')).filter(Boolean))],
    base_date_values: [...new Set(rows.map(row => String(row.baseYmd || '')).filter(Boolean))],
    expected_origin_region_match_count: rows.filter(row => String(row.areaCd) === String(params.areaCd) && String(row.signguCd) === String(params.signguCd)).length,
    id_nonempty_counts: Object.fromEntries(idFields.map(name => [name, rows.filter(row => row[name] !== null && row[name] !== undefined && String(row[name]).trim() !== '').length])),
    coordinate_fields_present: fields(rows).filter(name => ['mapX', 'mapY', 'mapx', 'mapy'].includes(name)),
  };
}
const configurations = [
  { name: '관광지 집중률', service: 'TatsCnctrRateService', operation: 'tatsCnctrRatedList', monthly: false, official_catalog: 'https://www.data.go.kr/data/15128555/openapi.do' },
  { name: '기초지자체 중심 관광지', service: 'LocgoHubTarService1', operation: 'areaBasedList1', monthly: true, official_catalog: 'https://www.data.go.kr/data/15128559/openapi.do' },
  { name: '관광지별 연관 관광지', service: 'TarRlteTarService1', operation: 'areaBasedList1', monthly: true, official_catalog: 'https://www.data.go.kr/data/15128560/openapi.do' },
];
for (const configuration of configurations) {
  const record = { ...configuration, probes: [] };
  const candidateParams = configuration.monthly
    ? [-1, -2, -3].map(offset => ({ areaCd: '51', signguCd: '51780', baseYm: month(offset) }))
    : ['51780', '51820', '51130'].map(signguCd => ({ areaCd: '51', signguCd }));
  for (const params of candidateParams) {
    const result = await invoke(configuration.service, configuration.operation, params);
    record.probes.push(result);
    if (result.status !== 'success' || result.row_count > 0) break;
  }
  record.key_request_accepted = record.probes.some(probe => probe.status === 'success');
  record.nonempty_sample_verified = record.probes.some(probe => probe.status === 'success' && probe.row_count > 0);
  report.services.push(record);
  console.log(configuration.name + ': ' + (record.nonempty_sample_verified ? '비어 있지 않은 실제 응답 확인' : record.key_request_accepted ? '정상 빈 응답: 범위 내 데이터 미확인' : record.probes.at(-1)?.status));
}
report.api_calls = calls;
report.completed_at = new Date().toISOString();
report.summary = { services_checked: report.services.length, key_accepted_services: report.services.filter(service => service.key_request_accepted).length, nonempty_services: report.services.filter(service => service.nonempty_sample_verified).length, error_probes: report.services.flatMap(service => service.probes).filter(probe => probe.status !== 'success').length };
fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
fs.writeFileSync(path.join(root, 'reports/api_runtime_verification.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report.summary, api_calls: calls, report: 'reports/api_runtime_verification.json' }));
if (!key || report.summary.error_probes) process.exitCode = 2;
