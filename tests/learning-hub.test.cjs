/* Regression checks for GAIA learning content and stable plant associations.
   Runs offline with Node core only: node --test tests/learning-hub.test.cjs */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const plants = JSON.parse(read("plants.json")).plants;
function evaluate(name, target) {
  vm.runInNewContext(read(name), {window:target}, {filename:name});
  return target;
}
const guide = evaluate("species-guide.js", {}).GAIA_SPECIES_GUIDE;
const learning = evaluate("group-learning.js", {}).GAIA_GROUP_LEARNING;
const ids = new Set(plants.map(p=>String(p.id)));

test("Each plant has one stable ID, known family and an educated care type",()=>{
  assert.equal(plants.length,48);
  assert.equal(ids.size,plants.length);
  for(const p of plants) {
    assert.match(p.id,/^\d\d$/);
    assert.ok(guide.byPlant[p.id],p.name+" missing species mapping");
    assert.ok(guide.taxa[guide.byPlant[p.id]]?.family,p.name+" missing family");
    assert.ok(learning.families[guide.taxa[guide.byPlant[p.id]].family],p.name+" missing family lesson");
    assert.ok(learning.types[p.cardCare.type],p.name+" missing type lesson");
  }
  assert.equal(Object.keys(learning.types).length,18);
  assert.equal(Object.keys(learning.families).length,23);
});

test("Every type and family lesson teaches what, recognition, growing conditions and limits",()=>{
  for(const category of [learning.types,learning.families]) {
    for(const [name,item] of Object.entries(category)){
      for(const field of ["about","recognize","conditions","learn"]) {
        assert.ok(typeof item[field]==="string" && item[field].length>24, name+" missing "+field);
      }
    }
  }
});

test("Academy uses valid catalog plant IDs for examples and practice groups",()=>{
  const source=read("learning-hub.js");
  const list=[...source.matchAll(/(?:practice|ids):\s*\[([^\]]*)\]/g)];
  assert.ok(list.length>=10);
  for(const match of list){
    const examples=[...match[1].matchAll(/"(\d\d)"/g)];
    assert.ok(examples.length>0);
    for(const id of examples)assert.ok(ids.has(id[1]),"Unknown practice plant "+id[1]);
  }
});

test("Original photo and care UI resolve the plant by stable card ID",()=>{
  const photos=read("photos.js");
  const care=read("care.js");
  const soil=read("pot-soil.js");
  const hub=read("learning-hub.js");
  assert.match(photos,/plantsById\.get\(id\)/);
  assert.match(photos,/covers\.set\(id,/);
  assert.doesNotMatch(photos,/const p\s*=\s*plants\[i\]/);
  assert.match(care,/plantsById\.get\(card\.dataset\.plantId\)/);
  assert.doesNotMatch(care,/const plant\s*=\s*plants\[i\]/);
  assert.doesNotMatch(soil,/\|\|\s*arr\[i\]/);
  assert.match(hub,/dataset\.plantId\s*===\s*String\(id\)/);
  assert.doesNotMatch(hub,/cloneNode/);
  assert.doesNotMatch(hub,/\.from\(["']plant_photos["']\)/);
});

test("Academy and library scripts run after species metadata and plant ordering",()=>{
  const html=read("index.html");
  const order=["species-guide.js","app.js","group-learning.js","collection-grouping.js","photos.js","plant-order.js","learning-hub.js"];
  const positions=order.map(file=>html.indexOf('src="'+file));
  assert.ok(positions.every(x=>x>=0));
  for(let i=1;i<positions.length;i++)assert.ok(positions[i]>positions[i-1],order[i]+" loaded out of sequence");
  assert.ok(html.includes('href="learning-hub.css'));
});
