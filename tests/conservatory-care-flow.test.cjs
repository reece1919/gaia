/* Offline integration tests: actual dictation UI handlers + care.js save/sync. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../care.js"), "utf8");
const parser = require("../conservatory-dictation.js");
const plants = [{id:"50",name:"Sovereign",commonNames:[]},{id:"70",name:"Garrus",commonNames:[]}];

function build({signedIn=false, failStorage=false, invisibleCloud=false}={}) {
  const local = new Map();
  const cloud = [];
  const nodes = new Map();
  function element(id) {
    if (!nodes.has(id)) {
      const handlers = {};
      nodes.set(id, {
        id,hidden:false,disabled:false,textContent:"",value:"",
        classList:{toggle(){}},handlers,
        addEventListener(name,fn){handlers[name]=fn;},
        fire(name,event={}) {return handlers[name]?.(event);},
      });
    }
    return nodes.get(id);
  }
  const root=element("care-overview");
  const form=element("conservatory-dictation-form");
  form.elements={dictation:{value:""}};
  form.reset=()=>{form.elements.dictation.value="";};
  const db={
    auth:{
      async getSession(){return {data:{session:{user:{id:"owner-1",email:"test@example.com"}}},error:null};},
      onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};}
    },
    from(table){
      assert.equal(table,"plant_care_events");
      return {
        async upsert(records){cloud.push(...records);return {error:null};},
        select(){return {order(){return {async limit(){return {data:invisibleCloud?[]:cloud,error:null};}};}};}
      };
    }
  };
  const window={
    GAIA_DATA:{plants},
    GAIA_SUPABASE: signedIn ? {url:"https://example.invalid",anonKey:"test-publishable"} : {},
    CONSERVATORY_DICTATION:parser,
    supabase:{createClient(){return db;}}
  };
  const document={
    getElementById:element,
    querySelectorAll(){return [];},
    addEventListener(){},
    dispatchEvent(){}
  };
  const localStorage={
    getItem(key){return local.get(key)||null;},
    setItem(key,value){if(failStorage)throw new Error("Quota");local.set(key,value);}
  };
  vm.runInNewContext(source, {window,document,localStorage,Date,Intl,console,
    Event:class Event{},CustomEvent:class CustomEvent{}}, {filename:"care.js"});
  async function submit(note) {
    form.elements.dictation.value=note;
    form.fire("submit",{preventDefault(){}});
    return element("conservatory-dictation-save").fire("click");
  }
  return {window,local,cloud,element,form,submit};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test("offline review and save persist one real care event with correct plant",async()=>{
  const h=build();
  await tick();
  h.form.elements.dictation.value="I pruned Sovereign today and removed two leaves";
  h.form.fire("submit",{preventDefault(){}});
  assert.match(h.element("conservatory-dictation-summary").textContent,/Sovereign/);
  assert.equal(h.element("conservatory-dictation-review").hidden,false);
  await h.element("conservatory-dictation-save").fire("click");
  const rows=JSON.parse(h.local.get("gaia-care-journal-v1-device"));
  assert.equal(rows.length,1);
  assert.equal(rows[0].plant_id,"50");
  assert.equal(rows[0].action_type,"prune");
  assert.match(rows[0].note,/two leaves/);
  assert.equal(h.element("conservatory-dictation-review").hidden,true);
  assert.match(h.element("conservatory-dictation-status").textContent,/saved locally/i);
});
test("cancel does not create a care record",async()=>{
  const h=build();
  await tick();
  h.form.elements.dictation.value="Fertilized Garrus today";
  h.form.fire("submit",{preventDefault(){}});
  h.element("conservatory-dictation-cancel").fire("click");
  await h.element("conservatory-dictation-save").fire("click");
  assert.equal(h.window.GAIA_CARE.events().length,0);
});
test("cloud success requires read-back of exact new event ID",async()=>{
  const h=build({signedIn:true});
  await tick();
  await h.submit("I repotted Sovereign today");
  assert.equal(h.cloud.length,1);
  assert.equal(h.cloud[0].plant_id,"50");
  assert.match(h.element("conservatory-dictation-status").textContent,/verified in cloud journal/);
  const records=JSON.parse(h.local.get("gaia-care-journal-v1-user-owner-1"));
  assert.equal(records[0].synced,true);
});
test("missing cloud read-back never claims verification",async()=>{
  const h=build({signedIn:true,invisibleCloud:true});
  await tick();
  await h.submit("I fertilized Garrus today");
  assert.equal(h.cloud.length,1);
  assert.match(h.element("conservatory-dictation-status").textContent,/cloud sync may still be pending/i);
  assert.equal(JSON.parse(h.local.get("gaia-care-journal-v1-user-owner-1"))[0].synced,false);
});
test("storage rejection must not leave a falsely saved journal event",async()=>{
  const h=build({failStorage:true});
  await tick();
  await h.submit("I pruned Sovereign today");
  assert.equal(h.window.GAIA_CARE.events().length,0);
  assert.match(h.element("conservatory-dictation-status").textContent,/Could not save/);
});
test("changing the text clears stale approval",async()=>{
  const h=build();
  await tick();
  h.form.elements.dictation.value="I pruned Sovereign today";
  h.form.fire("submit",{preventDefault(){}});
  h.form.fire("input",{});
  assert.equal(h.element("conservatory-dictation-review").hidden,true);
  await h.element("conservatory-dictation-save").fire("click");
  assert.equal(h.window.GAIA_CARE.events().length,0);
});
