/* GAIA Nursery offline regression checks: node --test tests/propagation-nursery.test.cjs */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname,"..");
const read = name => fs.readFileSync(path.join(root,name),"utf8");

test("Nursery tab loads after the GAIA learning hub and shared sign-in",()=>{
  const html=read("index.html"),hub=read("learning-hub.js"),css=read("learning-hub.css");
  const order=["care.js","learning-hub.js","propagation-nursery.js"];
  const locations=order.map(f=>html.indexOf('src="'+f));
  assert.ok(locations.every(n=>n>0));
  assert.ok(locations[0]<locations[1] && locations[1]<locations[2]);
  assert.ok(html.includes('href="propagation-nursery.css'));
  for(const key of ["care","nursery","academy","botany"]) {
    assert.ok(hub.includes('"'+key+'"'),key+" tab absent");
  }
  assert.match(hub,/gaia-propagation-nursery/);
  assert.match(css,/repeat\(4,minmax\(0,1fr\)\)/);
});
test("Nursery code parses and uses private Supabase records, not GitHub write credentials",()=>{
  const js=read("propagation-nursery.js");
  assert.doesNotThrow(()=>new vm.Script(js));
  for(const table of ["gaia_propagation_batches","gaia_propagation_cuttings","gaia_propagation_photos"])assert.ok(js.includes(table));
  assert.ok(js.includes("gaia:auth"));
  assert.ok(js.includes('currentLevel==="aal2"'));
  assert.ok(js.includes("createSignedUrls"));
  assert.ok(js.includes("Copy catalog brief"));
  assert.doesNotMatch(js,/service_role|GITHUB_TOKEN|github_pat_|ghp_/i);
});
test("Nursery policies require matching owner and AAL2",()=>{
  const sql=read("supabase/gaia_propagation_nursery.sql");
  for(const table of ["batches","cuttings","photos"]) {
    assert.ok(sql.includes("alter table public.gaia_propagation_"+table+" enable row level security"));
    assert.ok(sql.includes("gaia_prop_"+table+"_select"));
  }
  assert.ok(sql.includes("constraint gaia_prop_cutting_owner_batch"));
  assert.ok(sql.includes("constraint gaia_prop_photo_owner_cutting"));
  assert.ok(sql.includes("gaia_prop_storage_insert"));
  assert.match(sql,/auth\.jwt\(\)->>'aal'/);
  assert.match(sql,/auth\.uid\(\)/);
  assert.match(sql,/false,8388608/);
});
test("Jango clone group is archived and no longer inflates collection count",()=>{
  const catalog=JSON.parse(read("plants.json"));
  const archive=JSON.parse(read("archive/clone-force-17-legacy-catalog.json"));
  const names=new Set(catalog.plants.map(p=>p.name));
  assert.ok(catalog.plants.some(p=>p.id==="45" && p.name==="Jango"));
  assert.ok(!catalog.plants.some(p=>p.id==="65"));
  assert.equal(archive.source_record.id,"65");
  assert.equal(archive.source_record.name,"Clone Force 17");
  assert.ok(["Grog","Gahg","Duhg"].every(name=>names.has(name)));
});
