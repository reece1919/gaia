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
   const [{data:photos,error:pe},{data:existing,error:ee}]=await Promise.all([
    client.from("plant_photos").select("plant_id,taken_on,created_at").order("created_at",{ascending:false}).limit(1500),
    client.from("gaia_task_proposals").select("*").order("created_at",{ascending:false}).limit(500)
   ]);
   if(pe||ee)throw pe||ee;
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
   root().innerHTML='<p>'+due.length+' new photo reminders queued · '+(rows||[]).length+' awaiting decisions</p>'+
    ((rows||[]).length?'<div style="display:grid;gap:12px">'+rows.map(r=>'<div style="border:1px solid var(--border,#768);border-radius:12px;padding:12px"><strong>'+esc(r.title)+'</strong><p>'+esc(r.rationale)+'</p><small>'+esc(name(r.plant_id))+(r.due_on?' · Due '+esc(r.due_on):'')+'</small><div style="display:flex;gap:12px;margin-top:8px"><button data-gaia-approve="'+esc(r.id)+'">Approve for task creation</button><button data-gaia-decline="'+esc(r.id)+'">Decline</button></div></div>').join("")+'</div>':'<p>No suggestions awaiting approval.</p>');
  }catch(e){root().textContent="Task queue unavailable: "+(e?.message||"Please retry.");}
 }
 async function decide(id,approved){
  if(!client||!user)return;
  const {error}=await client.from("gaia_task_proposals").update({status:approved?"approved":"declined",decided_at:new Date().toISOString()}).eq("id",id).eq("status","suggested");
  if(error){root().textContent="Could not save decision: "+error.message;return;}
  await refresh();
 }
 document.addEventListener("click",e=>{const a=e.target.closest("[data-gaia-approve]"),d=e.target.closest("[data-gaia-decline]");if(a)void decide(a.dataset.gaiaApprove,true);else if(d)void decide(d.dataset.gaiaDecline,false);});
 document.addEventListener("gaia:ready",e=>{plants=e.detail.plants||[];void refresh();});
 document.addEventListener("gaia:auth",e=>{client=e.detail.client;user=e.detail.user;void refresh();});
 document.addEventListener("gaia:care-synced",()=>void refresh());
 if(window.GAIA_DATA?.plants)plants=window.GAIA_DATA.plants;
 if(window.GAIA_CLOUD){client=window.GAIA_CLOUD.client;user=window.GAIA_CLOUD.user;}
 void refresh();
})();