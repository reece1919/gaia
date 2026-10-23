/* GAIA pot / soil profiles, moisture checks, and manual growth observations.
 * Independent of automated photo reviews. Local-first, with owner-only Supabase sync.
 */
(() => {
  "use strict";
  const PREFIX = "gaia-pot-soil-v1";
  const state = {plants: [], db: null, user: null, profiles: {}, checks: [],
    remoteProfiles: {}, remoteChecks: [], lastWater: {}, busy: false, mounted: false,
    message: "", error: false};
  const esc = x => String(x ?? "").replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const today = () => {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
  };
  const dateLabel = d => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "")) return d || "Not recorded";
    const [y,m,day] = d.split("-").map(Number);
    return new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",year:"numeric"})
      .format(new Date(y,m-1,day));
  };
  const key = () => PREFIX + (state.user ? "-user-" + state.user.id : "-device");
  const uid = () => crypto.randomUUID();
  function save() {
    try {
      localStorage.setItem(key(), JSON.stringify({profiles:state.profiles,checks:state.checks}));
      return true;
    } catch (_) {
      message("Browser storage is full or blocked; the latest change may not be retained.",true);
      return false;
    }
  }
  function load() {
    state.profiles={}; state.checks=[]; state.remoteProfiles={}; state.remoteChecks=[]; state.lastWater={};
    try {
      const obj=JSON.parse(localStorage.getItem(key()) || "{}");
      if (obj.profiles && typeof obj.profiles==="object" && !Array.isArray(obj.profiles)) {
        state.profiles=obj.profiles;
      }
      if (Array.isArray(obj.checks)) state.checks=obj.checks.filter(e=>e&&e.id&&e.plant_id);
    } catch (_) {message("Saved pot records could not be read.",true);}
  }
  function message(s,isError=false) {
    state.message=s; state.error=isError;
    document.querySelectorAll(".ps-message").forEach(el => {
      el.textContent=s; el.hidden=!s; el.classList.toggle("ps-error",isError);
    });
  }
  function profileFor(id) {
    const local=state.profiles[id], remote=state.remoteProfiles[id];
    if (!remote) return local || null;
    if (!local) return remote;
    if (local.synced===false) return local;
    return (String(local.updated_at||"")>String(remote.updated_at||""))?local:remote;
  }
  function observationsFor(id) {
    const m=new Map();
    state.remoteChecks.filter(x=>x.plant_id===id).forEach(x=>m.set(x.id,{...x,synced:true}));
    state.checks.filter(x=>x.plant_id===id).forEach(x=>m.set(x.id,x));
    return [...m.values()].sort((a,b)=>String(b.observed_on).localeCompare(String(a.observed_on)) ||
      String(b.created_at||"").localeCompare(String(a.created_at||"")));
  }
  function panelHtml(p) {
    return '<section class="ps-panel" data-ps-plant="'+esc(p.id)+'">' +
      '<details class="ps-details"><summary>Pot, soil &amp; growth tracking <span class="ps-summary">No readings yet</span></summary>' +
      '<div class="ps-content"><div class="ps-pot-summary">No pot information saved.</div>' +
      '<div class="ps-water">Last watered: check care journal</div>' +
      '<details class="ps-editor"><summary>Edit pot &amp; soil</summary>' +
      '<form class="ps-pot-form"><div class="ps-fields">' +
      '<label>Inner pot diameter (inches)<input type="number" name="inner_diameter_in" min=".5" max="100" step=".25" inputmode="decimal" placeholder="e.g. 4"></label>' +
      '<label>Inner pot depth (inches)<input type="number" name="inner_depth_in" min=".5" max="100" step=".25" inputmode="decimal" placeholder="Optional"></label>' +
      '<label>Inner pot material<input type="text" name="inner_material" maxlength="80" placeholder="Plastic, terracotta…"></label>' +
      '<label>Outer decorative pot<input type="text" name="outer_pot" maxlength="120" placeholder="e.g. skull planter"></label>' +
      '<label class="ps-check"><input type="checkbox" name="clear_inner"> Clear inner pot</label>' +
      '<label class="ps-check"><input type="checkbox" name="drainage_holes"> Inner pot has drainage holes</label>' +
      '<label class="ps-wide">Actual soil mix<textarea name="soil_mix" rows="2" maxlength="500" placeholder="e.g. nursery mix + perlite; note proportions if known"></textarea></label>' +
      '<label>Last repotted (if known)<input type="date" name="repotted_on"></label>' +
      '</div><button class="ps-save" type="submit">Save pot details</button></form></details>' +
      '<div class="ps-divider"><strong>Soil checks &amp; new growth</strong><span>Independent of photo reviews</span></div>' +
      '<form class="ps-observe-form"><div class="ps-fields">' +
      '<label>Date<input type="date" name="observed_on" value="'+today()+'" required></label>' +
      '<label>Moisture reading<input name="moisture_value" type="number" inputmode="decimal" min="0" max="100" step=".1" placeholder="Optional"></label>' +
      '<label>Meter scale<select name="moisture_scale"><option value="1-10">1–10</option><option value="0-100">0–100 / percent</option><option value="other">Other</option></select></label>' +
      '<label class="ps-check ps-growth"><input type="checkbox" name="new_growth"> New growth observed</label>' +
      '<label class="ps-wide">Notes<textarea name="note" rows="2" maxlength="500" placeholder="New leaf, root, shoot, location of reading…"></textarea></label>' +
      '</div><button class="ps-save" type="submit">Save observation</button></form>' +
      '<div class="ps-recent">No soil checks or growth logged yet.</div>' +
      '<ol class="ps-list"></ol><p class="ps-message" aria-live="polite" hidden></p></div></details></section>';
  }
  function hydrate(panel) {
    const p=profileFor(panel.dataset.psPlant);
    const f=panel.querySelector(".ps-pot-form");
    if (!f || f.dataset.dirty==="true") return;
    for(const field of ["inner_diameter_in","inner_depth_in","inner_material","outer_pot","soil_mix","repotted_on"])
      f.elements[field].value=p?.[field]??"";
    for(const field of ["clear_inner","drainage_holes"]) f.elements[field].checked=!!p?.[field];
  }
  function render() {
    document.querySelectorAll(".ps-panel").forEach(panel=>{
      const id=panel.dataset.psPlant, p=profileFor(id), rows=observationsFor(id);
      const potParts=[];
      if(p?.inner_diameter_in) potParts.push(p.inner_diameter_in+'″ inner pot'+(p.inner_depth_in?' × '+p.inner_depth_in+'″ deep':""));
      if(p?.inner_material) potParts.push(p.inner_material);
      if(p?.clear_inner) potParts.push("clear");
      if(p?.drainage_holes) potParts.push("drainage holes");
      if(p?.outer_pot) potParts.push("Outer: "+p.outer_pot);
      panel.querySelector(".ps-pot-summary").textContent=potParts.length?potParts.join(" · "):"Pot dimensions and material not recorded.";
      const mix=panel.querySelector(".ps-mix");
      if(mix) mix.remove();
      if(p?.soil_mix || p?.repotted_on){
        const el=document.createElement("p"); el.className="ps-mix";
        el.textContent=(p.soil_mix?"Mix: "+p.soil_mix:"")+
          (p.repotted_on?(p.soil_mix?" · ":"")+"Repotted: "+dateLabel(p.repotted_on):"");
        panel.querySelector(".ps-pot-summary").after(el);
      }
      panel.querySelector(".ps-water").textContent="Last watered: "+
        (state.lastWater[id]?dateLabel(state.lastWater[id]):"See care journal");
      panel.querySelector(".ps-summary").textContent=rows.length?
        rows.length+" check"+(rows.length===1?"":"s")+
        (rows.some(x=>x.new_growth)?" · growth logged":""):"No readings yet";
      panel.querySelector(".ps-recent").textContent=rows.length?
        "Latest check: "+dateLabel(rows[0].observed_on):"No soil checks or growth logged yet.";
      panel.querySelector(".ps-list").innerHTML=rows.slice(0,15).map(x=>
        '<li><div><strong>'+esc(dateLabel(x.observed_on))+'</strong>'+
        (x.moisture_value!=null?' · Moisture '+esc(x.moisture_value)+' ('+esc(x.moisture_scale||"1-10")+')':"")+
        (x.new_growth?' · <strong>New growth ✓</strong>':"")+
        (x.note?'<p>'+esc(x.note)+'</p>':"")+
        (state.user&&!x.synced?' <small>Pending sync</small>':"")+
        '</div><button type="button" data-ps-remove="'+esc(x.id)+'" aria-label="Remove soil observation">Remove</button></li>'
      ).join("");
      hydrate(panel);
    });
    if (state.message) message(state.message,state.error);
  }
  function mount(arr) {
    if (state.mounted) return;
    const cards=[...document.querySelectorAll("#grid .card")];
    if (!cards.length) return;
    state.plants=arr;
    for(const [i,card] of cards.entries()){
      const plant=arr.find(p=>p.id===card.dataset.plantId) || arr[i];
      if(!plant) continue;
      const where=card.querySelector(".care-tracker") || card.querySelector(".care");
      if(where) where.insertAdjacentHTML(where.classList.contains("care-tracker")?"afterend":"afterbegin",panelHtml(plant));
    }
    state.mounted=true;
    render();
  }
  function validDate(d) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d||"") || d>today()) return false;
    const parsed=new Date(d+"T12:00:00");
    return !Number.isNaN(parsed.valueOf()) && [parsed.getFullYear(),String(parsed.getMonth()+1).padStart(2,"0"),String(parsed.getDate()).padStart(2,"0")].join("-")===d;
  }
  function hasPlant(id) {return state.plants.some(p=>p.id===id);}
  async function sync() {
    if(!state.db||!state.user||state.busy)return;
    state.busy=true;
    try {
      const pendingProfiles=Object.values(state.profiles).filter(p=>p?.synced===false);
      const pendingChecks=state.checks.filter(x=>x?.synced===false);
      if(pendingProfiles.length){
        const rec=pendingProfiles.map(p=>({
          user_id:state.user.id,plant_id:p.plant_id,inner_diameter_in:p.inner_diameter_in,
          inner_depth_in:p.inner_depth_in,inner_material:p.inner_material||"",
          clear_inner:!!p.clear_inner,drainage_holes:!!p.drainage_holes,
          outer_pot:p.outer_pot||"",soil_mix:p.soil_mix||"",
          repotted_on:p.repotted_on||null,updated_at:p.updated_at
        }));
        const {error}=await state.db.from("gaia_pot_profiles").upsert(rec,{onConflict:"user_id,plant_id"});
        if(error)throw error;
        pendingProfiles.forEach(p=>{p.synced=true;});
        save();
      }
      if(pendingChecks.length){
        const rec=pendingChecks.map(x=>({
          id:x.id,user_id:state.user.id,plant_id:x.plant_id,
          observed_on:x.observed_on,moisture_value:x.moisture_value,
          moisture_scale:x.moisture_scale||"1-10",
          new_growth:!!x.new_growth,note:x.note||"",created_at:x.created_at
        }));
        const {error}=await state.db.from("gaia_soil_observations").upsert(rec,{onConflict:"id"});
        if(error)throw error;
        pendingChecks.forEach(x=>{x.synced=true;});
        save();
      }
      const [a,b,c]=await Promise.all([
        state.db.from("gaia_pot_profiles").select("*").limit(5000),
        state.db.from("gaia_soil_observations").select("*").order("observed_on",{ascending:false}).limit(5000),
        state.db.from("plant_care_events").select("plant_id,happened_on").eq("action_type","water")
          .order("happened_on",{ascending:false}).limit(5000)
      ]);
      if(a.error||b.error||c.error)throw (a.error||b.error||c.error);
      state.remoteProfiles=Object.fromEntries((a.data||[]).map(p=>[p.plant_id,{...p,synced:true}]));
      state.remoteChecks=(b.data||[]).map(x=>({...x,synced:true}));
      state.lastWater={};
      (c.data||[]).forEach(x=>{if(!state.lastWater[x.plant_id])state.lastWater[x.plant_id]=x.happened_on;});
      for(const [id,p] of Object.entries(state.remoteProfiles)){
        const old=state.profiles[id];
        if(!old||old.synced!==false)state.profiles[id]=p;
      }
      const cloudIds=new Set(state.remoteChecks.map(x=>x.id));
      if(state.remoteChecks.length<5000)
        state.checks=state.checks.filter(x=>!x.synced||cloudIds.has(x.id));
      const known=new Set(state.checks.map(x=>x.id));
      for(const x of state.remoteChecks)if(!known.has(x.id))state.checks.push(x);
      save();
      message("Pot profiles and observations synced across signed-in devices.");
    } catch(e) {
      console.error("GAIA pot / soil sync",e);
      message("Cloud sync failed; records remain on this device. "+(e?.message||"Try again online."),true);
    } finally {state.busy=false; render();}
  }
  function connect(detail) {
    const previous=state.user?.id||null, next=detail?.user?.id||null;
    state.db=detail?.client||null;
    if(previous!==next) {
      state.user=detail?.user||null;
      load(); render();
    }
    if(next)void sync();
  }
  document.addEventListener("gaia:auth",e=>connect(e.detail));
  document.addEventListener("gaia:care-synced",()=>{
    if(state.user&&!state.busy)void sync();
  });
  document.addEventListener("gaia:ready",e=>mount(e.detail.plants||[]));
  document.addEventListener("input",e=>{
    if(e.target.closest(".ps-pot-form"))e.target.closest("form").dataset.dirty="true";
  });
  document.addEventListener("change",e=>{
    if(e.target.closest(".ps-pot-form"))e.target.closest("form").dataset.dirty="true";
  });
  document.addEventListener("submit",async e=>{
    const form=e.target;
    if(!form.matches(".ps-pot-form,.ps-observe-form"))return;
    e.preventDefault();
    const panel=form.closest(".ps-panel"), id=panel?.dataset.psPlant;
    if(!hasPlant(id))return;
    if(form.classList.contains("ps-pot-form")){
      const f=form.elements;
      const diameter=f.inner_diameter_in.value===""?null:Number(f.inner_diameter_in.value);
      const depth=f.inner_depth_in.value===""?null:Number(f.inner_depth_in.value);
      if((diameter!=null&&(!Number.isFinite(diameter)||diameter<=0||diameter>100)) ||
         (depth!=null&&(!Number.isFinite(depth)||depth<=0||depth>100)) ||
         (f.repotted_on.value&&!validDate(f.repotted_on.value))) {
        message("Enter valid pot dimensions and a repot date no later than today.",true);return;
      }
      state.profiles[id]={plant_id:id,inner_diameter_in:diameter,inner_depth_in:depth,
        inner_material:f.inner_material.value.trim().slice(0,80),
        clear_inner:f.clear_inner.checked,drainage_holes:f.drainage_holes.checked,
        outer_pot:f.outer_pot.value.trim().slice(0,120),
        soil_mix:f.soil_mix.value.trim().slice(0,500),
        repotted_on:f.repotted_on.value||null,updated_at:new Date().toISOString(),synced:false};
      form.dataset.dirty="false";
      const ok=save();
      message(ok?"Pot profile saved"+(state.user?"; syncing…": " on this device."):"Pot profile could not be saved.",!ok);
      render(); if(state.user)await sync();
    } else {
      const f=form.elements, date=f.observed_on.value, raw=f.moisture_value.value,
        scale=f.moisture_scale.value, value=raw===""?null:Number(raw),
        growth=f.new_growth.checked, note=f.note.value.trim().slice(0,500);
      if(!validDate(date)|| !["1-10","0-100","other"].includes(scale) ||
         (value!=null&&(!Number.isFinite(value)||value<0||value>(scale==="1-10"?10:100)))) {
        message("Enter a valid date and a reading within the selected meter scale.",true);return;
      }
      if(value===null&&!growth&&!note) {
        message("Enter a moisture reading, check new growth, or add a note.",true);return;
      }
      const row={id:uid(),plant_id:id,observed_on:date,moisture_value:value,
        moisture_scale:scale,new_growth:growth,note,
        created_at:new Date().toISOString(),synced:false};
      state.checks.push(row);const ok=save();
      message(ok?"Observation saved"+(state.user?"; syncing…":" on this device."):"Observation could not be saved.",!ok);
      form.elements.moisture_value.value="";form.elements.new_growth.checked=false;
      form.elements.note.value="";form.elements.observed_on.value=today();
      render();if(state.user)await sync();
    }
  });
  document.addEventListener("click",async e=>{
    const button=e.target.closest("[data-ps-remove]");
    if(!button)return;
    const id=button.dataset.psRemove, row=state.checks.find(x=>x.id===id)||
      state.remoteChecks.find(x=>x.id===id);
    if(!row||!confirm("Remove this soil or growth observation?"))return;
    if(state.db&&state.user&&row.synced){
      const {error}=await state.db.from("gaia_soil_observations").delete().eq("id",id);
      if(error){message("Could not remove the cloud record; try again when online.",true);return;}
    }
    state.checks=state.checks.filter(x=>x.id!==id);
    state.remoteChecks=state.remoteChecks.filter(x=>x.id!==id);
    save();message("Observation removed.");render();
  });
  load();
  window.GAIA_POT_SOIL = {
    profile: id => { const p=profileFor(id); return p?{...p}:null; },
    pending: () => Object.values(state.profiles).some(p=>p?.synced===false) || state.checks.some(x=>x?.synced===false),
    refresh: sync
  };
  document.addEventListener("gaia:clipboard-saved",()=>{if(state.user)void sync();});
  if(window.GAIA_DATA?.plants)mount(window.GAIA_DATA.plants);
  if(window.GAIA_CLOUD)connect(window.GAIA_CLOUD);
})();

