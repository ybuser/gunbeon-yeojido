import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanTravelState } from '../lib/account-state.ts';
import { mergeDeviceTravel } from '../lib/account-import.ts';
import { passwordHash, passwordMatches, validHandle, validPassword } from '../lib/account-crypto.ts';
const entry = {recordId:'r',missionId:'철원군-회복',title:'가족 여행',region:'철원군',stamps:[],plan:{originId:'public:1',variant:'내 코스',stops:[],kind:'custom',timeBudgetMinutes:240}};
const state = {version:3,entries:[entry],favorites:[],activeOuting:null};
test('account storage whitelists references and retains blank and legacy records',()=>{
 const clean = cleanTravelState({...state,image_url:'SECRET',apiKey:'SECRET',entries:[{...entry,raw:'SECRET'}, {missionId:'legacy',title:'옛 기록',region:'철원군',stamps:['입경'],recordStatus:'completed'}]});
 assert.equal(clean.entries[0].plan.stops.length,0); assert.equal(clean.entries[1].recordStatus,'completed'); assert(!JSON.stringify(clean).includes('SECRET'));
});
test('account rejects malformed nested or oversized records without silently dropping them',()=>{
 assert.throws(()=>cleanTravelState({...state,entries:[{...entry,plan:{...entry.plan,stops:[{placeId:'x',stay:NaN,walk:1}]}}]}));
 assert.throws(()=>cleanTravelState({...state,entries:Array(301).fill(entry)}));
});
test('import collision remaps active outing and preserves original; retry is idempotent',()=>{
 const deviceEntry = {...entry,title:'기기에서 출타 중',plan:{...entry.plan,stops:[{placeId:'public:2',stay:40,walk:10}]}};
 const device = {...state,entries:[deviceEntry],activeOuting:{entry:deviceEntry,startedAt:'2026-09-09T01:00:00Z',timeBudgetMinutes:240,completedStops:0,settings:{transport:'car',companion:'친구',walkLimit:30,extraBuffer:15}}};
 const merged = mergeDeviceTravel(state,device);
 assert.equal(merged.entries[0].title,entry.title);assert.equal(merged.activeOuting.entry.recordId,'import:r');assert.equal(merged.entries[1].recordId,'import:r');
 assert.equal(mergeDeviceTravel(merged,device).entries.length,2);
});
test('passwords use salted scrypt and verify exact credentials',async()=>{
 const password='a-long-private-password', a=await passwordHash(password),b=await passwordHash(password);
 assert.notEqual(a,b);assert(!a.includes(password));assert(await passwordMatches(password,a));assert(!await passwordMatches('wrong-password',a));
 assert(!validPassword('1234'));assert(!validHandle('Bad/handle'));assert(validHandle('travel_2026'));
});
