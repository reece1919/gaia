const test=require('node:test');
const assert=require('node:assert/strict');
global.crypto=require('node:crypto').webcrypto;
const C=require('../clipboard-core.js'),S=require('../clipboard-store.js');
const owner='owner-1',plants=[{id:'02',name:'Groot'},{id:'11',name:'Karlach'}];
const snapshot={format:C.FORMAT,sheet_id:'GAIA-test-12345678',owner_id:owner,visit_date:'2026-10-23',moisture_scale:'1-10',plants:plants.map(p=>({plant_id:p.id,name:p.name,common_name:'Plant',profile:null,task:p.id==='02'?{id:'task-1',kind:'gaia',title:'Inspect Groot'}:null}))};
const payload=rows=>({format:C.UPDATE_FORMAT,sheet_id:snapshot.sheet_id,visit_date:snapshot.visit_date,moisture_scale:'1-10',rows});
function fakeDB(){
 const tables={gaia_pot_profiles:[{user_id:owner,plant_id:'02',inner_diameter_in:4,inner_depth_in:5,soil_mix:'nursery mix',inner_material:'terracotta',clear_inner:false,drainage_holes:true,outer_pot:'green',repotted_on:'2026-10-01',updated_at:'old'}],plant_care_events:[],gaia_soil_observations:[],gaia_custom_tasks:[{id:'task-1',user_id:owner,plant_id:'02',title:'Inspect Groot',completed_at:null}]};
 const writes=[],fail=new Set();
 return {tables,writes,fail,from(table){assert.ok(Object.hasOwn(tables,table),'Unexpected table '+table);let op='read',data,filters=[],slice=null,one=false,returning=false,ignore=false;
  const q={select(){returning=true;return q;},eq(k,v){filters.push(r=>String(r[k])===String(v));return q;},is(k,v){filters.push(r=>r[k]===v);return q;},order(){return q;},range(a,b){slice=[a,b+1];return q;},limit(n){slice=[0,n];return q;},maybeSingle(){one=true;return q;},update(d){op='update';data=d;return q;},insert(d){op='insert';data=d;return q;},upsert(d,o){op='upsert';data=d;ignore=o.ignoreDuplicates;return q;},then(resolve,reject){try{
   let rows=tables[table].filter(r=>filters.every(f=>f(r)));
   if(op!=='read'){
    if(fail.has(table))return Promise.resolve({data:null,error:{message:'Simulated write failure'}}).then(resolve,reject);
    if(op==='update'){for(const r of rows)Object.assign(r,data);}
    else{const existing=tables[table].find(r=>data.id?r.id===data.id:r.user_id===data.user_id&&r.plant_id===data.plant_id);if(existing&&ignore)rows=[];else if(existing)return Promise.resolve({data:null,error:{message:'Duplicate'}}).then(resolve,reject);else{const r={created_at:new Date().toISOString(),updated_at:new Date().toISOString(),...structuredClone(data)};tables[table].push(r);rows=[r];}}
    writes.push({table,op,data:structuredClone(data)});
   }
   if(slice)rows=rows.slice(...slice);return Promise.resolve({data:one?(structuredClone(rows[0])||null):structuredClone(rows),error:null}).then(resolve,reject);
  }catch(e){return Promise.reject(e).then(resolve,reject);}}};return q;
 }};
}
test('blank / unchecked fields do not erase data; zero moisture is a real update',()=>{
 const d=C.normalize(payload([{plant_id:'02',new_growth:false,done:false,soil_mix:'',inner_depth_in:null},{plant_id:'11',moisture_value:0}]),snapshot);
 assert.equal(d.rows.length,1);assert.deepEqual(d.rows[0],{plant_id:'11',moisture_value:0,moisture_scale:'1-10'});
});
test('reject mismatched sheets, duplicate / unknown IDs, future / invalid dates, invalid readings and dimensions',()=>{
 for(const doc of [{...payload([]),sheet_id:'other'},payload([{plant_id:'2',new_growth:true}]),payload([{plant_id:'02',new_growth:true},{plant_id:'02',done:true}]),{...payload([]),visit_date:'2026-02-30'},payload([{plant_id:'02',watered_on:'2099-01-01'}]),payload([{plant_id:'02',moisture_value:11}]),payload([{plant_id:'02',inner_diameter_in:0}]),payload([{plant_id:'11',done:true}])])assert.throws(()=>C.normalize(doc,snapshot,'2026-10-23'));
 assert.throws(()=>C.validateSnapshot(snapshot,plants,'someone-else'));
});
test('CSV round trip handles quoted newlines and preserves IDs; unedited CSV has no updates',()=>{
 const s=structuredClone(snapshot);s.plants[0].name='Groot, "test"\nname';s.plants[0].profile={soil_mix:'=formula()',inner_diameter_in:4};
 const csv=C.csv(s),parsed=C.parseCSV(csv);assert.equal(parsed.rows[0].plant_id,'02');assert.equal(parsed.rows[0].plant,s.plants[0].name);assert.equal(parsed.rows[0].recorded_soil_mix,"'=formula()");assert.equal(C.normalize(parsed,s).rows.length,0);
 assert.throws(()=>C.parseCSV(csv+'\n"bad'));assert.throws(()=>C.parseCSV('plant_id\n02'));
});
test('scan prompt does not request API use or inference from task completion',()=>{const p=C.prompt(snapshot);assert.match(p,/Never infer watering/);assert.match(p,/leading zero/);assert.match(p,/does not save|before saving/);});
test('save all components, preserve unrelated pot details, and make retries idempotent',async()=>{
 const db=fakeDB(),service=S.create({client:db,owner,guard:async()=>{}}),ctx=await service.load();
 const doc=C.normalize(payload([{plant_id:'02',watered_on:'2026-10-22',inner_diameter_in:6,soil_mix:'bark + perlite',moisture_value:3,new_growth:true,note:'New leaf',done:true}]),snapshot);
 const result=await service.saveRow(doc.rows[0],doc,snapshot,ctx);assert.deepEqual(result.errors,[]);assert.equal(result.saved.length,4);
 const pot=db.tables.gaia_pot_profiles[0];assert.equal(pot.inner_diameter_in,6);assert.equal(pot.inner_depth_in,5);assert.equal(pot.inner_material,'terracotta');assert.equal(pot.drainage_holes,true);assert.equal(pot.repotted_on,'2026-10-01');
 const retry=await service.saveRow(doc.rows[0],doc,snapshot,ctx);assert.equal(retry.saved.length,0);assert.equal(retry.errors.length,0);assert.equal(retry.skipped.length,4);assert.equal(db.tables.plant_care_events.length,1);assert.equal(db.tables.gaia_soil_observations.length,1);
});
test('duplicate sheet cannot overwrite a previous observation',async()=>{
 const db=fakeDB(),service=S.create({client:db,owner,guard:async()=>{}}),ctx=await service.load();
 const doc=C.normalize(payload([{plant_id:'02',note:'First note'}]),snapshot);await service.saveRow(doc.rows[0],doc,snapshot,ctx);
 const result=await service.saveRow({plant_id:'02',note:'Changed note'},doc,snapshot,ctx);assert.equal(result.errors.length,1);assert.equal(db.tables.gaia_soil_observations[0].note,'First note');
});
test('pot conflict and edited task are reported without writing them; other successful changes survive',async()=>{
 const db=fakeDB(),service=S.create({client:db,owner,guard:async()=>{}}),ctx=await service.load();db.tables.gaia_pot_profiles[0].updated_at='newer';db.tables.gaia_custom_tasks[0].title='Edited task';
 const doc=C.normalize(payload([{plant_id:'02',inner_diameter_in:8,watered_on:'2026-10-21',done:true}]),snapshot);
 const result=await service.saveRow(doc.rows[0],doc,snapshot,ctx);assert.equal(result.errors.length,2);assert.deepEqual(result.saved,['Watering']);assert.equal(db.tables.gaia_pot_profiles[0].inner_diameter_in,4);assert.equal(db.tables.gaia_custom_tasks[0].completed_at,null);
});
test('partial database failure preserves verified results and is safe to retry',async()=>{
 const db=fakeDB(),service=S.create({client:db,owner,guard:async()=>{}}),ctx=await service.load();db.fail.add('gaia_soil_observations');
 const doc=C.normalize(payload([{plant_id:'02',watered_on:'2026-10-21',new_growth:true}]),snapshot);const r=await service.saveRow(doc.rows[0],doc,snapshot,ctx);assert.equal(r.errors.length,1);assert.equal(r.saved.length,1);db.fail.clear();const again=await service.saveRow(doc.rows[0],doc,snapshot,ctx);assert.equal(again.saved.length,1);assert.equal(again.skipped.length,1);
});
test('session guard prevents all writes after an account change',async()=>{const db=fakeDB(),service=S.create({client:db,owner,guard:async()=>{throw Error('Sign-in changed');}});const doc=C.normalize(payload([{plant_id:'02',new_growth:true,done:true,watered_on:'2026-10-22',inner_diameter_in:8}]),snapshot);const r=await service.saveRow(doc.rows[0],doc,snapshot,{profiles:{}});assert.equal(r.errors.length,4);assert.equal(db.writes.length,0);});
test('Todoist completion uses only the task bound to the selected printed plant',async()=>{const db=fakeDB(),calls=[],service=S.create({client:db,owner,guard:async()=>{},completeTodoist:async task=>{calls.push(task);return 'saved';}}),ctx=await service.load(),s=structuredClone(snapshot);s.plants[0].task={id:'todoist-1',kind:'todoist',title:'Inspect Groot'};const doc=C.normalize(payload([{plant_id:'02',done:true}]),s);assert.equal((await service.saveRow(doc.rows[0],doc,s,ctx)).errors.length,0);assert.deepEqual(calls,[s.plants[0].task]);});
