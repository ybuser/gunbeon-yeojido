// Live metadata-only validation. No API keys, complete URLs, or tourism payloads are persisted.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env.local');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const keySource = ['DATA_GO_KR_SERVICE_KEY', 'TOUR_API_WITH_SERVICE_KEY', 'TOUR_API_KOR_SERVICE_KEY', 'TOUR_API_SERVICE_KEY'].find(name => process.env[name]);
const key = keySource ? process.env[keySource] : undefined;
const nationalKey = process.env.DATA_GO_KR_SERVICE_KEY || process.env.TOUR_API_KOR_SERVICE_KEY || process.env.TOUR_API_SERVICE_KEY;
const MAX_CALLS = 40;
const diagnosticsOnly = process.argv.includes('--diagnose-existing-report');
const migrationOnly = process.argv.includes('--validate-legal-dong-existing-report');
const confirmParkOnly = process.argv.includes('--confirm-park-existing-report');
const reportFile = path.join(root, 'reports/accessibility_validation.json');
const previousReport = diagnosticsOnly || migrationOnly || confirmParkOnly ? JSON.parse(fs.readFileSync(reportFile, 'utf8')) : null;
let calls = previousReport?.api_calls || 0;
const report = previousReport || {
  verified_at: new Date().toISOString(),
  mode: key ? 'live_check' : 'blocked_missing_key',
  service: 'KorWithService2',
  official_documentation: 'https://www.data.go.kr/data/15101897/openapi.do',
  key_source: keySource || null,
  max_api_calls: MAX_CALLS,
  raw_tourapi_records_persisted: false,
  key_logged: false,
  full_request_urls_logged: false,
  regions: [],
  place_matches: [],
  representative_details: [],
  errors: [],
  limitations: [
    'Counts and matched content IDs describe this validation time only; tourism responses remain in memory.',
    'A nonempty accessibility field is availability of information, not evidence of step-free access or suitability.',
    'An empty detailWithTour2 result means no accessibility detail was returned; it does not mean inaccessible.',
    'Name-based candidate matches require matching the live address/location before user-facing recommendations.',
  ],
};
const fail = code => Object.assign(new Error(code), { safeCode: code });
const invoke = async (method, params = {}, service = 'KorWithService2', serviceKey = key) => {
  if (!serviceKey) throw fail('KEY_MISSING');
  if (calls >= MAX_CALLS) throw fail('CALL_BUDGET_EXHAUSTED');
  calls += 1;
  let decoded = serviceKey;
  try { decoded = decodeURIComponent(serviceKey); } catch {}
  const url = new URL(`https://apis.data.go.kr/B551011/${service}/${method}`);
  for (const [name, value] of Object.entries({ serviceKey: decoded, MobileOS: 'ETC', MobileApp: 'GunbeonGangwon', _type: 'json', numOfRows: '100', pageNo: '1', ...params })) url.searchParams.set(name, String(value));
  let response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(15000), cache: 'no-store' }); }
  catch { throw fail('NETWORK_OR_TIMEOUT'); }
  if (!response.ok) throw fail(`HTTP_${response.status}`);
  let json;
  try { json = await response.json(); } catch { throw fail('NON_JSON_RESPONSE'); }
  const resultCode = String(json.response?.header?.resultCode || 'UNKNOWN');
  if (!['0000', '00'].includes(resultCode)) throw fail(`API_RESULT_${resultCode.replace(/[^a-zA-Z0-9]/g, '')}`);
  const body = json.response?.body || {};
  return { items: Array.isArray(body.items?.item) ? body.items.item : body.items?.item ? [body.items.item] : [], total: Number(body.totalCount || 0) };
};
const fields = rows => [...new Set(rows.flatMap(row => Object.keys(row)))].sort();
const populatedFields = rows => [...new Set(rows.flatMap(row => Object.keys(row).filter(field => row[field] !== null && row[field] !== undefined && String(row[field]).trim() !== '')))].sort();
const normalize = value => String(value).replace(/[\s()[\]·ㆍ,._-]/g, '').toLowerCase();
const targets = [
  { local_title: '고석정국민관광지', local_place_id: 'dmz_tourism:b03b6bbf587765cc', aliases: ['고석정국민관광지', '고석정'], keyword: '고석정' },
  { local_title: '고석정 꽃밭', local_place_id: 'dmz_tourism:0fac7154493ecf4e', aliases: ['고석정꽃밭'], keyword: '고석정' },
  { local_title: '순담계곡', local_place_id: 'dmz_tourism:c5fabb6fcd82fcb7', aliases: ['순담계곡'], keyword: '순담' },
  { local_title: '어울림', local_place_id: 'dmz_cafe:a422796ed9b4ea29', aliases: ['어울림'], keyword: '어울림' },
  { local_title: '철원역사문화공원', local_place_id: 'cwg:history-culture-park-1714', aliases: ['철원역사문화공원', '철원역사문화공원소이산모노레일'], keyword: '역사문화공원' },
  { local_title: '소이산', aliases: ['소이산', '소이산생태숲녹색길', '소이산모노레일'], keyword: '소이산' },
];
const detailsSeen = new Map(report.representative_details.map(row => [row.content_id, row]));
const detail = async (contentId, context) => {
  const id = String(contentId);
  if (detailsSeen.has(id)) return detailsSeen.get(id);
  try {
    const result = await invoke('detailWithTour2', { contentId: id });
    const value = { content_id: id, context, row_count: result.items.length, response_fields: fields(result.items), nonempty_fields: populatedFields(result.items) };
    detailsSeen.set(id, value);
    report.representative_details.push(value);
    return value;
  } catch (error) {
    const value = { content_id: id, context, error: error.safeCode || 'UNEXPECTED_ERROR' };
    detailsSeen.set(id, value);
    report.representative_details.push(value);
    return value;
  }
};
if (key && !diagnosticsOnly && !migrationOnly && !confirmParkOnly) {
  try {
    const areas = await invoke('areaCode2');
    report.area_code_response_fields = fields(areas.items);
    const gangwon = areas.items.find(row => String(row.name).includes('강원'));
    if (!gangwon) throw fail('GANGWON_NOT_FOUND');
    report.gangwon_area_code = String(gangwon.code);
    const districts = await invoke('areaCode2', { areaCode: gangwon.code });
    const rowsByRegion = new Map();
    for (const region of ['철원군', '화천군', '양구군', '인제군', '고성군']) {
      const district = districts.items.find(row => row.name === region);
      if (!district) { report.errors.push({ region, error: 'DISTRICT_NOT_FOUND' }); continue; }
      try {
        const rows = [];
        let total = 0, pageNo = 1;
        do {
          const result = await invoke('areaBasedList2', { areaCode: gangwon.code, sigunguCode: district.code, pageNo, arrange: 'C' });
          rows.push(...result.items); total = result.total; pageNo += 1;
          if (!result.items.length) break;
        } while (rows.length < total && pageNo <= 10);
        rowsByRegion.set(region, rows);
        const categories = {};
        for (const row of rows) categories[String(row.contenttypeid || 'unknown')] = (categories[String(row.contenttypeid || 'unknown')] || 0) + 1;
        report.regions.push({ region, code: String(district.code), total, fetched: rows.length, fully_paged: rows.length >= total, pages: pageNo - 1, category_counts: categories, coordinate_missing: rows.filter(row => !Number(row.mapx) || !Number(row.mapy)).length, response_fields: fields(rows) });
        // One representative actual accessibility-list entry per county.
        if (rows[0]?.contentid) await detail(rows[0].contentid, { region, purpose: 'accessibility_area_list_representative' });
        console.log(`${region}: 무장애 지역목록 ${rows.length}/${total}개 점검`);
      } catch (error) { report.errors.push({ region, error: error.safeCode || 'UNEXPECTED_ERROR' }); }
    }
    const cheorwon = rowsByRegion.get('철원군') || [];
    const cheorwonCode = districts.items.find(row => row.name === '철원군')?.code;
    const nationalSearchCache = new Map();
    for (const target of targets) {
      const aliases = target.aliases.map(normalize);
      const matching = cheorwon.filter(row => aliases.includes(normalize(row.title)));
      const result = { local_title: target.local_title, local_place_id: target.local_place_id || null, matching_rule: 'normalized_title_or_declared_alias_within_live_cheorwon_area', accessibility_list_content_ids: matching.map(row => String(row.contentid)), national_search_content_ids: [], state: matching.length ? 'matched_accessibility_list' : 'not_found_in_accessibility_list' };
      for (const row of matching) await detail(row.contentid, { local_title: target.local_title, purpose: 'mission_place_match' });
      if (!matching.length && nationalKey && cheorwonCode) {
        if (!nationalSearchCache.has(target.keyword)) {
          try { nationalSearchCache.set(target.keyword, await invoke('searchKeyword2', { areaCode: gangwon.code, sigunguCode: cheorwonCode, keyword: target.keyword }, 'KorService2', nationalKey)); }
          catch (error) { nationalSearchCache.set(target.keyword, { items: [], error: error.safeCode || 'UNEXPECTED_ERROR' }); }
        }
        const candidates = nationalSearchCache.get(target.keyword);
        if (candidates.error) result.search_error = candidates.error;
        const matchedNational = candidates.items.filter(row => aliases.includes(normalize(row.title)));
        result.national_search_content_ids = matchedNational.map(row => String(row.contentid));
        if (matchedNational.length) result.state = 'matched_national_list_only';
        for (const row of matchedNational) await detail(row.contentid, { local_title: target.local_title, purpose: 'national_id_crosscheck' });
      }
      report.place_matches.push(result);
    }
    // Parent's prior arbitrary national samples; compare to dedicated accessibility listing.
    for (const [contentId, region] of [['2704788', '철원군'], ['125412', '인제군']]) {
      const value = await detail(contentId, { region, purpose: 'parent_national_sample_crosscheck' });
      value.present_in_accessibility_area_list = (rowsByRegion.get(region) || []).some(row => String(row.contentid) === contentId);
    }
  } catch (error) { report.errors.push({ error: error.safeCode || 'UNEXPECTED_ERROR' }); }
}
if (key && diagnosticsOnly) {
  report.diagnostics = { verified_at: new Date().toISOString(), cheorwon_accessibility_local_matches: [], known_goseokjeong_id: '125782', keyword_checks: [] };
  try {
    const localNodes = JSON.parse(fs.readFileSync(path.join(root, 'data/processed/place_nodes_gangwon.json'), 'utf8')).filter(row => row.sigungu === '철원군');
    const cheorwon = await invoke('areaBasedList2', { areaCode: report.gangwon_area_code, sigunguCode: '12', arrange: 'C' });
    for (const row of cheorwon.items) {
      const candidates = localNodes.filter(node => normalize(node.title) === normalize(row.title));
      report.diagnostics.cheorwon_accessibility_local_matches.push({ content_id: String(row.contentid), content_type_id: String(row.contenttypeid), exact_local_matches: candidates.map(node => ({ local_place_id: node.id, local_title: node.title })), matching_rule: 'normalized_exact_title_within_cheorwon' });
      await detail(row.contentid, { region: '철원군', purpose: 'all_cheorwon_accessibility_entries' });
    }
    if (nationalKey) {
      const common = await invoke('detailCommon2', { contentId: '125782' }, 'KorService2', nationalKey);
      report.diagnostics.known_goseokjeong_common = { row_count: common.items.length, response_fields: fields(common.items), returned_content_ids: common.items.map(row => String(row.contentid)), title_matches_declared_alias: common.items.some(row => ['고석정', '고석정국민관광지'].map(normalize).includes(normalize(row.title))), area_codes: [...new Set(common.items.map(row => String(row.areacode)))], sigungu_codes: [...new Set(common.items.map(row => String(row.sigungucode)))] };
    }
    await detail('125782', { local_title: '고석정국민관광지', purpose: 'official_linked_data_content_id_crosscheck' });
    for (const service of ['KorWithService2', 'KorService2']) {
      const serviceKey = service === 'KorWithService2' ? key : nationalKey;
      if (!serviceKey) continue;
      const results = await invoke('searchKeyword2', { keyword: '고석정' }, service, serviceKey);
      report.diagnostics.keyword_checks.push({ service, keyword: '고석정', scope: 'nationwide_without_area_filters', total: results.total, fetched: results.items.length, exact_or_declared_alias_content_ids: results.items.filter(row => ['고석정', '고석정국민관광지', '고석정꽃밭'].map(normalize).includes(normalize(row.title))).map(row => String(row.contentid)), candidate_content_ids: results.items.map(row => String(row.contentid)) });
    }
  } catch (error) { report.errors.push({ context: 'diagnostics', error: error.safeCode || 'UNEXPECTED_ERROR' }); }
}
// A fresh run also performs current legal-dong validation before writing its result.
if (key && (migrationOnly || (!diagnosticsOnly && !confirmParkOnly))) {
  report.legacy_filter_warning = 'regions[] uses deprecated areaCode/sigunguCode and omits records whose legacy codes are blank. Use legal_dong_validation for current region coverage.';
  report.legal_dong_validation = { verified_at: new Date().toISOString(), code_method: 'ldongCode2', list_method: 'areaBasedList2', official_national_schema_note: 'areaCode and sigunguCode are unused/deprecated; replaced by legal-dong codes.', regions: [] };
  try {
    const areas = await invoke('ldongCode2', { lDongListYn: 'N' });
    const gangwon = areas.items.find(row => String(row.name).includes('강원'));
    if (!gangwon) throw fail('LEGAL_DONG_GANGWON_NOT_FOUND');
    report.legal_dong_validation.lDongRegnCd = String(gangwon.code);
    const districts = await invoke('ldongCode2', { lDongRegnCd: gangwon.code, lDongListYn: 'N' });
    report.legal_dong_validation.code_response_fields = fields(districts.items);
    for (const region of ['철원군', '화천군', '양구군', '인제군', '고성군']) {
      const district = districts.items.find(row => row.name === region);
      if (!district) { report.errors.push({ region, error: 'LEGAL_DONG_DISTRICT_NOT_FOUND' }); continue; }
      const rows = [];
      let total = 0, pageNo = 1;
      do {
        const result = await invoke('areaBasedList2', { lDongRegnCd: gangwon.code, lDongSignguCd: district.code, pageNo, arrange: 'C' });
        rows.push(...result.items); total = result.total; pageNo += 1;
        if (!result.items.length) break;
      } while (rows.length < total && calls < MAX_CALLS - 1);
      report.legal_dong_validation.regions.push({ region, lDongSignguCd: String(district.code), total, fetched: rows.length, fully_paged: rows.length >= total, coordinate_missing: rows.filter(row => !Number(row.mapx) || !Number(row.mapy)).length, blank_legacy_area_code: rows.filter(row => !row.areacode).length, blank_legacy_sigungu_code: rows.filter(row => !row.sigungucode).length, response_fields: fields(rows), content_type_counts: rows.reduce((counts, row) => ({ ...counts, [String(row.contenttypeid)]: (counts[String(row.contenttypeid)] || 0) + 1 }), {}) });
      if (region === '철원군') {
        for (const target of targets) {
          const matching = rows.filter(row => target.aliases.map(normalize).includes(normalize(row.title)));
          const value = report.place_matches.find(row => row.local_title === target.local_title);
          value.legal_dong_accessibility_content_ids = matching.map(row => String(row.contentid));
          if (matching.length) {
            value.state = 'matched_accessibility_legal_dong_list';
            value.matching_rule = 'normalized_title_or_declared_alias_within_live_cheorwon_legal_dong_area';
          }
        }
      }
    }
    await detail('2749319', { local_title: '고석정 꽃밭', purpose: 'legal_dong_and_nationwide_keyword_match' });
    report.legal_dong_validation.total = report.legal_dong_validation.regions.reduce((sum, row) => sum + row.total, 0);
    report.legal_dong_validation.fetched = report.legal_dong_validation.regions.reduce((sum, row) => sum + row.fetched, 0);
  } catch (error) { report.errors.push({ context: 'legal_dong_validation', error: error.safeCode || 'UNEXPECTED_ERROR' }); }
}
if (key && (confirmParkOnly || (!diagnosticsOnly && !migrationOnly))) {
  const park = report.place_matches.find(row => row.local_title === '철원역사문화공원');
  if (park?.legal_dong_accessibility_content_ids.includes('3072021')) await detail('3072021', { local_title: '철원역사문화공원', purpose: 'legal_dong_exact_title_match' });
  if (report.diagnostics?.known_goseokjeong_common?.title_matches_declared_alias) {
    const gorge = report.place_matches.find(row => row.local_title === '고석정국민관광지');
    gorge.national_direct_content_ids = ['125782'];
    gorge.state = 'matched_national_detail_only_no_accessibility_record';
  }
}
report.api_calls = calls;
report.completed_at = new Date().toISOString();
const authoritativeRegions = report.legal_dong_validation?.regions || report.regions;
report.summary = { regional_filter: report.legal_dong_validation ? 'legal_dong_current' : 'legacy_area_code', region_count: authoritativeRegions.length, fully_paged_regions: authoritativeRegions.filter(row => row.fully_paged).length, accessibility_area_records: authoritativeRegions.reduce((sum, row) => sum + row.fetched, 0), legacy_area_records: report.regions.reduce((sum, row) => sum + row.fetched, 0), matched_target_count: report.place_matches.filter(row => (row.legal_dong_accessibility_content_ids || row.accessibility_list_content_ids).length).length, detail_with_rows_count: report.representative_details.filter(row => row.row_count > 0).length, error_count: report.errors.length + report.representative_details.filter(row => row.error).length };
fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report.summary, api_calls: calls, report: 'reports/accessibility_validation.json' }));
if (!key || report.summary.error_count) process.exitCode = 2;
