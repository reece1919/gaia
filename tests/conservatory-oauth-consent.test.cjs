const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const script=fs.readFileSync(path.join(__dirname,"../oauth/consent/consent.js"),"utf8");
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function harness({user=true,aal="aal2",id="test-authorization-id",alreadyGranted=false}={}) {
  const nodes=new Map();
  const callbacks={};
  const element=(name)=>{
    if(!nodes.has(name))nodes.set(name,{
      name,hidden:false,disabled:false,textContent:"",
      addEventListener(event,cb){callbacks[name+":"+event]=cb;}
    });
    return nodes.get(name);
  };
  let approved=0,denied=0,redirect="",detailReads=0;
  const auth={
    async getUser(){return user?{data:{user:{id:"user-1"}},error:null}:{data:{user:null},error:{message:"no session"}};},
    mfa:{async getAuthenticatorAssuranceLevel(){return {data:{currentLevel:aal,nextLevel:"aal2"},error:null};}},
    oauth:{
      async getAuthorizationDetails(){detailReads++;return {data:alreadyGranted?{redirect_url:"https://chatgpt.com/oauth/callback"}:{
        authorization_id:id,client:{name:"The Conservatory plugin"},scope:"openid profile",redirect_uri:"https://chatgpt.com/oauth/callback"
      },error:null};},
      async approveAuthorization(){approved++;return {data:{redirect_url:"https://chatgpt.com/oauth/callback"},error:null};},
      async denyAuthorization(){denied++;return {data:{redirect_url:"https://chatgpt.com/oauth/callback?error=access_denied"},error:null};}
    }
  };
  const window={
    location:{search:id?"?authorization_id="+id:"",assign(url){redirect=url;}},
    GAIA_SUPABASE:{url:"https://example.supabase.co",anonKey:"public"},
    supabase:{createClient(){return {auth};}}
  };
  const document={getElementById:element};
  vm.runInNewContext(script,{window,document,URLSearchParams,URL,console},{filename:"consent.js"});
  return {element,callbacks,get:()=>({approved,denied,redirect,detailReads})};
}
test("consent is inaccessible without an authenticated owner",async()=>{
  const h=harness({user:false});await tick();
  assert.equal(h.element("login-needed").hidden,false);
  assert.equal(h.element("decision").hidden,true);
  assert.equal(h.get().detailReads,0);
});
test("an aal1 session cannot see approval controls",async()=>{
  const h=harness({aal:"aal1"});await tick();
  assert.equal(h.element("login-needed").hidden,false);
  assert.equal(h.get().detailReads,0);
});
test("even with aal2, approval only occurs on an explicit click",async()=>{
  const h=harness();await tick();
  assert.equal(h.element("decision").hidden,false);
  assert.equal(h.element("client-name").textContent,"The Conservatory plugin");
  assert.equal(h.get().approved,0);
  h.callbacks["approve:click"]();await tick();
  assert.equal(h.get().approved,1);
  assert.equal(h.get().redirect,"https://chatgpt.com/oauth/callback");
});
test("deny calls deny API, not approve",async()=>{
  const h=harness();await tick();
  h.callbacks["deny:click"]();await tick();
  assert.equal(h.get().approved,0);
  assert.equal(h.get().denied,1);
});
test("already approved clients still require aal2 before redirect",async()=>{
  const a=harness({aal:"aal1",alreadyGranted:true});await tick();
  assert.equal(a.get().redirect,"");
  const b=harness({aal:"aal2",alreadyGranted:true});await tick();
  assert.equal(b.get().redirect,"https://chatgpt.com/oauth/callback");
});
test("missing authorization IDs never display approval",async()=>{
  const h=harness({id:""});await tick();
  assert.equal(h.element("decision").hidden,true);
  assert.match(h.element("status").textContent,/Missing or invalid/);
});
