/* Regression guard for the retired Propagation Nursery.
   History is retained under Supabase owner-only policies; no live Nursery UI exists. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname,"..");
const read = name => fs.readFileSync(path.join(root,name),"utf8");

test("Navigation has exactly the three intended sections and valid tab order",()=>{
  const hub=read("learning-hub.js"), css=read("learning-hub.css");
  const html=read("index.html");
  assert.match(hub,/const collections = \{care:null,academy:null,botany:null\};/);
  assert.match(hub,/const order=\["care","academy","botany"\];/);
  assert.match(hub,/parent\.insertBefore\(academy,care\.nextSibling\)/);
  assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(hub,/nursery|gaia-propagation-nursery/i);
  assert.doesNotMatch(html,/propagation-nursery/i);
  assert.doesNotMatch(read("compact-shell.css"),/including Nursery/);
  assert.doesNotThrow(()=>new (require("node:vm").Script)(hub));
});

test("Removed Nursery bundles cannot accidentally reload",()=>{
  for(const name of ["propagation-nursery.js","propagation-nursery.css","tests/propagation-nursery.test.cjs"]){
    assert.equal(fs.existsSync(path.join(root,name)),false,name+" should be retired");
  }
});

test("Care workflow and protected historical Nursery schema remain intact",()=>{
  const html=read("index.html");
  const sql=read("supabase/gaia_propagation_nursery.sql");
  const mcp=read("supabase/functions/conservatory-mcp/index.ts");
  assert.match(html,/<script src="care\.js/);
  assert.match(mcp,/record_care_event/);
  assert.match(sql,/enable row level security/);
  assert.match(sql,/auth\.jwt\(\)->>'aal'\)='aal2'/);
  assert.match(read("README.md"),/not a data deletion or security-policy migration/);
});
