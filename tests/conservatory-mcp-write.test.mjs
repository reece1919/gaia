import test from "node:test";
import assert from "node:assert/strict";
import {saveVerifiedCareEvent} from "../supabase/functions/conservatory-mcp/write-care.mjs";

const id="123e4567-e89b-42d3-a456-426614174000";
const entry={id,plant_id:"50",action_type:"prune",happened_on:"2026-11-20",note:"Trimmed a damaged leaf"};
const plants=[{id:"50",name:"Sovereign"}];
const today="2026-11-20";

function memoryDB({noWrite=false,hideRead=false,existing=[]}={}) {
  const records=[...existing],calls=[];
  return {
    records,calls,
    from(table){
      assert.equal(table,"plant_care_events");
      return {
        async insert(row){
          calls.push({operation:"insert",row});
          if(noWrite)return {error:{code:"42501"}};
          if(records.some(r=>r.id===row.id))return {error:{code:"23505"}};
          records.push({...row,created_at:"2026-11-20T12:00:00Z"});
          return {error:null};
        },
        select(fields){
          assert.match(fields,/\bid\b/);
          const eq={};
          return {
            eq(key,val){
              eq[key]=val;
              return this;
            },
            async maybeSingle(){
              calls.push({operation:"read",eq});
              if(hideRead)return {data:null,error:null};
              const row=records.find(r=>r.id===eq.id && r.user_id===eq.user_id);
              return {data:row ? Object.fromEntries(Object.entries(row).filter(([key])=>key!=="user_id")):null,error:null};
            }
          };
        }
      };
    }
  };
}
function args(db,overrides={}) {
  return {entry,today,userId:"authenticated-owner-id",catalog:plants,db,...overrides};
}

test("record_care_event saves only as authenticated owner and verifies exact UUID",async()=>{
  const db=memoryDB();
  const result=await saveVerifiedCareEvent(args(db));
  assert.equal(result.saved,true);
  assert.equal(result.verified,true);
  assert.equal(result.already_recorded,false);
  assert.equal(result.event.id,id);
  assert.equal(db.records.length,1);
  assert.equal(db.records[0].user_id,"authenticated-owner-id");
  assert.equal(db.calls[1].eq.user_id,"authenticated-owner-id");
});
test("caller-supplied user_id cannot change record ownership",async()=>{
  const db=memoryDB();
  await saveVerifiedCareEvent(args(db,{entry:{...entry,user_id:"attacker",role:"service_role"}}));
  assert.equal(db.records[0].user_id,"authenticated-owner-id");
  assert.equal(Object.hasOwn(db.records[0],"role"),false);
});
test("duplicate same UUID and identical event is idempotent",async()=>{
  const db=memoryDB();
  await saveVerifiedCareEvent(args(db));
  const again=await saveVerifiedCareEvent(args(db));
  assert.equal(again.already_recorded,true);
  assert.equal(db.records.length,1);
});
test("duplicate UUID with different care data is rejected",async()=>{
  const db=memoryDB();
  await saveVerifiedCareEvent(args(db));
  await assert.rejects(()=>saveVerifiedCareEvent(args(db,{
    entry:{...entry,note:"Completely different action"},
  })),/already associated with a different record/);
  assert.equal(db.records.length,1);
});
test("unknown plant, future action, invalid date, and unsupported action never write",async()=>{
  const db=memoryDB();
  for(const invalid of [
    {...entry,plant_id:"99"},
    {...entry,happened_on:"2026-11-21"},
    {...entry,happened_on:"2026-02-30"},
    {...entry,action_type:"reassign_owner"}
  ]){
    await assert.rejects(()=>saveVerifiedCareEvent(args(db,{entry:invalid})));
  }
  assert.equal(db.calls.length,0);
});
test("storage denial is surfaced and does not claim success",async()=>{
  const db=memoryDB({noWrite:true});
  await assert.rejects(()=>saveVerifiedCareEvent(args(db)),/could not be saved/);
  assert.equal(db.records.length,0);
});
test("missing owner or missing read-back never claims saved",async()=>{
  const db=memoryDB({hideRead:true});
  await assert.rejects(()=>saveVerifiedCareEvent(args(db,{userId:""})),/owner identity/);
  await assert.rejects(()=>saveVerifiedCareEvent(args(db)),/could not be verified/);
});
test("older dated notes and optional watering remain supported",async()=>{
  const db=memoryDB();
  const r=await saveVerifiedCareEvent(args(db,{entry:{...entry,action_type:"water",happened_on:"2026-11-16",note:""}}));
  assert.equal(r.event.action_type,"water");
  assert.equal(r.event.happened_on,"2026-11-16");
});
