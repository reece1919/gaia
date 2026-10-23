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
  const order=["species-guide.js","app.js","group-learning.js","collection-grouping.js","photos.js","plant-order.js","learning-hub.js","compact-shell.js"];
  const positions=order.map(file=>html.indexOf('src="'+file));
  assert.ok(positions.every(x=>x>=0));
  for(let i=1;i<positions.length;i++)assert.ok(positions[i]>positions[i-1],order[i]+" loaded out of sequence");
  assert.ok(html.includes('href="learning-hub.css'));
  assert.ok(html.includes('href="compact-shell.css'));
});


test("Compact shell moves, never clones, task/search/card and photo-review UI",()=>{
  class FakeNode {
    constructor(tag="div", id="", className="") {
      this.tagName=tag; this.id=id; this.className=className;
      this.childNodes=[]; this.parentElement=null; this.textContent="";
    }
    get nextSibling() {
      if(!this.parentElement)return null;
      const siblings=this.parentElement.childNodes;
      return siblings[siblings.indexOf(this)+1]||null;
    }
    insertBefore(node,other) {
      if(node.parentElement){
        const prior=node.parentElement.childNodes;
        const index=prior.indexOf(node);
        if(index>=0)prior.splice(index,1);
      }
      node.parentElement=this;
      const target=other==null?this.childNodes.length:this.childNodes.indexOf(other);
      assert.ok(target>=0);
      this.childNodes.splice(target,0,node);
      return node;
    }
    append(...items) {items.forEach(item=>this.insertBefore(item,null));}
    appendChild(item){return this.insertBefore(item,null);}
    after(item){assert.ok(this.parentElement);this.parentElement.insertBefore(item,this.nextSibling);}
    querySelector(selector){
      const name=selector.replace(/^[.#]/,"");
      for(const node of this.childNodes){
        if(selector.startsWith("#")?node.id===name:node.className.split(/\s+/).includes(name))return node;
        const inner=node.querySelector(selector);
        if(inner)return inner;
      }
      return null;
    }
  }
  const root=new FakeNode();
  const hero=new FakeNode("header", "hero");
  const review=new FakeNode("div","","gaia-review-launch");
  const totals=new FakeNode("div","","gaia-hero-stats");
  hero.append(review, totals);
  root.appendChild(hero);
  const care=new FakeNode("main","gaia-care-center");
  root.appendChild(care);
  const overview=new FakeNode("div","","gaia-care-overview-panel");
  const flags=new FakeNode("details","","gaia-care-attention-details");
  const priorityList=new FakeNode("div","","gaia-care-priority-list");
  flags.appendChild(priorityList);
  overview.appendChild(flags);
  const clipboard=new FakeNode("section","gaia-clipboard");
  const tasks=new FakeNode("details","gaia-tasks");
  const insights=new FakeNode("details","gaia-insights");
  const controls=new FakeNode("div","controls");
  const guide=new FakeNode("details","","card-icon-guide");
  const grouping=new FakeNode("nav","","gaia-collection-toolbar");
  const grid=new FakeNode("div","grid");
  const originalCard=new FakeNode("details","plant-02","card");
  const existingPhoto=new FakeNode("section","journal-02","plant-photo-journal");
  originalCard.appendChild(existingPhoto);
  grid.appendChild(originalCard);
  const empty=new FakeNode("div","empty");
  const recent=new FakeNode("section","recent-care");
  care.append(overview,clipboard,tasks,insights,controls,guide,grouping,grid,empty,recent);
  const document={
    getElementById:id=>(root.id===id?root:root.querySelector("#"+id)),
    querySelector:selector=>root.querySelector(selector),
    createElement:tag=>new FakeNode(tag)
  };
  vm.runInNewContext(read("compact-shell.js"),{document},{filename:"compact-shell.js"});
  const drawer=root.querySelector("#gaia-care-utilities");
  assert.ok(drawer);
  assert.equal(drawer.tagName,"details");
  assert.notEqual(drawer.open,true,"drawer must start folded");
  assert.deepEqual(care.childNodes.slice(0,7),[overview,tasks,drawer,controls,grouping,grid,empty]);
  assert.equal(drawer.querySelector("#gaia-clipboard"),clipboard);
  assert.equal(drawer.querySelector("#gaia-insights"),insights);
  assert.equal(drawer.querySelector(".gaia-review-launch"),review);
  assert.equal(drawer.querySelector(".card-icon-guide"),guide);
  assert.equal(drawer.querySelector(".gaia-care-attention-details"),flags);
  assert.equal(flags.querySelector(".gaia-hero-stats"),totals);
  assert.equal(totals.parentElement,flags);
  assert.equal(flags.querySelector(".gaia-care-priority-list"),priorityList);
  assert.equal(grid.childNodes[0],originalCard);
  assert.equal(originalCard.childNodes[0],existingPhoto);
  assert.equal(recent.parentElement,care);
});

test("Mobile navigation uses short destinations and compact header without hiding attention count",()=>{
  const css=read("compact-shell.css");
  const hub=read("learning-hub.js");
  assert.match(css, /max-width:699px/);
  assert.match(css, /position:sticky/);
  assert.match(css, /#gaia-hub-tabs/);
  assert.match(css, /\.gaia-hub-tab-short\{display:inline\}/);
  assert.match(css, /\.gaia-tablet-desk\{display:none!important\}/);
  assert.doesNotMatch(css, /#gaia-attention-count\s*\{\s*display:none/);
  assert.match(hub,/gaia-care-attention-details/);
  assert.match(hub,/Review " \+ attention\.length/);
});
