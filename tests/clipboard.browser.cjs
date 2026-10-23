/* Run against a local static server; all private data / Todoist calls are mocked. */
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
(async()=>{
 const out=process.env.GAIA_QA_DIR||'/tmp/gaia-clipboard-integration-qa';await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1400,height:1000},timezoneId:'America/Los_Angeles',acceptDownloads:true});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.pathname.endsWith('/functions/v1/orbit-todoist'))return route.fulfill({json:{results:[],next_cursor:null}});
  if(/\.js$/.test(u.pathname)&&!['app.js','pronunciation.js','gaia-config.js','clipboard-core.js','clipboard-store.js','clipboard.js'].some(x=>u.pathname.endsWith('/'+x)))return route.fulfill({contentType:'application/javascript',body:''});
  if(u.hostname!=='127.0.0.1')return route.abort();
  if(/\.(jpg|png|webp)$/.test(u.pathname))return route.fulfill({contentType:'image/gif',body:Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=','base64')});
  return route.continue();
 });
 await page.addInitScript(()=>{
  const owner='test-owner';
  const tables={gaia_pot_profiles:[{user_id:owner,plant_id:'02',inner_diameter_in:4,inner_depth_in:5,soil_mix:'nursery mix',drainage_holes:true,inner_material:'terracotta',updated_at:'old'}],plant_care_events:[{id:'old-water',user_id:owner,plant_id:'40',action_type:'water',happened_on:'2026-10-14',created_at:'old'}],gaia_soil_observations:[],gaia_custom_tasks:[{id:'task-groot',user_id:owner,plant_id:'02',title:'Inspect Groot for fresh growth',created_at:'2026-10-23T12:00:00Z',completed_at:null}]};
  window.__clipTestTables=tables;window.__clipTestWrites=[];
  const db={auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'test-session'}}}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'}})}},from(table){if(!Object.hasOwn(tables,table))throw Error('Unexpected table '+table);let op='read',data,filters=[],slice=null,one=false,ignore=false;const q={select(){return q;},eq(k,v){filters.push(r=>String(r[k])===String(v));return q;},is(k,v){filters.push(r=>r[k]===v);return q;},order(){return q;},range(a,b){slice=[a,b+1];return q;},limit(n){slice=[0,n];return q;},maybeSingle(){one=true;return q;},update(d){op='update';data=d;return q;},insert(d){op='insert';data=d;return q;},upsert(d,o){op='upsert';data=d;ignore=o.ignoreDuplicates;return q;},then(resolve,reject){try{let rows=tables[table].filter(r=>filters.every(f=>f(r)));if(op!=='read'){if(op==='update')rows.forEach(r=>Object.assign(r,data));else{const previous=tables[table].find(r=>data.id?r.id===data.id:r.user_id===data.user_id&&r.plant_id===data.plant_id);if(previous&&ignore)rows=[];else{const r={created_at:new Date().toISOString(),updated_at:new Date().toISOString(),...structuredClone(data)};tables[table].push(r);rows=[r];}}window.__clipTestWrites.push({table,op,data:structuredClone(data)});}if(slice)rows=rows.slice(...slice);return Promise.resolve({data:one?(structuredClone(rows[0])||null):structuredClone(rows),error:null}).then(resolve,reject);}catch(e){return Promise.reject(e).then(resolve,reject);}}};return q;}};
  window.GAIA_CLOUD={client:db,user:{id:owner}};window.GAIA_CARE={events:()=>[],pending:()=>false};window.GAIA_POT_SOIL={profile:()=>null,pending:()=>false};
 });
 await page.goto(process.env.GAIA_TEST_URL||'http://127.0.0.1:8765/',{waitUntil:'networkidle'});
 await page.locator('[data-clipboard-export]').click();
 await page.waitForFunction(()=>document.querySelector('#clip-export-summary').textContent.includes('48 plants'));
 assert.equal(await page.locator('.clip-page').count(),6);assert.equal(await page.locator('.clip-paper-plant').count(),48);
 assert.match(await page.locator('#gaia-clipboard-print').textContent(),/GAIA: 2026-10-14/);assert.match(await page.locator('#gaia-clipboard-print').textContent(),/Current: nursery mix/);
 await page.emulateMedia({media:'print'});
 await page.pdf({path:out+'/landscape-export.pdf',preferCSSPageSize:true,printBackground:true});
 await page.emulateMedia({media:'screen'});
 for(const kind of ['xlsx','csv','key']){const ready=page.waitForEvent('download');await page.locator('[data-clip="'+kind+'"]').click();const file=await ready;await file.saveAs(out+'/'+file.suggestedFilename());}
 const snapshot=await page.evaluate(()=>JSON.parse(localStorage.getItem('gaia-clipboard-sheets-v1-test-owner'))[0]);
 assert.equal(snapshot.plants.length,48);assert.equal(snapshot.plants.find(p=>p.plant_id==='02').task.id,'task-groot');
 await page.locator('[data-clip="close"]').click();await page.locator('[data-clipboard-import]').click();await page.locator('#clip-sheets').selectOption(snapshot.sheet_id);
 const payload={format:'gaia-clipboard-updates-v1',sheet_id:snapshot.sheet_id,visit_date:'2026-10-23',moisture_scale:'1-10',rows:[{plant_id:'02',watered_on:'2026-10-22',inner_diameter_in:6,new_growth:true,moisture_value:3,done:true,note:'Fresh leaf'},{plant_id:'11',new_growth:true}]};
 await page.locator('#clip-input').fill(JSON.stringify(payload));await page.locator('[data-clip="preview"]').click();await page.waitForFunction(()=>document.querySelectorAll('.clip-review-plant').length===2);
 assert.equal((await page.evaluate(()=>window.__clipTestWrites)).length,0,'Preview must not write anything.');
 await page.locator('[data-plant="11"] [data-include]').uncheck();await page.screenshot({path:out+'/review-desktop.png',fullPage:false});
 await page.locator('[data-clip="save"]').click();await page.waitForFunction(()=>document.querySelector('#clip-message').textContent.includes('4 updates saved and verified'));
 const saved=await page.evaluate(()=>window.__clipTestTables);assert.equal(saved.gaia_pot_profiles[0].inner_diameter_in,6);assert.equal(saved.gaia_pot_profiles[0].inner_depth_in,5);assert.equal(saved.gaia_pot_profiles[0].inner_material,'terracotta');assert.equal(saved.plant_care_events.length,2);assert.equal(saved.gaia_soil_observations.length,1);assert.equal(saved.gaia_soil_observations[0].plant_id,'02');assert.ok(saved.gaia_custom_tasks[0].completed_at);
 await page.locator('[data-clip="close"]').click();await page.locator('[data-clipboard-import]').click();await page.locator('#clip-sheets').selectOption(snapshot.sheet_id);await page.locator('#clip-input').fill(JSON.stringify({...payload,rows:[payload.rows[0]]}));await page.locator('[data-clip="preview"]').click();await page.waitForFunction(()=>document.querySelectorAll('.clip-review-plant').length===1);await page.locator('[data-clip="save"]').click();await page.waitForFunction(()=>document.querySelector('#clip-message').textContent.includes('4 already saved / unchanged'));
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/review-mobile.png'});assert.ok(await page.locator('#gaia-clipboard-dialog').evaluate(el=>el.getBoundingClientRect().width<=window.innerWidth));
 await page.evaluate(()=>document.dispatchEvent(new CustomEvent('gaia:auth',{detail:{client:window.GAIA_CLOUD.client,user:null}})));assert.equal(await page.locator('#clip-review fieldset').count(),0);assert.equal(await page.locator('#clip-input').inputValue(),'');assert.ok(await page.locator('[data-clip="save"]').isDisabled());
 assert.equal(errors.length,0,'Browser errors: '+errors.join('; '));
 console.log('Browser checks passed: 48 plants / 6 landscape pages, XLSX+CSV+scan-key downloads, preview without writes, selected save, repeat import, mobile layout, sign-out cleanup.');
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
