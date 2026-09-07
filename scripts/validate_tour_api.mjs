// Node >=22.13. Persist only metadata; never keys, full request URLs, or tourism payloads.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env.local');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const keySource = ['DATA_GO_KR_SERVICE_KEY', 'TOUR_API_KOR_SERVICE_KEY', 'TOUR_API_SERVICE_KEY'].find(name => process.env[name]);
const withKeySource = ['DATA_GO_KR_SERVICE_KEY', 'TOUR_API_WITH_SERVICE_KEY', 'TOUR_API_KOR_SERVICE_KEY', 'TOUR_API_SERVICE_KEY'].find(name => process.env[name]);
const key = keySource ? process.env[keySource] : undefined;
const withKey = withKeySource ? process.env[withKeySource] : undefined;
const reportFile = path.join(root, 'reports/tour_api_live_validation.json');
const oldReport = fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, 'utf8')) : null;
let calls = 0;
const maxCalls = 80;
const report = {
  verified_at: new Date().toISOString(), mode: key ? 'live_check' : 'blocked_missing_key',
  app: 'GunbeonGangwon', service: 'KorService2', regional_filter: 'legal_dong_current',
  key_source: keySource || null, accessibility_key_source: withKeySource || null,
  manual_version: '국문 v4.4 (2026-02-10); 무장애 v4.3 (2025-05-12)',
  code_method: 'ldongCode2', list_method: 'areaBasedList2',
  scope: { regions: ['철원군', '화천군', '양구군', '인제군', '고성군'], content_type_ids: ['12', '14', '15', '32', '39'], description: '현재 법정동 코드와 지정 5개 관광타입으로 수신한 API 목록의 검증. 현실의 모든 시설 또는 미선택 관광타입까지 포괄한다는 의미가 아님.' },
  regions: [], errors: [], key_logged: false, full_request_urls_logged: false, raw_tourapi_records_persisted: false,
};
if (oldReport && oldReport.regional_filter !== 'legal_dong_current') {
  report.legacy_validation_comparison = { verified_at: oldReport.verified_at, area_code: oldReport.gangwon_area_code, fetched_records: (oldReport.regions || []).reduce((sum, row) => sum + (row.categories || []).reduce((total, category) => total + Number(category.fetched || 0), 0), 0), interpretation: '과거 areaCode/sigunguCode로 반환된 부분 집합. 지역 전체 또는 현재 법정동 목록의 완전한 결과로 해석하면 안 됨.' };
} else if (oldReport?.legacy_validation_comparison) report.legacy_validation_comparison = oldReport.legacy_validation_comparison;
const fail = code => Object.assign(new Error(code), { safeCode: code });
const invoke = async (service, method, params = {}, serviceKey = key) => {
  if (!serviceKey) throw fail('KEY_MISSING');
  if (calls >= maxCalls) throw fail('CALL_BUDGET_EXHAUSTED');
  calls += 1;
  let decoded = serviceKey;
  try { decoded = decodeURIComponent(serviceKey); } catch {}
  const url = new URL('https://apis.data.go.kr/B551011/' + service + '/' + method);
  for (const [name, value] of Object.entries({ serviceKey: decoded, MobileOS: 'ETC', MobileApp: 'GunbeonGangwon', _type: 'json', numOfRows: '100', pageNo: '1', ...params })) url.searchParams.set(name, String(value));
  let response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(15000), cache: 'no-store' }); }
  catch { throw fail('NETWORK_OR_TIMEOUT'); }
  if (!response.ok) throw fail('HTTP_' + response.status);
  let json;
  try { json = await response.json(); } catch { throw fail('NON_JSON_RESPONSE'); }
  const resultCode = String(json.response?.header?.resultCode || 'UNKNOWN');
  if (!['0000', '00'].includes(resultCode)) throw fail('API_RESULT_' + resultCode.replace(/[^a-zA-Z0-9]/g, ''));
  const body = json.response?.body || {};
  return { items: Array.isArray(body.items?.item) ? body.items.item : body.items?.item ? [body.items.item] : [], total: Number(body.totalCount || 0) };
};
const fields = rows => [...new Set(rows.flatMap(row => Object.keys(row)))].sort();
const nonemptyFields = rows => [...new Set(rows.flatMap(row => Object.keys(row).filter(name => row[name] !== null && row[name] !== undefined && String(row[name]).trim() !== '')))].sort();
if (key) {
  try {
    const areas = await invoke('KorService2', 'ldongCode2', { lDongListYn: 'N' });
    const gangwon = areas.items.find(row => String(row.name).includes('강원'));
    if (!gangwon) throw fail('GANGWON_NOT_FOUND');
    report.gangwon_lDongRegnCd = String(gangwon.code);
    report.code_response_fields = fields(areas.items);
    const districts = await invoke('KorService2', 'ldongCode2', { lDongRegnCd: gangwon.code, lDongListYn: 'N' });
    for (const region of report.scope.regions) {
      const district = districts.items.find(row => row.name === region);
      if (!district) { report.errors.push({ region, error: 'DISTRICT_NOT_FOUND' }); continue; }
      const regionParams = { lDongRegnCd: gangwon.code, lDongSignguCd: district.code };
      const record = { region, code: String(district.code), lDongSignguCd: String(district.code), categories: [], accessibility: null };
      for (const type of report.scope.content_type_ids) {
        try {
          const rows = [];
          let total = 0, pageNo = 1;
          do {
            const page = await invoke('KorService2', 'areaBasedList2', { ...regionParams, contentTypeId: type, pageNo, arrange: 'C' });
            rows.push(...page.items); total = page.total; pageNo += 1;
            if (!page.items.length) break;
          } while (rows.length < total && pageNo <= 30);
          const uniqueIds = new Set(rows.map(row => String(row.contentid)));
          record.categories.push({ type, total, fetched: rows.length, fully_paged: rows.length >= total, pages: pageNo - 1, unique_content_ids: uniqueIds.size, duplicate_content_ids: rows.length - uniqueIds.size, coordinate_missing: rows.filter(row => !Number(row.mapx) || !Number(row.mapy)).length, telephone_missing: rows.filter(row => !row.tel).length, telephone_missing_scope: 'list_response_only', blank_legacy_area_code: rows.filter(row => !row.areacode).length, blank_legacy_sigungu_code: rows.filter(row => !row.sigungucode).length, response_fields: fields(rows) });
        } catch (error) { report.errors.push({ region, type, error: error.safeCode || 'UNEXPECTED_ERROR' }); }
      }
      if (withKey) {
        try {
          const accessibility = await invoke('KorWithService2', 'areaBasedList2', { ...regionParams, numOfRows: '1', arrange: 'C' }, withKey);
          record.accessibility = { sampling_method: 'dedicated_accessibility_list_using_legal_dong', area_total: accessibility.total, sample_content_id: accessibility.items[0]?.contentid ? String(accessibility.items[0].contentid) : null, row_count: 0, nonempty_fields: [] };
          if (accessibility.items[0]?.contentid) {
            const detail = await invoke('KorWithService2', 'detailWithTour2', { contentId: accessibility.items[0].contentid }, withKey);
            record.accessibility.row_count = detail.items.length;
            record.accessibility.response_fields = fields(detail.items);
            record.accessibility.nonempty_fields = nonemptyFields(detail.items);
          }
        } catch (error) { record.accessibility = { error: error.safeCode || 'UNEXPECTED_ERROR' }; report.errors.push({ region, service: 'KorWithService2', error: error.safeCode || 'UNEXPECTED_ERROR' }); }
      }
      report.regions.push(record);
      console.log(region + ': 법정동 ' + district.code + ', ' + record.categories.length + '개 유형 점검 완료');
    }
  } catch (error) { report.errors.push({ error: error.safeCode || 'UNEXPECTED_ERROR' }); }
}
report.completed_at = new Date().toISOString();
report.api_calls = calls;
report.max_api_calls = maxCalls;
report.summary = { region_count: report.regions.length, successful_category_combinations: report.regions.reduce((sum, row) => sum + row.categories.length, 0), fully_paged_category_combinations: report.regions.reduce((sum, row) => sum + row.categories.filter(category => category.fully_paged).length, 0), fetched_records: report.regions.reduce((sum, row) => sum + row.categories.reduce((total, category) => total + category.fetched, 0), 0), coordinate_missing: report.regions.reduce((sum, row) => sum + row.categories.reduce((total, category) => total + category.coordinate_missing, 0), 0), error_count: report.errors.length };
fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ mode: report.mode, regional_filter: report.regional_filter, ...report.summary, api_calls: calls, report: 'reports/tour_api_live_validation.json' }));
if (!key || report.errors.length) process.exitCode = 2;
