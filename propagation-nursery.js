/* GAIA Propagation Nursery: private account-synced batches, individual cuttings and progress photos.
   Source of truth for permanent GAIA plants remains plants.json. No client GitHub token. */
(() => {
  "use strict";
  const host = document.getElementById("gaia-propagation-nursery");
  if (!host) return;
  const BUCKET = "gaia-propagation-photos";
  const STAGES = ["cutting","rooting","establishing","established","lost"];
  const DESTINATIONS = ["undecided","keep","gift","trade","return"];
  const METHODS = ["soil","water","sphagnum","perlite","division","other"];
  let client = null, user = null, verified = false, busy = false, loading = false;
  let batches = [], cuttings = [], photos = [], photoUrls = new Map(), selected = "";
  let notice = "", isError = false, generation = 0;
  let plants = window.GAIA_DATA?.plants || [];
  const esc = x => String(x ?? "").replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const localDay = () => {const d=new Date(), pad=x=>String(x).padStart(2,"0");return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());};
  const label = id => plants.find(p => String(p.id)===String(id))?.name || "";
  const opt = (items,value) => items.map(x => '<option value="'+esc(x)+'"'+(x===value?' selected':'')+'>'+esc(x.charAt(0).toUpperCase()+x.slice(1))+'</option>').join("");
  const field = (title,name,value,type="text",attrs="") =>
    '<label>'+esc(title)+'<input type="'+type+'" name="'+esc(name)+'" value="'+esc(value??"")+'" '+attrs+'></label>';
  const plantOptions = (value,none="No parent / unknown") =>
    '<option value="">'+esc(none)+'</option>'+plants.map(p=>'<option value="'+esc(p.id)+'"'+(String(value)===String(p.id)?' selected':'')+'>'+esc(p.name)+' · #'+esc(p.id)+'</option>').join("");
  const stageDescription = s => ({
    cutting:"Cutting recorded; rooting has not been confirmed",
    rooting:"Root development is being monitored",
    establishing:"Potted or transitioning; roots are still establishing",
    established:"Growing independently; may be ready for the collection",
    lost:"Propagation did not survive"
  })[s] || "No status";
  function status(text,error=false){notice=String(text||"");isError=error;const p=host.querySelector("#gaia-nursery-status");if(p){p.textContent=notice;p.classList.toggle("error",isError);}}
  function parentLink(id){return id && label(id)?'<button type="button" data-action="open-plant" data-id="'+esc(id)+'" class="gaia-nursery-link">'+esc(label(id))+' ↗</button>':'<span>Unlinked origin</span>';}
  function render() {
    const signed=!!user;
    const active=signed && verified;
    const count=cuttings.filter(c=>c.stage!=="lost").length;
    const totalPhoto=photos.length;
    const roots=cuttings.filter(c=>c.stage==="rooting"||c.stage==="establishing").length;
    const reached=cuttings.filter(c=>c.stage==="established").length;
    const intro = !signed
      ? 'Sign in under Care → Tools & reviews → Settings & Backup to access your private nursery.'
      : !verified ? 'Authenticator verification (AAL2) is required before reading or editing Nursery records.'
      : 'Synced privately to your GAIA account. A cutting only joins the permanent collection after it has its own GAIA catalog record.';
    const batchForm=active?'<details class="gaia-nursery-new"><summary>+ Start a propagation batch</summary>'+
      '<form id="gaia-nursery-new-form" class="gaia-nursery-form">'+
      field("Batch name","label","","text",'required maxlength="100" placeholder="e.g. Jango cuttings"')+
      '<label>Parent plant <select name="parent_plant_id">'+plantOptions("")+'</select></label>'+
      '<label>Method <select name="method">'+opt(METHODS,"soil")+'</select></label>'+
      field("Date started (optional)","started_on","","date")+
      '<label>Notes <textarea name="notes" rows="2" maxlength="1500" placeholder="What was cut, where it came from, or the medium used"></textarea></label>'+
      '<button type="submit">Create batch</button></form></details>':"";
    const records=active ? (batches.length?batches.map(b=>{
      const items=cuttings.filter(c=>c.batch_id===b.id);
      return '<article class="gaia-nursery-batch"><header><div><h3>'+esc(b.label)+'</h3>'+
        '<p>'+parentLink(b.parent_plant_id)+' · '+esc(b.method)+' · '+(b.started_on?esc(b.started_on):'Start date not recorded')+'</p>'+
        '</div><span class="gaia-nursery-count">'+(items.length?items.length+' individually logged':'Count pending')+'</span></header>'+
        (b.notes?'<p class="gaia-nursery-batchnote">'+esc(b.notes)+'</p>':'')+
        '<div class="gaia-nursery-chips">'+STAGES.map(s=>'<span>'+esc(s)+': '+items.filter(c=>c.stage===s).length+'</span>').join('')+'</div>'+
        (items.length?'':'<p class="gaia-nursery-empty gaia-nursery-unlogged">A propagation is recorded here, but its individual cuttings have not yet been counted. Add them when you can identify each one.</p>')+
        '<div class="gaia-nursery-cutting-list">'+items.map((c,i)=>
          '<button type="button" class="gaia-nursery-cutting'+(selected===c.id?' selected':'')+'" data-action="select-cutting" data-id="'+esc(c.id)+'" aria-pressed="'+(selected===c.id)+'">'+
          '<strong>'+esc(c.nickname||'Cutting '+String(i+1).padStart(2,"0"))+'</strong><small>'+esc(c.stage)+' · '+esc(c.destination)+'</small></button>').join('')+'</div>'+
        '<div class="gaia-nursery-batch-actions"><button type="button" data-action="add-cutting" data-id="'+esc(b.id)+'">+ Add a cutting</button></div>'+
        (items.some(c=>c.id===selected)?renderCutting(items.find(c=>c.id===selected),b):'')+
        '</article>';
    }).join("") : '<p class="gaia-nursery-empty">Your Nursery is empty. Start a batch to track new cuttings without creating permanent plant cards.</p>') : "";
    host.innerHTML=
      '<div class="gaia-hub-section-head"><span class="gaia-eyebrow">THE GROWING GROUNDS</span><h2>Propagation Nursery</h2>'+
      '<p>Follow each cutting from day one, record real milestones, and keep its family tree intact.</p></div>'+
      '<div class="gaia-nursery-metrics"><div><strong>'+batches.length+'</strong><span>Batches</span></div>'+
      '<div><strong>'+count+'</strong><span>Individually logged</span></div>'+
      '<div><strong>'+roots+'</strong><span>Rooting / settling</span></div>'+
      '<div><strong>'+reached+'</strong><span>Established</span></div></div>'+
      '<p class="gaia-nursery-intro">'+intro+'</p>'+
      '<p id="gaia-nursery-status" class="gaia-nursery-status'+(isError?' error':'')+'" role="status" aria-live="polite">'+esc(notice)+'</p>'+
      batchForm+(loading?'<p class="gaia-nursery-empty">Loading private Nursery records…</p>':records)+
      (active?'<p class="gaia-nursery-footnote">Photos remain private. Establishment, rooting and watering are never automatically inferred from dates or photos. '+totalPhoto+' photo'+(totalPhoto===1?'':'s')+' saved.</p>':'');
  }
  function renderCutting(c,b){
    const imageList=photos.filter(p=>p.cutting_id===c.id).sort((a,z)=>z.taken_on.localeCompare(a.taken_on)||z.created_at.localeCompare(a.created_at));
    const linked=label(c.linked_plant_id);
    return '<div class="gaia-nursery-detail"><h4>'+esc(c.nickname||"Individual cutting")+'</h4>'+
      '<p>'+esc(stageDescription(c.stage))+'</p>'+
      '<form class="gaia-nursery-form" data-kind="cutting-save" data-id="'+esc(c.id)+'">'+
      field("Cutting name / label","nickname",c.nickname,"text",'maxlength="100" placeholder="e.g. Boba, or Cutting 01"')+
      '<label>Stage <select name="stage">'+opt(STAGES,c.stage)+'</select></label>'+
      '<label>Destination <select name="destination">'+opt(DESTINATIONS,c.destination)+'</select></label>'+
      field("First roots seen","rooted_on",c.rooted_on,"date")+
      field("Potted","potted_on",c.potted_on,"date")+
      field("Independently established","established_on",c.established_on,"date")+
      '<label>Linked GAIA plant (optional) <select name="linked_plant_id">'+plantOptions(c.linked_plant_id,"Not yet in the main collection")+'</select></label>'+
      '<label class="gaia-nursery-wide">Notes <textarea name="notes" rows="3" maxlength="1500">'+esc(c.notes)+'</textarea></label>'+
      '<div class="gaia-nursery-actions"><button type="submit">Save cutting</button>'+
      '<button type="button" data-action="graduation-brief" data-id="'+esc(c.id)+'" class="gaia-nursery-secondary">Copy catalog brief</button></div></form>'+
      (linked?'<p class="gaia-nursery-linked">Linked to existing collection plant: '+parentLink(c.linked_plant_id)+'</p>':
      '<p class="gaia-nursery-help">When ready for the collection, copy the catalog brief and ask GAIA to create a new main plant card. A Nursery status does not create a GitHub catalog record automatically.</p>')+
      '<div class="gaia-nursery-gallery-heading"><h5>Progress photos</h5><span>'+imageList.length+' saved</span></div>'+
      '<div class="gaia-nursery-photos">'+(imageList.length?imageList.map(p=>{
        const url=photoUrls.get(p.object_path);
        return '<figure>'+ (url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer"><img loading="lazy" src="'+esc(url)+'" alt="'+esc(p.caption||'Propagation photo')+'"></a>':'<div class="gaia-nursery-photo-absent">Preview unavailable</div>')+
          '<figcaption>'+esc(p.taken_on)+(p.caption?' · '+esc(p.caption):'')+'</figcaption>'+
          '<button type="button" data-action="delete-photo" data-id="'+esc(p.id)+'">Delete</button></figure>';
      }).join(''):'<p class="gaia-nursery-empty">No private progress photos yet.</p>')+'</div>'+
      '<form data-kind="photo-upload" data-id="'+esc(c.id)+'" class="gaia-nursery-photo-form">'+
      '<label>Choose photo <input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/*" required></label>'+
      field("Photo date","taken_on",localDay(),"date",'required')+
      field("Caption (optional)","caption","","text",'maxlength="350"')+
      '<button type="submit">Upload private photo</button></form></div>';
  }
  async function load(){
    if(!client||!user||!verified)return;
    const current=++generation;loading=true;render();
    try {
      const [a,b,c]=await Promise.all([
        client.from("gaia_propagation_batches").select("*").order("created_at",{ascending:true}).limit(300),
        client.from("gaia_propagation_cuttings").select("*").order("created_at",{ascending:true}).limit(1500),
        client.from("gaia_propagation_photos").select("*").order("created_at",{ascending:false}).limit(1500)
      ]);
      if(a.error||b.error||c.error)throw a.error||b.error||c.error;
      if(current!==generation)return;
      const urls=new Map();
      const paths=(c.data||[]).map(p=>p.object_path);
      for(let i=0;i<paths.length;i+=50){
        const subset=paths.slice(i,i+50);
        const result=await client.storage.from(BUCKET).createSignedUrls(subset,1800);
        if(result.error)throw result.error;
        (result.data||[]).forEach((x,k)=>{if(x?.signedUrl)urls.set(subset[k],x.signedUrl);});
      }
      if(current!==generation)return;
      batches=a.data||[];cuttings=b.data||[];photos=c.data||[];photoUrls=urls;
      if(!cuttings.some(c=>c.id===selected))selected="";
      status("");loading=false;render();
    }catch(e){if(current!==generation)return;loading=false;render();status("Could not load Nursery: "+(e?.message||"Please check your connection."),true);}
  }
  async function updateAuth(nextClient,nextUser){
    const incoming=nextUser?.id||null;
    client=nextClient||null;user=nextUser||null;verified=false;
    ++generation;batches=[];cuttings=[];photos=[];photoUrls.clear();selected="";notice="";
    if(!client||!user){loading=false;render();return;}
    try{
      const result=await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if(result.error)throw result.error;
      if(user?.id!==incoming)return;
      verified=result.data?.currentLevel==="aal2";
      if(verified)await load();
      else {loading=false;render();}
    }catch(e){loading=false;render();status("Authenticator verification status unavailable: "+(e?.message||"Unknown error"),true);}
  }
  async function run(fn){
    if(busy||!client||!user||!verified)return;
    busy=true;status("Saving…");
    try{await fn();await load();status("Saved to your private Nursery.");}
    catch(e){status("Change not saved: "+(e?.message||"Please try again."),true);}
    finally{busy=false;}
  }
  async function addBatch(form){
    const data=new FormData(form);
    const label=String(data.get("label")||"").trim();
    if(!label)throw Error("Give the batch a name.");
    const row={user_id:user.id,label,method:String(data.get("method")||"soil"),
      parent_plant_id:String(data.get("parent_plant_id")||"")||null,
      started_on:String(data.get("started_on")||"")||null,notes:String(data.get("notes")||"").trim()};
    const r=await client.from("gaia_propagation_batches").insert(row).select("id").single();
    if(r.error)throw r.error;
  }
  async function addCutting(batchId){
    const batch=batches.find(x=>x.id===batchId);if(!batch)throw Error("Batch not found.");
    const n=cuttings.filter(x=>x.batch_id===batchId).length+1;
    const r=await client.from("gaia_propagation_cuttings").insert({
      batch_id:batchId,user_id:user.id,nickname:"Cutting "+String(n).padStart(2,"0"),
      stage:"cutting",destination:"undecided",notes:"Rooting not yet confirmed."
    }).select("id").single();
    if(r.error)throw r.error;
    selected=r.data.id;
  }
  async function saveCutting(form,id){
    const d=new FormData(form);
    const row={nickname:String(d.get("nickname")||"").trim().slice(0,100),
      stage:String(d.get("stage")||"cutting"),
      destination:String(d.get("destination")||"undecided"),
      rooted_on:String(d.get("rooted_on")||"")||null,
      potted_on:String(d.get("potted_on")||"")||null,
      established_on:String(d.get("established_on")||"")||null,
      linked_plant_id:String(d.get("linked_plant_id")||"")||null,
      notes:String(d.get("notes")||"").trim()};
    if(!STAGES.includes(row.stage)||!DESTINATIONS.includes(row.destination))throw Error("Invalid stage or destination.");
    const r=await client.from("gaia_propagation_cuttings").update({...row,updated_at:new Date().toISOString()}).eq("id",id).eq("user_id",user.id).select("id");
    if(r.error)throw r.error;
    if(r.data?.length!==1)throw Error("No cutting updated. Check permissions.");
  }
  async function jpeg(file){
    if(!file||file.size>20*1024*1024)throw Error("Choose an image under 20 MB.");
    if(!/^image\//.test(file.type))throw Error("Choose a JPEG, PNG or WebP image.");
    let bitmap;
    try{bitmap=await createImageBitmap(file);}catch(e){throw Error("This browser cannot decode the image. Try JPG or PNG.");}
    const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement("canvas");canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
    const ctx=canvas.getContext("2d");if(!ctx){bitmap.close();throw Error("Image conversion unavailable.");}
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",0.8));
    if(!blob||blob.size>8*1024*1024)throw Error("Unable to prepare a photo under 8 MB.");
    return blob;
  }
  async function uploadPhoto(form,id){
    const data=new FormData(form),file=data.get("image");
    if(!cuttings.some(c=>c.id===id))throw Error("Cutting not found.");
    const date=String(data.get("taken_on")||"");
    const today=localDay();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>today)throw Error("Select a real photo date, no later than today.");
    if(!globalThis.crypto?.randomUUID)throw Error("A secure browser connection is required for photos.");
    const blob=await jpeg(file);
    const path=user.id+"/"+id+"/"+crypto.randomUUID()+".jpg";
    const uploaded=await client.storage.from(BUCKET).upload(path,blob,{contentType:"image/jpeg",cacheControl:"3600",upsert:false});
    if(uploaded.error)throw uploaded.error;
    const record={id:crypto.randomUUID(),user_id:user.id,cutting_id:id,object_path:path,
      taken_on:date,caption:String(data.get("caption")||"").trim().slice(0,350)};
    const saved=await client.from("gaia_propagation_photos").insert(record);
    if(saved.error){
      await client.storage.from(BUCKET).remove([path]).catch(()=>{});
      throw saved.error;
    }
  }
  async function deletePhoto(id){
    const p=photos.find(x=>x.id===id);
    if(!p)throw Error("Photo not found.");
    const removed=await client.storage.from(BUCKET).remove([p.object_path]);
    if(removed.error)throw removed.error;
    const db=await client.from("gaia_propagation_photos").delete().eq("id",id).eq("user_id",user.id);
    if(db.error)throw db.error;
    return true;
  }
  function brief(id){
    const c=cuttings.find(x=>x.id===id),b=batches.find(x=>x.id===c?.batch_id);
    if(!c||!b)return;
    const text=["GAIA CATALOG GRADUATION REQUEST","Name: "+(c.nickname||"Unnamed cutting"),
      "Source batch: "+b.label,"Parent plant: "+(label(b.parent_plant_id)||"Unlinked"),
      "Method: "+b.method,"Cutting started: "+(b.started_on||"not recorded"),
      "Current stage: "+c.stage,"First roots: "+(c.rooted_on||"not recorded"),
      "Potted: "+(c.potted_on||"not recorded"),"Established: "+(c.established_on||"not recorded"),
      "Destination: "+c.destination,"Notes: "+(c.notes||"None"),
      "Please add this as a distinct plant in GAIA's GitHub plants.json only after confirming its species and identity. Keep the Nursery history linked. Do not invent dates or a photo."].join("\n");
    if(navigator.clipboard?.writeText){navigator.clipboard.writeText(text).then(()=>status("Catalog brief copied. Paste it into your GAIA ChatGPT project to create the full plant card."),()=>status("Clipboard blocked. Use a browser with clipboard permission.",true));}
    else{status("Clipboard unavailable. Copy the details manually from this record.",true);}
  }
  host.addEventListener("submit",e=>{
    const form=e.target;if(!(form instanceof HTMLFormElement))return;
    if(form.id==="gaia-nursery-new-form"){e.preventDefault();void run(()=>addBatch(form));}
    else if(form.dataset.kind==="cutting-save"){e.preventDefault();void run(()=>saveCutting(form,form.dataset.id));}
    else if(form.dataset.kind==="photo-upload"){e.preventDefault();void run(()=>uploadPhoto(form,form.dataset.id));}
  });
  host.addEventListener("click",e=>{
    const b=e.target.closest?.("button[data-action]");
    if(!b)return;
    const id=b.dataset.id,action=b.dataset.action;
    if(action==="select-cutting"){selected=selected===id?"":id;render();}
    else if(action==="add-cutting")void run(()=>addCutting(id));
    else if(action==="graduation-brief")brief(id);
    else if(action==="delete-photo" && confirm("Permanently delete this private propagation photo?"))void run(()=>deletePhoto(id));
    else if(action==="open-plant")window.GAIA_LEARNING_HUB?.openPlant?.(id);
  });
  document.addEventListener("gaia:ready",e=>{plants=e.detail?.plants||[];render();});
  document.addEventListener("gaia:auth",e=>{void updateAuth(e.detail?.client,e.detail?.user);});
  if(window.GAIA_CLOUD)void updateAuth(window.GAIA_CLOUD.client,window.GAIA_CLOUD.user);
  render();
})();