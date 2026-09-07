import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEntry, entryKey, planSignature, resolveEntry, hasVisitRecord,
  publicCard, familyProjection, defaultSettings, effectiveWeather,
  visitRestriction, assess, makeMissions,
} from '../lib/domain.ts';
const at = new Date('2026-09-07T02:00:00Z');
const p = (id, title = id) => ({id, source:'fixture', source_id:id, title, sigungu:'철원군', category:'attraction', lat:38.18, lon:127.29, opening_status:'unknown', reservation_required:null, id_check_required:null, access_tags:[], theme_tags:[], overview:'', data_quality_flags:[]});
const a=p('a'), b={...p('b'), category:'cafe'}, c=p('c');
const mission={id:'철원군-가족', title:'철원장: 함께 고르는 하루', region:'철원군', variant:'가족', brief:'test', stops:[{place:a,stay:30,walk:10},{place:b,stay:40,walk:5}]};

test('saved itineraries distinguish different routes and restore order after catalogue changes',()=>{
  const first=createEntry(mission,a,'record-1');
  const changed=createEntry({...mission,stops:[{place:c,stay:30,walk:10},mission.stops[1]]},c,'record-2');
  assert.notEqual(entryKey(first),entryKey(changed));
  assert.notEqual(planSignature(first),planSignature(changed));
  const reopened=resolveEntry(JSON.parse(JSON.stringify(first)),[c,b,a]);
  assert.deepEqual(reopened.mission.stops.map(s=>s.place.id),['a','b']);
  assert.equal(reopened.origin.id,'a');
  assert.equal(resolveEntry(first,[a,c]),null,'Missing saved place must not silently use another candidate');
});

test('personal plans store references only; public sharing excludes itinerary structure',()=>{
  const entry=createEntry({...mission,returnAt:'PRIVATE_TIME'}, {...a,unit:'PRIVATE_UNIT'},'record-1');
  const serialized=JSON.stringify(entry);
  for(const forbidden of ['PRIVATE_', 'lat', 'lon', 'overview', 'returnAt','image_url']) assert(!serialized.includes(forbidden));
  assert.equal(publicCard(entry).plan,undefined);
  assert.equal(publicCard(entry).recordId,undefined);
  const family={code:'ABCDEFGH',expiresAt:at.getTime()+10000,scopes:{passport:true,schedule:true,meal:false,propose:true,stamp:true}};
  const share=familyProjection(family,family.code,[entry],mission,'',at.getTime());
  assert.deepEqual(share.mission.placeNames,['a','b']);
  assert(!JSON.stringify(share).includes('originId'));
  assert.equal(familyProjection({...family,scopes:{...family.scopes,schedule:false}},family.code,[entry],mission,'',at.getTime()).mission,null);
});

test('preparation stamp does not claim a visit or completed travel record',()=>{
  const entry={...createEntry(mission,a),stamps:['휴가 씨앗']};
  assert.equal(hasVisitRecord(entry),false);
  assert.equal(hasVisitRecord({...entry,stamps:[...entry.stamps,'입경']}),true);
});

test('confirmed Tuesday closure blocks the flower garden even with positive return margin',()=>{
  const flower=p('tourapi:flower','고석정 꽃밭');
  const tuesday=new Date('2026-09-08T02:00:00Z');
  const s={...defaultSettings(tuesday),walkLimit:90,weather:'clear'};
  const r=assess({...mission,stops:[{place:flower,stay:30,walk:10},mission.stops[1]]},s,a,tuesday);
  assert(r.margin>45);
  assert.equal(r.band,'avoid');
  assert(r.issues.some(x=>x.includes('공식 정기 휴무일')));
  assert.equal(visitRestriction(flower,at,30),null);
  assert.match(visitRestriction(flower,new Date('2026-07-01T02:00:00Z')),/운영기간/);
  assert.match(visitRestriction(flower,new Date('2026-09-07T09:40:00Z'),30),/운영시간/);
  assert.equal(visitRestriction({...flower,sigungu:'고성군'},tuesday),null,'Do not merge same-name places across regions');
});

test('forecast provenance invalidates region changes, stale data and trips beyond its horizon',()=>{
  const forecast={region:'철원군',fetchedAt:at.toISOString(),validUntil:new Date(at.getTime()+8*3600000).toISOString(),baseDate:'20260907',baseTime:'0800'};
  const settings={...defaultSettings(at),weather:'clear',weatherForecast:forecast};
  assert.equal(effectiveWeather(settings,at).condition,'clear');
  assert.equal(effectiveWeather({...settings,region:'고성군'},at).condition,'unknown');
  assert.equal(effectiveWeather({...settings,returnAt:new Date(at.getTime()+24*3600000).toISOString()},at).condition,'unknown');
  assert.equal(effectiveWeather(settings,new Date(at.getTime()+4*3600000)).condition,'unknown');
  assert.equal(effectiveWeather({...settings,weather:'rain',weatherForecast:undefined},at).condition,'rain','Manual scenarios remain explicitly usable');
});

test('ordinary tourism candidates never acquire unsupported peace or military framing',()=>{
  const choices=makeMissions([a,b,c],defaultSettings(at));
  assert(!choices.some(m=>m.variant==='평화'));
  const peace={...c,title:'평화전망대'};
  assert(makeMissions([a,b,peace],defaultSettings(at)).some(m=>m.variant==='평화'));
});
