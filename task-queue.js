(() => {
 "use strict";
 let client=null,user=null,plants=[];
 const root=()=>document.getElementById("gaia-task-queue-content");
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const date=s=>new Date(s+"T12:00:00");
 const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
 const addDays=(s,n)=>{const d=date(s);d.setDate(d.getDate()+n);return iso(d);};
 const today=()=>iso(new Date());
 const name=id=>plants.find(p=>String(p.id)===String(id))?.name||"Plant "+id;
 async function refresh(){
  if(!root())return;
  if(!client||!user||!plants.length){root().textContent="Sign in to load your private task queue.";return;}
  root().textContent="Checking photo schedules and pending approvals…";
  try{
   const [{data:photos,error:pe},{data:existing,error:ee},{data:custom,error:ce}]=await Promise.all([
    client.from("plant_photos").select("plant_id,taken_on,created_at").order("created_at",{ascending:false}).limit(1500),
    client.from("gaia_task_proposals").select("*").order("created_at",{ascending:false}).limit(500),
    client.from("gaia_custom_tasks").select("id,plant_id,title,due_on,completed_at").eq("user_id",user.id).is("completed_at",null).limit(1000)
   ]);
   if(pe||ee||ce)throw pe||ee||ce;
   const latest=new Map();
   for(const p of photos||[])if(!latest.has(String(p.plant_id)))latest.set(String(p.plant_id),p.taken_on||String(p.created_at).slice(0,10));
   const keys=new Set((existing||[]).map(p=>p.source_key));
   const due=[];
   for(const p of plants){
    const base=latest.get(String(p.id))||(/^\d{4}-\d{2}-\d{2}$/.test(p.added||"")?p.added:null);
    if(!base)continue;
    const next=addDays(base,14);
    if(next>today())continue;
    const key="photo-refresh:"+p.id+":"+base;
    if(keys.has(key))continue;
    due.push({user_id:user.id,plant_id:String(p.id),kind:"photo_refresh",title:"Update photo: "+p.name,rationale:"A fresh photo is due 14 days after the last photo or plant arrival.",due_on:next,status:"suggested",source_key:key});
   }
   // Do not silently create duplicates or claim a photo was reviewed.
   if(due.length){
    const {error}=await client.from("gaia_task_proposals").upsert(due,{onConflict:"user_id,source_key",ignoreDuplicates:true});
    if(error)throw error;
   }
   const {data:rows,error}=await client.from("gaia_task_proposals").select("*").eq("status","suggested").order("created_at",{ascending:false}).limit(100);
   if(error)throw error;
   const byPlant=new Map();
   for(const item of rows||[]){
    const id=String(item.plant_id);
    if(!byPlant.has(id))byPlant.set(id,[]);
    byPlant.get(id).push(item);
   }
   const openByPlant=new Map();
   for(const task of custom||[]){
    const id=String(task.plant_id||"");
    if(!openByPlant.has(id))openByPlant.set(id,[]);
    openByPlant.get(id).push(task);
   }
   document.querySelectorAll("#grid .card[data-plant-id]").forEach(card=>{
    const id=card.dataset.plantId,items=byPlant.get(id)||[],active=openByPlant.get(id)||[];
    const visibleCount=active.length+items.length;
    let preview=card.querySelector(".gaia-card-todos");
    if(visibleCount && !preview){
      preview=document.createElement("div");preview.className="gaia-card-todos";
      preview.style.cssText="margin:10px 0;padding:10px;border:1px solid rgba(180,190,150,.35);border-radius:10px;font-size:.88rem";
      card.querySelector(".summary-body")?.append(preview);
    }
    if(preview){
      preview.hidden=!visibleCount;
      if(visibleCount) preview.innerHTML=
        '<strong>To-dos · '+active.length+'</strong>'+
        active.slice(0,3).map(t=>'<div style="padding-top:6px">'+esc(t.title)+'</div>').join("")+
        (active.length>3?'<small>+'+(active.length-3)+' more in checklist</small>':'')+
        (items.length?'<div><small>'+items.length+' awaiting approval</small></div>':'');
      else preview.replaceChildren();
    }
    let inside=card.querySelector(".gaia-plant-todos");
    if(visibleCount && !inside){
      inside=document.createElement("section");inside.className="gaia-plant-todos";
      inside.style.cssText="padding:12px;margin:10px;border:1px solid rgba(180,190,150,.35);border-radius:10px";
      card.querySelector(".care")?.prepend(inside);
    }
    if(inside){
      inside.hidden=!visibleCount;
      if(visibleCount) inside.innerHTML=(active.length?'<strong>Plant to-dos · '+active.length+'</strong>':'')+
      (active.length?active.map(t=>
        '<label style="display:flex;gap:9px;align-items:start;padding:9px 0;border-bottom:1px solid rgba(180,190,150,.2)">'+
        '<input type="checkbox" data-gaia-complete-custom="'+esc(t.id)+'" aria-label="Complete '+esc(t.title)+'" style="flex:none;width:17px;height:17px;margin-top:2px">'+
        '<span>'+esc(t.title)+(t.due_on?' <small>('+esc(t.due_on)+')</small>':'')+'</span></label>'
      ).join(""):'')+
      (items.length?'<strong style="display:block;margin-top:8px">Awaiting approval</strong>'+
        items.map(item=>
          '<div style="padding:10px 0;border-bottom:1px solid rgba(180,190,150,.2)"><div>'+esc(item.title)+
          '</div><small>'+esc(item.rationale)+'</small><div style="display:flex;gap:8px;margin-top:6px">'+
          '<button type="button" data-gaia-approve="'+esc(item.id)+'">Add to checklist</button>'+
          '<button type="button" data-gaia-decline="'+esc(item.id)+'">Decline</button></div></div>'
        ).join(""):'');
      else inside.replaceChildren();
    }
   });
   root().innerHTML='<p>'+due.length+' new photo reminders queued · '+(rows||[]).length+' awaiting decisions</p>'+
    ((rows||[]).length?'<div style="display:grid;gap:12px">'+rows.map(r=>'<div style="border:1px solid var(--border,#768);border-radius:12px;padding:12px"><strong>'+esc(r.title)+'</strong><p>'+esc(r.rationale)+'</p><small>'+esc(name(r.plant_id))+(r.due_on?' · Due '+esc(r.due_on):'')+'</small><div style="display:flex;gap:12px;margin-top:8px"><button data-gaia-approve="'+esc(r.id)+'">Add to checklist</button><button data-gaia-decline="'+esc(r.id)+'">Decline</button></div></div>').join("")+'</div>':'<p>No suggestions awaiting approval.</p>');
  }catch(e){root().textContent="Task queue unavailable: "+(e?.message||"Please retry.");}
 }
 async function decide(id,approved){
  if(!client||!user)return;
  const owner=user.id;
  try{
   if(approved){
    const {data:proposal,error:readError}=await client.from("gaia_task_proposals")
      .select("id,user_id,plant_id,title,rationale,source_key,status").eq("id",id)
      .eq("user_id",owner).maybeSingle();
    if(readError)throw readError;
    if(!proposal||proposal.status!=="suggested")throw Error("This proposal is no longer pending.");
    const sourceKey=proposal.source_key.startsWith("gaia-photo-review:")?
      proposal.source_key:"gaia-proposal:"+proposal.id;
    const title=proposal.title.slice(0,120);
    const detail=proposal.rationale.slice(0,500);
    const {data:existing,error:taskError}=await client.from("gaia_custom_tasks")
      .select("id,title,source_key").eq("user_id",owner)
      .eq("plant_id",proposal.plant_id).limit(500);
    if(taskError)throw taskError;
    const normalize=s=>String(s||"").trim().toLowerCase().replace(/[^a-z0-9]+/g," ");
    if(!(existing||[]).some(t=>t.source_key===sourceKey||normalize(t.title)===normalize(title))){
      const {error:insertError}=await client.from("gaia_custom_tasks").upsert({
        user_id:owner,plant_id:proposal.plant_id,title,detail,
        due_on:null,source_key:sourceKey
      },{onConflict:"user_id,source_key",ignoreDuplicates:true});
      if(insertError)throw insertError;
    }
   }
   if(user?.id!==owner)throw Error("Account changed; please retry.");
   const {error}=await client.from("gaia_task_proposals")
     .update({status:approved?"approved":"declined",decided_at:new Date().toISOString()})
     .eq("id",id).eq("user_id",owner).eq("status","suggested");
   if(error)throw error;
   document.dispatchEvent(new CustomEvent("gaia:task-approval-changed",{detail:{owner}}));
   await refresh();
  }catch(error){root().textContent="Could not "+(approved?"add the checklist task":"decline the recommendation")+": "+(error?.message||"Try again.");}
 }
 document.addEventListener("click",e=>{const a=e.target.closest("[data-gaia-approve]"),d=e.target.closest("[data-gaia-decline]");if(a)void decide(a.dataset.gaiaApprove,true);else if(d)void decide(d.dataset.gaiaDecline,false);});
 document.addEventListener("change",e=>{
   const checkbox=e.target.closest("input[data-gaia-complete-custom]");
   if(!checkbox||!checkbox.checked||!client||!user)return;
   const owner=user.id,id=checkbox.dataset.gaiaCompleteCustom;
   checkbox.disabled=true;
   void (async()=>{
     const {data,error}=await client.from("gaia_custom_tasks")
       .update({completed_at:new Date().toISOString()})
       .eq("id",id).eq("user_id",owner).is("completed_at",null).select("id");
     if(error||!data?.length){
       checkbox.checked=false;checkbox.disabled=false;
       if(root())root().textContent="Could not complete GAIA to-do: "+(error?.message||"Refresh and try again.");
       return;
     }
     document.dispatchEvent(new CustomEvent("gaia:task-approval-changed",{detail:{owner}}));
     await refresh();
   })();
 });
 document.addEventListener("gaia:ready",e=>{plants=e.detail.plants||[];void refresh();});
 document.addEventListener("gaia:auth",e=>{client=e.detail.client;user=e.detail.user;void refresh();});
 document.addEventListener("gaia:care-synced",()=>void refresh());
 document.addEventListener("gaia:photo-reviews-changed",()=>void refresh());
 document.addEventListener("gaia:task-approval-changed",()=>void refresh());
 document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"&&user)void refresh();
 });
 if(window.GAIA_DATA?.plants)plants=window.GAIA_DATA.plants;
 if(window.GAIA_CLOUD){client=window.GAIA_CLOUD.client;user=window.GAIA_CLOUD.user;}
 void refresh();
})();