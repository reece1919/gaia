import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  getPropagationNursery,createPropagationBatch,createPropagationCutting,
  updatePropagationCutting
} from "../supabase/functions/conservatory-mcp/propagation-tools.mjs";

const owner="owner-one",other="owner-two",today="2026-11-20";
const batchId="10101010-1010-4010-8010-101010101010";
const cutId="20202020-2020-4020-8020-202020202020";
const catalog=[{id:"50",name:"Sovereign"}];
function memoryDb({deny=false}={}){
  const data={gaia_propagation_batches:[],gaia_propagation_cuttings:[]},calls=[];
  return {data,calls,from(table){
    assert.ok(data[table],table);
    let filters=[],inFilters=[],limit=Infinity,sort=null,patch=null,selectFields=null;
    const matches=r=>filters.every(([k,v])=>r[k]===v)&&inFilters.every(([k,v])=>v.includes(r[k]));
    const query={
      select(v){selectFields=v;return this;},
      eq(k,v){filters.push([k,v]);return this;},
      in(k,v){inFilters.push([k,v]);return this;},
      order(k,opts){sort=[k,opts];return this;},
      limit(v){limit=v;return this;},
      update(value){patch=value;return this;},
      async insert(value){
        calls.push(["insert",table,value]);
        if(deny)return {error:{code:"42501"}};
        if(data[table].some(row=>row.id===value.id))return {error:{code:"23505"}};
        data[table].push({...value,created_at:"2026-11-20T08:00:00Z",updated_at:"2026-11-20T08:00:00Z",
          ...(table==="gaia_propagation_cuttings"?{rooted_on:null,potted_on:null,established_on:null,linked_plant_id:null}:{})});
        return {error:null};
      },
      async maybeSingle(){
        calls.push([patch?"update":"read",table,filters]);
        if(deny)return {data:null,error:{code:"42501"}};
        const items=data[table].filter(matches);
        if(patch){
          if(items.length!==1)return {data:null,error:null};
          Object.assign(items[0],patch);
        }
        return {data:items[0]||null,error:null};
      },
      then(resolve,reject){
        if(deny)return Promise.resolve({data:null,error:{code:"42501"}}).then(resolve,reject);
        let rows=data[table].filter(matches);
        if(sort)rows=rows.sort((a,b)=>sort[1]?.ascending===false?String(b[sort[0]]).localeCompare(String(a[sort[0]])):String(a[sort[0]]).localeCompare(String(b[sort[0]])));
        rows=rows.slice(0,limit);
        return Promise.resolve({data:rows,error:null}).then(resolve,reject);
      }
    };
    return query;
  }};
}
const batch={id:batchId,label:"Sovereign cuttings",parent_plant_id:"50",method:"perlite",started_on:today,notes:"Two stem cuttings"};
const cutting={id:cutId,batch_id:batchId,nickname:"Cutting 01",stage:"cutting",destination:"keep",notes:"Rooting not confirmed"};

test("new batch uses the verified owner and reads the exact saved row back",async()=>{
  const db=memoryDb();
  const a=await createPropagationBatch({db,userId:owner,catalog,today,entry:batch});
  assert.equal(a.saved,true);assert.equal(a.verified,true);assert.equal(a.already_recorded,false);
  assert.equal(db.data.gaia_propagation_batches[0].user_id,owner);
  assert.equal(db.calls.at(-1)[0],"read");
  const duplicate=await createPropagationBatch({db,userId:owner,catalog,today,entry:batch});
  assert.equal(duplicate.already_recorded,true);
  assert.equal(db.data.gaia_propagation_batches.length,1);
});

test("validation stops invalid labels, unknown parents, future starts and changed duplicate UUIDs",async()=>{
  const db=memoryDb();
  for(const entry of [
    {...batch,label:"   "},
    {...batch,parent_plant_id:"99"},
    {...batch,started_on:"2026-11-21"},
    {...batch,started_on:"2026-02-30"},
    {...batch,method:"magic"},
  ]) await assert.rejects(()=>createPropagationBatch({db,userId:owner,catalog,today,entry}));
  assert.equal(db.calls.length,0);
  await createPropagationBatch({db,userId:owner,catalog,today,entry:batch});
  await assert.rejects(()=>createPropagationBatch({db,userId:owner,catalog,today,entry:{...batch,label:"Different batch"}}),/verification failed/i);
  assert.equal(db.data.gaia_propagation_batches.length,1);
});

test("cuttings use an existing owned batch and do not become catalog plants",async()=>{
  const db=memoryDb();
  await assert.rejects(()=>createPropagationCutting({db,userId:owner,entry:cutting}),/batch is not visible/);
  await createPropagationBatch({db,userId:owner,catalog,today,entry:batch});
  const created=await createPropagationCutting({db,userId:owner,entry:{...cutting,user_id:other}});
  assert.equal(created.record.batch_id,batchId);
  assert.equal(created.record.stage,"cutting");
  assert.equal(db.data.gaia_propagation_cuttings[0].user_id,owner);
  assert.equal((await createPropagationCutting({db,userId:owner,entry:cutting})).already_recorded,true);
  assert.equal(db.data.gaia_propagation_cuttings.length,1);
  assert.equal((await getPropagationNursery({db,userId:owner})).cuttings.length,1);
  assert.deepEqual((await getPropagationNursery({db,userId:other})).batches,[]);
});

test("milestone updates require a fresh version and verify the changed cutting",async()=>{
  const db=memoryDb();
  await createPropagationBatch({db,userId:owner,catalog,today,entry:batch});
  await createPropagationCutting({db,userId:owner,entry:cutting});
  const before=db.data.gaia_propagation_cuttings[0].updated_at;
  const change={id:cutId,expected_updated_at:before,stage:"rooting",rooted_on:today};
  const result=await updatePropagationCutting({db,userId:owner,catalog,today,entry:change});
  assert.equal(result.verified,true);assert.equal(result.record.stage,"rooting");
  assert.equal(result.record.rooted_on,today);
  const retry=await updatePropagationCutting({db,userId:owner,catalog,today,entry:change});
  assert.equal(retry.already_recorded,true);
  await assert.rejects(()=>updatePropagationCutting({db,userId:owner,catalog,today,entry:{...change,stage:"established"}}),/changed elsewhere/);
  await assert.rejects(()=>updatePropagationCutting({db,userId:other,catalog,today,entry:change}),/not found/);
});

test("storage permission errors never report success and AAL2 gate is present in the MCP router",async()=>{
  const db=memoryDb({deny:true});
  await assert.rejects(()=>createPropagationBatch({db,userId:owner,catalog,today,entry:batch}),/write failed/i);
  const source=fs.readFileSync(new URL("../supabase/functions/conservatory-mcp/index.ts",import.meta.url),"utf8");
  assert.match(source,/assuranceLevel!=="aal2"/);
  assert.match(source,/withSupabase\(\{ auth: "user" \}\)/);
  assert.match(source,/registerTool\("record_care_event"/);
  for(const op of ["get_propagation_nursery","start_propagation_batch","add_propagation_cutting","update_propagation_cutting"])
    assert.ok(source.includes('registerTool("'+op+'"'),op);
});
