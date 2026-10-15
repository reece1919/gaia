/* GAIA private photo-comparison summary; never sends images to the browser except via existing journal. */
(() => {
  "use strict";
  const root=document.getElementById("gaia-photo-review-summary");
  if(!root)return;
  const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const names=()=>new Map((window.GAIA_DATA?.plants||[]).map(p=>[String(p.id),p.name]));
  let client=null,user=null,records=[],busy=false,last=0,sequence=0;
  const statusLabel={pending:"Awaiting comparison",processing:"Review in progress",reviewed:"Reviewed",needs_attention:"Needs attention",unavailable:"Unavailable"};
  function render(){
    if(!user||!client){
      root.innerHTML='<p class="gaia-insights-empty">Sign in to see your private photo comparisons.</p>';
      return;
    }
    if(busy&&!records.length){
      root.innerHTML='<p class="gaia-insights-empty">Checking stored photo reviews…</p>';return;
    }
    const recent=new Map();
    for(const p of records)if(!recent.has(p.plant_id))recent.set(p.plant_id,p);
    const latest=[...recent.values()];
    const ready=latest.filter(p=>["reviewed","needs_attention"].includes(p.analysis_status));
    const attention=ready.filter(p=>p.analysis_status==="needs_attention");
    const waiting=latest.filter(p=>["pending","processing"].includes(p.analysis_status));
    const byName=names();
    root.innerHTML='<div class="gaia-photo-review-head"><strong>Photo condition comparisons</strong>'+
      '<span>'+esc(ready.length)+' reviewed · '+esc(waiting.length)+' awaiting · '+esc(attention.length)+' flagged</span></div>'+
      (ready.length?'<div class="gaia-photo-review-grid">'+ready
        .sort((a,b)=>Number(b.analysis_status==="needs_attention")-Number(a.analysis_status==="needs_attention"))
        .map(p=>{
          const findings=Array.isArray(p.analysis_findings)?p.analysis_findings:[];
          const trend=findings.find(f=>f.kind==="trend")?.text||"Review";
          const care=findings.filter(f=>f.kind==="care").slice(0,2);
          const evidence=findings.filter(f=>f.kind==="observation").slice(0,3);
          const comparison=String(trend).toLowerCase()==="baseline only; no historical image available"?"Baseline only":trend;
          return '<details class="gaia-photo-review-item"><summary><strong>'+esc(byName.get(String(p.plant_id))||"Plant "+p.plant_id)+
            '</strong><span>'+esc(statusLabel[p.analysis_status])+' · '+esc(comparison)+'</span></summary>'+
            '<p>'+esc(p.analysis_summary||"No visual summary available.")+'</p>'+
            (evidence.length?'<ul>'+evidence.map(f=>'<li>'+esc(f.text)+'</li>').join("")+'</ul>':"")+
            (care.length?'<div class="gaia-photo-advice"><strong>Care recommendations</strong><ul>'+
              care.map(f=>'<li>'+esc(f.text)+(f.reason?' — '+esc(f.reason):"")+'</li>').join("")+'</ul></div>':
              '<p class="gaia-photo-muted">No new care actions suggested.</p>')+
            '</details>';
        }).join("")+'</div>': '<p class="gaia-insights-empty">No stored photos have been visually assessed yet. The scheduled reviewer only analyzes saved private photos when a vision service is configured.</p>')+
      (waiting.length?'<p class="gaia-photo-muted">'+esc(waiting.length)+
        ' plants have photos awaiting automated visual assessment. Older photos remain available as historical baselines.</p>':"");
  }
  async function refresh(force=false){
    if(!client||!user||busy||(!force&&Date.now()-last<60000))return;
    const seq=++sequence,owner=user.id;
    busy=true;render();
    try {
      const {data,error}=await client.from("plant_photos")
        .select("id,plant_id,taken_on,created_at,analysis_status,analysis_summary,analysis_findings,analyzed_at")
        .eq("user_id",owner).order("taken_on",{ascending:false})
        .order("created_at",{ascending:false}).limit(1500);
      if(error)throw error;
      if(seq===sequence&&user?.id===owner){
        records=data||[];last=Date.now();
      }
    }catch(e){
      if(seq===sequence)root.textContent="Could not read private photo reviews: "+(e?.message||"Connection error");
      return;
    }finally{
      if(seq===sequence){busy=false;render();}
    }
  }
  function login(detail){
    const nextUser=detail?.user||null,nextClient=detail?.client||null;
    if(nextUser?.id!==user?.id) {sequence++;records=[];last=0;busy=false;}
    user=nextUser;client=nextClient;render();void refresh(true);
  }
  document.addEventListener("gaia:auth",event=>login(event.detail));
  document.addEventListener("gaia:ready",()=>render());
  document.addEventListener("gaia:photo-reviews-changed",()=>void refresh(true));
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")void refresh();});
  if(window.GAIA_CLOUD)login(window.GAIA_CLOUD);else render();
})();
