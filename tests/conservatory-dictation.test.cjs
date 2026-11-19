const test = require("node:test");
const assert = require("node:assert/strict");
const {parse} = require("../conservatory-dictation.js");
const plants = [
  {id:"01",name:"Sovereign",commonNames:["Monstera deliciosa"]},
  {id:"02",name:"Garrus",commonNames:["Golden pothos"]},
  {id:"03",name:"Bella",commonNames:["Tradescantia"]},
  {id:"04",name:"Bella",commonNames:[]}
];
test("pruning note identifies plant and action", () => {
  const r = parse("I pruned Sovereign today and removed two leaves.",plants,"2026-11-19");
  assert.equal(r.plantId,"01"); assert.equal(r.action,"prune"); assert.equal(r.date,"2026-11-19");
});
test("fertilizing yesterday uses previous calendar date", () => {
  const r = parse("Fed Garrus yesterday",plants,"2026-11-01");
  assert.equal(r.action,"fertilize"); assert.equal(r.date,"2026-10-31");
});
test("does not guess an unidentified plant", () => {
  assert.match(parse("I pruned the plant",plants,"2026-11-19").error,/Plant name/);
});
test("rejects duplicate plant names", () => {
  assert.match(parse("Repotted Bella today",plants,"2026-11-19").error,/More than one/);
});
test("rejects multiple actions in one event", () => {
  assert.match(parse("Pruned and fertilized Sovereign",plants,"2026-11-19").error,/Multiple/);
});
test("rejects ambiguous dates", () => {
  assert.match(parse("Pruned Sovereign last week",plants,"2026-11-19").error,/Date is ambiguous/);
});
test("watering remains optional and supported", () => {
  assert.equal(parse("Watered Garrus today",plants,"2026-11-19").action,"water");
});
test("unrecognized activity is a dated observation", () => {
  assert.equal(parse("Sovereign has a new leaf",plants,"2026-11-19").action,"note");
});
