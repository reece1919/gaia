/* Signed-in newest-photo review queue. No writes, public photo links or AI calls. */
(() => {
  "use strict";
  const container=document.querySelector("#gaia-photo-reviews .gaia-photo-reviews-content");
  const panel=document.getElementById("gaia-photo-reviews");
  const core=window.GAIA_PHOTO_REVIEW_QUEUE_CORE;
  if(!container||!panel||!core||document.getElementById("gaia-review-pending-queue"))return;

  const esc=value=>String(value??"").replace(/[&<>"']/g,
    char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const dateText=value=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value||""))return "Date not recorded";
    const [year,month,day]=value.split("-").map(Number);
    const d=new Date(year,month-1,day,12);
    return Number.isNaN(d.getTime())?"Date not recorded":
      d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
  };
  const timeText=stamp=>new Date(stamp).toLocaleTimeString(undefined,
    {hour:"numeric",minute:"2-digit"});
  const root=document.createElement("section");
  root.id="gaia-review-pending-queue";
  root.className="gaia-review-pending-queue";
  root.setAttribute("aria-label","Latest journal photos awaiting review");
  const head=document.createElement("div");
  head.className="gaia-review-queue-heading";
  const title=document.createElement("strong");
  title.textContent="Latest photos awaiting review";
  const refreshButton=document.createElement("button");
  refreshButton.type="button";
  refreshButton.textContent="Check status";
  refreshButton.setAttribute("aria-label","Recheck current private photo review statuses");
  head.append(title,refreshButton);
  const state=document.createElement("p");
  state.className="gaia-review-queue-status";
  state.setAttribute("role","status");
  state.setAttribute("aria-live","polite");
  const list=document.createElement("div");
  list.className="gaia-review-queue-list";
  root.append(head,state,list);
  container.insertBefore(root,container.firstChild);
  const badge=document.createElement("span");
  badge.className="gaia-review-pending-badge";
  badge.hidden=true;
  panel.querySelector("summary")?.appendChild(badge);

  let client=window.GAIA_CLOUD?.client||null;
  let user=window.GAIA_CLOUD?.user||null;
  let data=null,loadedAt=0,busy=false,error="",sequence=0;
  const plants=()=>new Map((window.GAIA_DATA?.plants||[])
    .map(plant=>[String(plant.id),plant.name]));
  function render(){
    const authenticated=Boolean(client&&user);
    refreshButton.disabled=!authenticated||busy;
    if(!authenticated){
      badge.hidden=true;
      state.textContent="Sign in under Settings & Backup to check your private journal photos.";
      list.replaceChildren();
      return;
    }
    if(busy){
      state.textContent="Checking the current photo records…";
      if(!data){list.replaceChildren();badge.hidden=true;return;}
    }else if(error){
      badge.hidden=true;
      state.textContent="Could not refresh photo status: "+error+
        (data?" · Previously loaded results may be outdated.":"");
      if(!data){list.replaceChildren();return;}
    }else if(!data){
      badge.hidden=true;
      state.textContent="No photo status has been loaded yet.";
      list.replaceChildren();
      return;
    }
    if(!busy&&!error)state.textContent=
      "Checked "+timeText(loadedAt)+" from your signed-in GAIA photo records. "+
      "This is a snapshot, not an automatic review.";
    badge.hidden=Boolean(busy||error);
    badge.textContent=data.pending.length+" pending";
    const byId=plants();
    const markup=data.pending.map(item=>{
      const name=byId.get(String(item.plant_id))||"Plant "+item.plant_id;
      const previous=item.previous_review;
      const assessment=previous?(previous.analyzed_at?
        "Previous review "+dateText(String(previous.analyzed_at).slice(0,10)):
        "Previous review saved; date not recorded"):
        "No earlier completed photo assessment";
      return '<article class="gaia-review-queue-item">'+
        '<div class="gaia-review-queue-item-copy"><strong>'+esc(name)+'</strong>'+
        '<span>Newest private photo · '+esc(dateText(item.taken_on))+'</span>'+
        '<small>'+esc(assessment)+'</small></div>'+
        '<button type="button" data-gaia-review-open-plant="'+esc(item.plant_id)+
        '" aria-label="Open photo journal for '+esc(name)+'">Open plant</button>'+
        '</article>';
    }).join("");
    list.innerHTML=markup+
      (data.processing.length?'<p class="gaia-review-queue-muted">'+
        data.processing.length+' latest photo'+(data.processing.length===1?" is":"s are")+
        ' marked in progress, not pending.</p>':"")+
      (!data.pending.length?'<p class="gaia-review-queue-muted">No newest photos awaiting review.</p>':"");
    const footer=document.createElement("p");
    footer.className="gaia-review-queue-footnote";
    footer.textContent="Catalog cover photos are not journal uploads. Earlier pending photos are historical evidence, not additional queue items.";
    list.appendChild(footer);
  }
  async function refresh(force=false){
    if(!client||!user){render();return;}
    if(busy||(!force&&data&&Date.now()-loadedAt<60000))return;
    const current=++sequence,owner=user.id,db=client;
    busy=true;error="";render();
    try{
      const result=await db.from("plant_photos")
        .select("id,plant_id,taken_on,created_at,analysis_status,analyzed_at")
        .eq("user_id",owner).order("taken_on",{ascending:false})
        .order("created_at",{ascending:false}).order("id",{ascending:false}).limit(1500);
      if(result.error)throw result.error;
      if(current!==sequence||user?.id!==owner)return;
      if((result.data||[]).length===1500)throw new Error("Photo history exceeds 1,500 records; showing a partial queue would be misleading.");
      data=core.build(result.data||[]);
      loadedAt=Date.now();
    }catch(ex){
      if(current===sequence)error=String(ex?.message||"Connection error");
    }finally{
      if(current===sequence){busy=false;render();}
    }
  }
  function auth(detail){
    const old=user?.id||null;
    client=detail?.client||null;
    user=detail?.user||null;
    if(old!==(user?.id||null)){
      sequence++;
      busy=false;
      data=null;
      loadedAt=0;
      error="";
    }
    render();
    if(client&&user)void refresh(true);
  }
  refreshButton.addEventListener("click",()=>void refresh(true));
  root.addEventListener("click",event=>{
    const button=event.target.closest("[data-gaia-review-open-plant]");
    if(!button)return;
    const id=button.dataset.gaiaReviewOpenPlant;
    const card=[...document.querySelectorAll("#grid .card[data-plant-id]")]
      .find(node=>node.dataset.plantId===id);
    if(!card){state.textContent="This plant card is not loaded. Refresh the page and try again.";return;}
    card.open=true;
    card.scrollIntoView({behavior:"smooth",block:"start"});
    card.querySelector(":scope > summary")?.focus({preventScroll:true});
  });
  document.addEventListener("gaia:ready",render);
  document.addEventListener("gaia:auth",event=>auth(event.detail||{}));
  document.addEventListener("gaia:photo-reviews-changed",()=>void refresh(true));
  document.addEventListener("gaia:photos-changed",event=>{
    if(event.detail?.owner===user?.id)void refresh(true);
  });
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible"&&Date.now()-loadedAt>60000)
      void refresh();
  });
  render();
  if(client&&user)void refresh(true);
})();