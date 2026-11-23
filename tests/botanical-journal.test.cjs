/* Offline contracts for the collection-first botanical journal. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const core=require("../botanical-journal-core.js");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const plants=JSON.parse(read("plants.json")).plants;

test("Journal indexes all plants by common name, not their personal nickname",()=>{
  const ordered=core.sortedPlants(plants);
  assert.equal(ordered.length,plants.length);
  assert.equal(new Set(ordered.map(p=>p.id)).size,plants.length);
  const sorter=new Intl.Collator("en",{sensitivity:"base",numeric:true});
  for(let i=1;i<ordered.length;i++){
    assert.ok(sorter.compare(core.commonName(ordered[i-1]),core.commonName(ordered[i]))<=0,
      "Out of alphabetic order: "+ordered[i-1].name+" before "+ordered[i].name);
  }
  const sovereign=ordered.find(p=>p.id==="50");
  assert.equal(core.commonName(sovereign),"Monstera");
  assert.ok(ordered.findIndex(p=>p.id==="50")<ordered.findIndex(p=>p.id==="04"),
    "Monstera should sort before Venus flytrap, not according to Sovereign's nickname");
  assert.equal(core.commonName({name:"Mystery",commonNames:[]}),"Unidentified specimen");
});

test("Recent field note uses explicitly dated observed growth, not species trivia",()=>{
  const sample={
    history:{notes:[
      {bodyHtml:"<strong>Oct 15, 2026 · </strong>New growth is unfurling."},
      {bodyHtml:"<strong>Nov 20, 2026 · </strong>A new leaf unfurled with pale markings."}
    ]}
  };
  const found=core.recentObservation(sample,new Date("2026-11-23T12:00:00Z"));
  assert.equal(found.date,"2026-11-20");
  assert.match(found.text,/new leaf/);
  assert.doesNotMatch(found.text,/<strong>/);
});

test("Plans, catalog uploads and unverified or stale growth notes never become current highlights",()=>{
  const now=new Date("2026-11-23T12:00:00Z");
  const bad={
    history:{notes:[
      {bodyHtml:"<strong>Nov 22, 2026 · </strong>Planning to grow new shoots."},
      {bodyHtml:"<strong>Nov 19, 2026 · </strong>Catalog photo uploaded; new growth not confirmed."},
      {bodyHtml:"<strong>Mar 11, 2026 · </strong>A new leaf appeared."}
    ]}
  };
  assert.equal(core.recentObservation(bad,now),null);
  const puck=plants.find(p=>p.id==="92");
  assert.equal(core.recentObservation(puck,now),null,"Administrative swap notes are not growth observations");
  assert.equal(core.recentObservation({history:{notes:[]}},now),null);
});

test("Journal is a presentation layer; original care, collection controls and IDs survive",()=>{
  const html=read("index.html"),js=read("botanical-journal.js"),css=read("botanical-journal.css");
  assert.ok(html.includes('src="botanical-journal-core.js'));
  assert.ok(html.includes('src="botanical-journal.js'));
  assert.ok(html.includes('href="botanical-journal.css'));
  assert.ok(html.indexOf('src="botanical-journal-core.js')<html.indexOf('src="botanical-journal.js'));
  assert.match(js,/gaia:ready/);
  assert.match(js,/GAIA_COLLECTION_BROWSER/);
  assert.match(js,/\.gaia-journal-card-mode/);
  assert.match(js,/openFullRecord/);
  assert.doesNotMatch(js,/\.from\(["']plant_care_events/);
  assert.doesNotMatch(js,/appendChild\(card\)/);
  assert.match(css,/#gaia-care-center\.gaia-journal-mode #grid/);
  assert.match(css,/gaia-journal-card-mode/);
  assert.ok(html.includes('src="photos.js'),"Original private photo journal loader must remain");
  assert.ok(html.includes('src="care.js'),"Original care journal loader must remain");
});
