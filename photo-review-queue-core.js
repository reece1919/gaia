/* Pure photo-review queue logic: one actionable latest journal photo per plant. */
(() => {
  "use strict";
  const completed=new Set(["reviewed","needs_attention"]);
  const desc=(a,b)=>String(b??"").localeCompare(String(a??""));
  function build(rows){
    // Match GAIA's manual reviewer: photo date, upload time, then stable photo ID.
    // An older pending upload must never become a second actionable review.
    const sorted=[...(Array.isArray(rows)?rows:[])]
      .filter(row=>row&&row.plant_id!=null&&row.id!=null)
      .sort((a,b)=>desc(a.taken_on,b.taken_on)||
        desc(a.created_at,b.created_at)||desc(a.id,b.id));
    const byPlant=new Map();
    for(const row of sorted){
      const id=String(row.plant_id);
      if(!byPlant.has(id))byPlant.set(id,[]);
      byPlant.get(id).push(row);
    }
    const pending=[],processing=[];
    let completedLatest=0;
    for(const [plantId,history] of byPlant){
      const current=history[0];
      const status=String(current.analysis_status||"pending");
      const previous=history.slice(1).find(row=>completed.has(row.analysis_status))||null;
      const item={...current,plant_id:plantId,previous_review:previous?
        {analyzed_at:previous.analyzed_at||null,photo_date:previous.taken_on||null}:null};
      if(status==="pending")pending.push(item);
      if(status==="processing")processing.push(item);
      if(completed.has(status))completedLatest++;
    }
    return {pending,processing,completedLatest,withJournal:byPlant.size};
  }
  const api={build};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(typeof window!=="undefined")window.GAIA_PHOTO_REVIEW_QUEUE_CORE=api;
})();