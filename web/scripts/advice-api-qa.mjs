import { request } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const base=process.env.QA_BASE_URL||'http://localhost:3000';
const out=process.env.QA_OUT_DIR||'../tmp/qa/advice-api';
const places=JSON.parse(await readFile(new URL('../lib/data/places.json',import.meta.url),'utf8')).filter(p=>p.sigungu==='고성군');
const [a,b,c,d]=places.map(p=>p.id);const cases=[],created=[];
const owner=await request.newContext({baseURL:base}),guest=await request.newContext({baseURL:base}),outsider=await request.newContext({baseURL:base});
const headers={origin:base,'Content-Type':'application/json'};
const post=(ctx,path,data,h=headers)=>ctx.post(path,{data,headers:h});
const snapshot={region:'고성군',question:'change',placeIds:[a,b]};
const proposal={kind:'replace',targetId:b,placeId:c,reason:'제가 좋아하는 곳이에요'};
async function check(name,fn){await fn();cases.push(name);console.log('PASS '+name);}
try{
 await check('core API remains password protected',async()=>assert.equal((await guest.get('/api/catalog')).status(),401));
 assert.equal((await post(owner,'/api/test-access',{password:process.env.QA_PASSWORD||'1234'})).status(),200);
 let id,suggestionId;
 await check('publish whitelist rejects manual references',async()=>assert.equal((await post(owner,'/api/advice',{action:'create',snapshot:{...snapshot,placeIds:['manual:private']}})).status(),400));
 await check('publish ignores extra private fields and exposes no capability',async()=>{
  const r=await post(owner,'/api/advice',{action:'create',snapshot:{...snapshot,title:'SECRET',departureAt:'2026-09-21',ownerHash:'FORGED'}});assert.equal(r.status(),201);const data=await r.json();id=data.id;created.push(id);
  const response=await guest.get('/api/public-advice/'+id);assert.equal(response.status(),200);const detail=await response.json();assert.deepEqual(detail.snapshot,snapshot);assert.equal(detail.owner,false);
  for(const key of ['owner_hash','visitorHash','departureAt','SECRET','FORGED','lat','lon','address'])assert.equal(Object.hasOwn(detail,key),false);
 });
 await check('public page renders privacy-safe metadata without test password',async()=>{const r=await guest.get('/p/'+id);assert.equal(r.status(),200);const html=await r.text();assert.ok(html.includes('og:title'));assert.ok(html.includes('한 곳만 바꾼다면'));assert.equal(html.includes('SECRET'),false);});
 await check('CSRF and foreign ownership cannot mutate a share',async()=>{
  assert.equal((await post(guest,'/api/public-advice/'+id,{action:'suggest',suggestion:proposal},{...headers,origin:'https://evil.invalid'})).status(),403);
  assert.equal((await post(outsider,'/api/test-access',{password:process.env.QA_PASSWORD||'1234'})).status(),200);
  assert.equal((await post(outsider,'/api/advice',{action:'delete',id})).status(),403);
  assert.equal((await outsider.get('/api/advice?id='+id)).status(),403);
 });
 await check('guest adds one idempotent concrete proposal',async()=>{
  const response=await post(guest,'/api/public-advice/'+id,{action:'suggest',suggestion:proposal});assert.equal(response.status(),201);suggestionId=(await response.json()).id;
  const repeated=await post(guest,'/api/public-advice/'+id,{action:'suggest',suggestion:proposal});assert.equal((await repeated.json()).id,suggestionId);
  const detail=await (await guest.get('/api/public-advice/'+id)).json();assert.equal(detail.suggestions.length,1);assert.equal(detail.suggestions[0].own,true);assert.equal('visitorHash' in detail.suggestions[0],false);
 });
 await check('reports reach owner; foreign guest cannot withdraw',async()=>{
  await outsider.get('/api/public-advice/'+id);
  assert.equal((await post(outsider,'/api/public-advice/'+id,{action:'withdraw',suggestionId})).status(),403);
  assert.equal((await post(outsider,'/api/public-advice/'+id,{action:'report',suggestionId})).status(),200);
  const detail=await (await owner.get('/api/advice?id='+id)).json();assert.equal(detail.suggestions[0].reported,true);
 });
 await check('withdraw then re-propose cannot receive stale adoption',async()=>{
  assert.equal((await post(guest,'/api/public-advice/'+id,{action:'withdraw',suggestionId})).status(),200);
  const response=await post(guest,'/api/public-advice/'+id,{action:'suggest',suggestion:{...proposal,placeId:d}});assert.equal(response.status(),201);const fresh=(await response.json()).id;assert.notEqual(fresh,suggestionId);
  assert.equal((await post(owner,'/api/advice',{action:'adopt',id,suggestionId})).status(),404);suggestionId=fresh;
  assert.equal((await post(owner,'/api/advice',{action:'adopt',id,suggestionId})).status(),200);
  assert.equal((await (await guest.get('/api/public-advice/'+id)).json()).suggestions[0].status,'adopted');
 });
 await check('close, reopen, unmark and hide retain original public snapshot',async()=>{
  assert.equal((await post(owner,'/api/advice',{action:'close',id})).status(),200);
  assert.equal((await post(outsider,'/api/public-advice/'+id,{action:'suggest',suggestion:proposal})).status(),409);
  assert.equal((await post(owner,'/api/advice',{action:'reopen',id})).status(),200);
  assert.equal((await post(owner,'/api/advice',{action:'unmark',id,suggestionId})).status(),200);
  assert.equal((await post(owner,'/api/advice',{action:'hide',id,suggestionId})).status(),200);
  const detail=await (await outsider.get('/api/public-advice/'+id)).json();assert.deepEqual(detail.snapshot,snapshot);assert.equal(detail.suggestions.length,0);
 });
 await check('delete withdraws public reading, searching and new participation',async()=>{
  assert.equal((await post(owner,'/api/advice',{action:'delete',id})).status(),200);created.splice(created.indexOf(id),1);
  assert.equal((await guest.get('/api/public-advice/'+id)).status(),404);assert.equal((await guest.get('/api/public-advice/'+id+'?q=카페')).status(),404);
 });
 await mkdir(out,{recursive:true});await writeFile(out+'/results.json',JSON.stringify({status:'passed',at:new Date().toISOString(),base,cases,mode:'real local/production D1, isolated HTTP cookie contexts; base public catalog only; no TourAPI or map calls'},null,2));
}finally{for(const id of created)await post(owner,'/api/advice',{action:'delete',id});await owner.dispose();await guest.dispose();await outsider.dispose();}
