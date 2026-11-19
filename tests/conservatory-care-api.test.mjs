import test from "node:test";
import assert from "node:assert/strict";
import {validateCareEntry,ACTIONS} from "../supabase/functions/conservatory-care/validation.mjs";
const date="2026-11-19";
const good={id:"11111111-1111-4111-8111-111111111111",plant_id:"50",action_type:"prune",happened_on:date,note:" Removed two leaves "};
test("validates and normalizes a single supported care record",()=>{
  const r=validateCareEntry(good,date);
  assert.equal(r.error,undefined);
  assert.equal(r.value.note,"Removed two leaves");
});
test("caller cannot set another owner's user_id",()=>{
  const r=validateCareEntry({...good,user_id:"somebody-else",admin:true},date);
  assert.equal(Object.hasOwn(r.value,"user_id"),false);
  assert.equal(Object.hasOwn(r.value,"admin"),false);
});
test("prevents date misinterpretation and impossible dates",()=>{
  assert.match(validateCareEntry({...good,happened_on:"2026-11-20"},date).error,/Date/);
  assert.match(validateCareEntry({...good,happened_on:"2026-02-30"},date).error,/Date/);
});
test("requires client-provided stable event UUID for retry idempotency",()=>{
  assert.match(validateCareEntry({...good,id:"random"},date).error,/UUID/);
});
test("rejects unknown event types and non-catalog-format plant IDs",()=>{
  assert.match(validateCareEntry({...good,action_type:"change-owner"},date).error,/action/);
  assert.match(validateCareEntry({...good,plant_id:"__proto__"},date).error,/plant/);
});
test("enforces note length and accepts an empty note",()=>{
  assert.match(validateCareEntry({...good,note:"x".repeat(1001)},date).error,/1,000/);
  assert.equal(validateCareEntry({...good,note:""},date).value.note,"");
});
test("water remains a supported optional action",()=>{
  assert.ok(ACTIONS.includes("water"));
});
