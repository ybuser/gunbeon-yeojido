import fs from 'node:fs';
import {makeMissions,defaultSettings,chooseOrigin,assess} from '../web/lib/domain.ts';
const nodes=JSON.parse(fs.readFileSync('data/processed/place_nodes_gangwon.json'));
const referenceTime=new Date('2026-09-07T10:00:00+09:00');
const sample=['철원군','화천군','양구군','인제군','고성군'].flatMap(region=>{const s={...defaultSettings(referenceTime),region,walkLimit:60};const origin=chooseOrigin(nodes,s);return makeMissions(nodes,s).map(m=>({...m,stops:m.stops.map(x=>({place_id:x.place.id,title:x.place.title,stay_minutes_estimated:x.stay,walk_minutes_estimated:x.walk})),sample_assumptions:{synthetic_clock:true,reference_time:referenceTime.toISOString(),duration_minutes:240,transport:'car',origin_id:origin.id,weather:'unknown'},assessment:assess(m,s,origin,referenceTime),publication_state:'draft_conditions_unverified',eligible_for_verified_recommendation:false}))});
fs.writeFileSync('data/processed/sample_missions.json',JSON.stringify(sample,null,2));console.log(sample.length+'개 미션 초안 생성 · 운영 검증 미완료');
