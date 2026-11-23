import test from "node:test";
import assert from "node:assert/strict";
import {inspectCatalogChange} from "../scripts/conservatory-catalog-guard.mjs";
const mk=(id,name)=>({
  id,name,species:"Unidentified (pending confirmation)",searchName:name.toLowerCase(),
  searchSpecies:"unidentified",status:"Unassessed",photo:"",photoAlt:"",
  newAddition:true,pest:"unconfirmed",added:"2026-11-20",tags:[],
  sections:[],history:{facts:[],notes:[]},cardCare:{type:"other"}
});
const baseline={schemaVersion:1,plants:[mk("50","Sovereign"),mk("111","Zoidberg")]};
const clone=x=>structuredClone(x);
test("unchanged catalog and stable-ID field edits are valid",()=>{
  assert.equal(inspectCatalogChange(baseline,clone(baseline)).ok,true);
  const next=clone(baseline);next.plants[0].status="Needs inspection";
  const r=inspectCatalogChange(baseline,next);
  assert.equal(r.ok,true);assert.deepEqual(r.updated,["50"]);
});
test("a new complete acquisition is reported, not treated as a second ledger",()=>{
  const next=clone(baseline);next.plants.push(mk("112","New Arrival"));
  const r=inspectCatalogChange(baseline,next);
  assert.equal(r.ok,true);assert.deepEqual(r.added,[{id:"112",name:"New Arrival"}]);
});
test("duplicate names, IDs and retired ID #65 are rejected",()=>{
  const next=clone(baseline);
  next.plants.push(mk("112","SOVEREIGN"),mk("112","Another"),mk("65","Retired ID"));
  const r=inspectCatalogChange(baseline,next);
  assert.equal(r.ok,false);
  assert.match(r.errors.join("\n"),/Duplicate catalog name/);
  assert.match(r.errors.join("\n"),/Duplicate plant ID/);
  assert.match(r.errors.join("\n"),/Retired catalog ID/);
});
test("missing existing plants and speculative new entries are rejected",()=>{
  const removed=clone(baseline);removed.plants.shift();
  assert.match(inspectCatalogChange(baseline,removed).errors.join("\n"),/removed or renumbered/);
  const next=clone(baseline);const p=mk("112","Mysterious Cutting");
  p.species="";p.added="tomorrow";p.cardCare=null;
  next.plants.push(p);
  const r=inspectCatalogChange(baseline,next);
  assert.equal(r.ok,false);
  assert.match(r.errors.join("\n"),/species|identity/);
  assert.match(r.errors.join("\n"),/acquisition date/);
  assert.match(r.errors.join("\n"),/cardCare/);
});
test("an ID from the old range cannot be recycled even if missing from current catalog",()=>{
  const next=clone(baseline);next.plants.push(mk("99","Not A Safe ID"));
  assert.match(inspectCatalogChange(baseline,next).errors.join("\n"),/reuses an old catalog ID range/);
});
