/* GAIA: manual ChatGPT photo review launcher and owner-approved import.
   No photo bytes or credentials are ever included in ChatGPT launch URLs. */
(() => {
 "use strict";
 const base="https://zdurujqwhxqrwbhwzzxg.supabase.co";
 const get=id=>document.getElementById(id);
 const ui={
  launch:get("gaia-manual-launch"),copy:get("gaia-manual-copy"),
  select:get("gaia-manual-select"),count:get("gaia-manual-count"),
  input:get("gaia-manual-json"),preview:get("gaia-manual-preview"),
  output:get("gaia-manual-preview-output"),approved:get("gaia-manual-approved"),
  save:get("gaia-manual-save"),status:get("gaia-manual-status")
 };
 if(Object.values(ui).some(x=>!x))return;
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 let client=null,user=null,photos=[],selected="",validated=null,busy=false,seq=0;
 const plant=id=>(window.GAIA_DATA?.plants||[]).find(p=>String(p.id)===String(id));
 function say(message,error=false){ui.status.textContent=message;ui.status.classList.toggle("gaia-manual-error",error);}
 function latest(){
  const seen=new Set();
  return photos.filter(p=>{
   if(seen.has(p.plant_id))return false;
   seen.add(p.plant_id);
   return p.analysis_status==="pending";
  });
 }
 const chosen=()=>latest().find(p=>p.id===selected);
 const previous=p=>p?photos.find(x=>x.plant_id===p.plant_id&&x.id!==p.id):null;
 function reset(){validated=null;ui.approved.checked=false;ui.save.disabled=true;ui.output.hidden=true;ui.output.replaceChildren();}
 function render(){
  const pending=latest();
  const keep=pending.some(p=>p.id===selected)?selected:pending[0]?.id||"";
  if(keep!==selected)reset();
  selected=keep;
  ui.select.replaceChildren();
  for(const p of pending){
   const opt=document.createElement("option");
   opt.value=p.id;opt.textContent=(plant(p.plant_id)?.name||"Plant "+p.plant_id)+" · "+p.taken_on;
   ui.select.append(opt);
  }
  ui.select.value=selected;
  ui.count.textContent=!user?"Sign in to see your review queue.":
   pending.length?pending.length+" plant"+(pending.length===1?"":"s")+" awaiting review":
   "All newest photos have been reviewed.";
  const ready=!!client&&!!user&&!!selected&&!busy;
  ui.launch.disabled=ui.copy.disabled=ui.select.disabled=ui.preview.disabled=!ready;
  ui.approved.disabled=!validated||busy;
  ui.save.disabled=!validated||!ui.approved.checked||busy;
 }
 async function refresh(){
  if(!client||!user){photos=[];render();return;}
  const token=++seq,owner=user.id;
  try{
   const {data,error}=await client.from("plant_photos")
    .select("id,plant_id,taken_on,created_at,analysis_status")
    .eq("user_id",owner).order("taken_on",{ascending:false})
    .order("created_at",{ascending:false}).limit(1500);
   if(error)throw error;
   if(seq!==token||user?.id!==owner)return;
   photos=data||[];render();
  }catch(e){if(seq===token)say("Could not read photo queue: "+(e.message||"Unknown error"),true);}
 }
 function promptFor(p){
  const info=plant(p.plant_id),prior=previous(p);
  if(!info?.photo)throw Error("Original GAIA photo reference missing.");
  const priorText=prior?
   "Prior PRIVATE photo UUID: "+prior.id+" (photo date "+prior.taken_on+").":
   "Original GitHub image filename: "+info.photo+" (capture date unknown).";
  const extra=prior?
   '"previous_source":"private","previous_photo_id":"'+prior.id+'"':
   '"previous_source":"reference","reference_file":"'+info.photo+'"';
  const example='{"photo_id":"'+p.id+'","review":{"condition":"uncertain","summary":"Specific, visible changes based on both images.","observations":["A visible observation from these photographs."],"recommendations":[{"action":"An inspection-first care check.","reason":"Visual evidence and its limits.","urgency":"monitor"}],"confidence":0.7,'+extra+'}}';
  return [
   "MANUAL GAIA PHOTO REVIEW. I launched this from GAIA's signed-in Photo Journal; this is an interactive ChatGPT conversation, not a scheduled task.",
   "Plant "+info.name+" ("+info.species+") ID "+p.plant_id+". New private photo UUID "+p.id+" taken "+p.taken_on+". "+priorText,
   "Fetch and read the guide reece1919/gaia/GAIA-SCHEDULED-PHOTO-REVIEW.md via connected GitHub. Use Supabase project zdurujqwhxqrwbhwzzxg with the documented authorized photo-read method, and GitHub original where applicable. Actually visually inspect BOTH image files. Do not rely on metadata, descriptions, or old ChatGPT reviews. Do not make private storage public, reveal tokens, upload photographs, or call a paid OpenAI API.",
   "Compare what is genuinely visible; account for changing light and camera position; do not infer invisible soil conditions, pests or root health.",
   "DO NOT attempt to save the result to the database or create a Todoist task. I will explicitly approve and import the result in GAIA myself.",
   "If either image cannot actually be inspected, explain the blocker and DO NOT provide fabricated JSON. Otherwise, give brief care findings and ONE JSON code block matching EXACTLY this format, replacing all example text with real observations:",
   example,
   "Allowed conditions: improving,stable,declining,uncertain. Include 1–5 observations and at most 2 care checks with reason and urgency soon/routine/monitor, and numeric confidence 0..1. I will copy that JSON to GAIA's Review & Import panel."
  ].join("\n\n");
 }
 function launch(){
  const p=chosen();if(!p)return say("Select a pending photo first.",true);
  try{
   window.open("https://chatgpt.com/?q="+encodeURIComponent(promptFor(p)),"_blank","noopener,noreferrer");
   say("ChatGPT opened. Press Send there; then copy its JSON response back to GAIA.");
  }catch(e){say(e.message,true);}
 }
 async function copy(){
  try{
   const p=chosen();if(!p)return;
   await navigator.clipboard.writeText(promptFor(p));
   say("ChatGPT review instructions copied. Paste them in ChatGPT if the link did not open.");
  }catch(e){say("Clipboard unavailable. Use the ChatGPT button.",true);}
 }
 function parse(){
  const p=chosen();
  if(!p)throw Error("Select a pending photo first.");
  let text=ui.input.value.trim();
  const tick=String.fromCharCode(96);
  if(text.startsWith(tick+tick+tick)){
   const first=text.indexOf("\n"),last=text.lastIndexOf(tick+tick+tick);
   if(first<0||last<=first)throw Error("The JSON code block is incomplete.");
   text=text.slice(first+1,last).trim();
  }
  if(!text||text.length>12000)throw Error("Paste the JSON code block from ChatGPT (maximum 12,000 characters).");
  let obj;
  try{obj=JSON.parse(text);}catch(e){throw Error("Paste only valid JSON, not the surrounding explanation.");}
  if(!obj||Array.isArray(obj)||obj.photo_id!==p.id||typeof obj.review!=="object"||!obj.review)
   throw Error("The photo_id must match the selected pending photo.");
  const r=obj.review;
  if(!["improving","stable","declining","uncertain"].includes(r.condition))throw Error("Invalid condition.");
  if(typeof r.summary!=="string"||r.summary.trim().length<20||r.summary.length>1400)
   throw Error("Summary must be 20–1400 characters.");
  if(!Array.isArray(r.observations)||r.observations.length<1||r.observations.length>5||
   r.observations.some(x=>typeof x!=="string"||x.length<5||x.length>320))
   throw Error("Include one to five short visual observations.");
  if(!Array.isArray(r.recommendations)||r.recommendations.length>2||
   r.recommendations.some(x=>!x||typeof x.action!=="string"||x.action.length<5||x.action.length>200||
    typeof x.reason!=="string"||x.reason.length>260||!["soon","routine","monitor"].includes(x.urgency)))
   throw Error("Include at most two appropriate care checks with reasons.");
  if(typeof r.confidence!=="number"||!Number.isFinite(r.confidence)||r.confidence<0||r.confidence>1)
   throw Error("Confidence must be a number from 0 to 1.");
  const prior=previous(p);
  if(prior){
   if(r.previous_source!=="private"||r.previous_photo_id!==prior.id)
    throw Error("Earlier private photo does not match the records.");
  }else if(r.previous_source!=="reference"||r.reference_file!==plant(p.plant_id)?.photo){
   throw Error("The original reference photo does not match the plant.");
  }
  return {photo_id:p.id,review:r};
 }
 function showPreview(item){
  const r=item.review;
  ui.output.replaceChildren();
  const name=document.createElement("strong");
  name.textContent=(plant(chosen()?.plant_id)?.name||"Plant")+" · "+r.condition+" · "+Math.round(r.confidence*100)+"% confidence";
  const desc=document.createElement("p");desc.textContent=r.summary;
  const ul=document.createElement("ul");
  for(const line of r.observations.concat(r.recommendations.map(x=>x.action+" — "+x.reason))){
   const li=document.createElement("li");li.textContent=line;ul.append(li);
  }
  ui.output.append(name,desc,ul);ui.output.hidden=false;
 }
 async function save(){
  if(!validated||!ui.approved.checked||busy||!client||!user)return;
  const item=validated,owner=user.id;
  busy=true;render();say("Submitting the approved review to GAIA…");
  try{
   const current=parse();
   if(JSON.stringify(current)!==JSON.stringify(item))throw Error("The pasted assessment changed; preview it again.");
   const {data,error}=await client.auth.getSession();
   if(error||!data?.session?.access_token||owner!==user?.id)throw Error("Please sign in to GAIA again.");
   const response=await fetch(base+"/functions/v1/gaia-photo-review",{
    method:"POST",cache:"no-store",
    headers:{"Authorization":"Bearer "+data.session.access_token,"apikey":client.supabaseKey,"Content-Type":"application/json"},
    body:JSON.stringify({action:"save_review",...item})
   });
   const output=await response.json().catch(()=>({}));
   if(!response.ok||output.status!=="saved"||output.photo?.id!==item.photo_id){
    let reason=String(output.error||"GAIA could not confirm saving.");
    if(response.status===403)reason+=" Please complete GAIA's MFA verification and try again.";
    throw Error(reason);
   }
   const verification=await client.from("plant_photos").select("analysis_status,analysis_summary")
    .eq("user_id",owner).eq("id",item.photo_id).maybeSingle();
   if(verification.error||!["reviewed","needs_attention"].includes(verification.data?.analysis_status)||
    verification.data?.analysis_summary!==item.review.summary.trim())
    throw Error("Save response received, but could not verify the record. Refresh before retrying.");
   ui.input.value="";reset();
   say("Review saved and verified! Photo Journal and GAIA Insights are updating.");
   document.dispatchEvent(new CustomEvent("gaia:photo-reviews-changed"));
   await refresh();
  }catch(e){say("Review was not confirmed: "+String(e?.message||"Unknown error"),true);}
  finally{busy=false;render();}
 }
 document.addEventListener("gaia:auth",e=>{
  const next=e.detail?.user?.id||null;
  if(next!==user?.id){photos=[];selected="";ui.input.value="";reset();seq++;}
  client=e.detail?.client||null;user=e.detail?.user||null;
  render();if(user)void refresh();
 });
 document.addEventListener("gaia:photo-reviews-changed",()=>{if(user)void refresh();});
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&user)void refresh();});
 document.addEventListener("click",e=>{
  const target=e.target.closest("[data-gaia-review-plant]");
  if(!target)return;
  const p=latest().find(x=>x.plant_id===target.dataset.gaiaReviewPlant);
  if(!p)return say("No latest pending photo for this plant.",true);
  selected=p.id;reset();render();
  const ins=get("gaia-insights");if(ins)ins.open=true;
  get("gaia-manual-review")?.scrollIntoView({behavior:"smooth",block:"center"});
  launch();
 });
 ui.select.addEventListener("change",()=>{selected=ui.select.value;reset();render();});
 ui.input.addEventListener("input",()=>{reset();render();});
 ui.launch.addEventListener("click",launch);
 ui.copy.addEventListener("click",()=>void copy());
 ui.preview.addEventListener("click",()=>{reset();try{validated=parse();showPreview(validated);say("Check the findings before approving and saving.");}catch(e){say(e.message,true);}render();});
 ui.approved.addEventListener("change",render);
 ui.save.addEventListener("click",()=>void save());
 if(window.GAIA_CLOUD){client=window.GAIA_CLOUD.client||null;user=window.GAIA_CLOUD.user||null;}
 render();if(user)void refresh();
})();