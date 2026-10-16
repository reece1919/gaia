/* GAIA: One manual "Review New Photos" entry into interactive ChatGPT.
   No paid API, no copy/paste, no photo bytes or credentials in the launch URL. */
(() => {
  "use strict";
  const button=document.getElementById("gaia-review-new-photos");
  const status=document.getElementById("gaia-review-queue-count");
  if(!button||!status)return;
  let client=null,user=null,sequence=0,checkAt=0,busy=false;
  const GUIDE="GAIA-SCHEDULED-PHOTO-REVIEW.md";
  const reviewPrompt=[
    "Run a COMPLETE INTERACTIVE GAIA PHOTO REVIEW for my collection now. This is a single manual run initiated from GAIA, NOT the nightly scheduled task. No copy/paste/import step, no additional upload, and no paid OpenAI API. Work through ALL eligible plants in this ONE chat; do not stop after the first plant.",
    "Use my connected GitHub repository reece1919/gaia and Supabase project zdurujqwhxqrwbhwzzxg. FIRST read the current GitHub file "+GUIDE+" for the verified private-photo retrieval workflow and the owner-verified action=save_review endpoint.",
    "Verify my authorized Supabase owner. Query public.plant_photos ordered by taken_on DESC, created_at DESC (with ID tie-break) for every plant. Review only the LATEST stored photo for each plant whose analysis_status is pending. Older pending historical photos are comparisons, not separate current reviews. Preserve already-reviewed photos. Scan the queue fresh; do not assume counts from the launch page.",
    "For EVERY eligible plant: retrieve and VISUALLY INSPECT its latest private photo and the second-most-recent private photo of the SAME plant. If there is only one private photo, use the exact original GitHub image in plants.json as the comparison source. Render actual pixels from both images, not just metadata or captions. Compare real changes and distinguish lighting/framing artifacts and uncertainty from visible deterioration. Do not guess unseen roots, pests, or soil moisture.",
    "For EACH genuinely inspected pair, construct a concise condition, evidence-based summary, 1-5 observations, 0-2 cautious practical care checks with reasons and urgency, confidence 0-1, and the exact earlier-image identity. Save immediately to the verified GAIA backend via its existing, owner-validated Supabase Edge Function action=save_review as specified in "+GUIDE+". Read the asynchronous HTTP response AND independently verify the latest photo was saved to public.plant_photos. The GAIA backend creates checkable tasks for safe observation/inspection recommendations; consequential care actions go to GAIA's task-approval queue. Do NOT complete care events, approve interventions, or create Todoist tasks.",
    "If a connector safety policy rejects saving, STOP THAT blocked write (no workarounds or retries), retain pending status, and report it accurately. Continue only independent read-only comparisons that are permitted. Never claim success without verified saved rows or queued tasks. Never expose private image bytes, Vault secrets, or storage URLs in chat. Try to clean temporary response data only if supported, otherwise report TTL limitation.",
    "Continue through the entire pending queue in this one chat. At completion, report per-plant status and condition, how many pairs were actually inspected, how many saved, how many checkable GAIA tasks were created and how many intervention suggestions were queued, how many latest photos remain pending, and all genuine blockers. You may group safe independent tool operations, but do not invent inspected images or write results."
  ].join("\n\n");
  function draw(msg,alert=false){
    status.textContent=msg;
    status.classList.toggle("gaia-review-error",alert);
  }
  async function refresh(){
    if(!client||!user){button.disabled=true;draw("Sign in to review saved photos.");return;}
    const owner=user.id,token=++sequence;
    try{
      const {data,error}=await client.from("plant_photos")
        .select("id,plant_id,analysis_status,taken_on,created_at")
        .eq("user_id",owner)
        .order("taken_on",{ascending:false})
        .order("created_at",{ascending:false})
        .order("id",{ascending:false})
        .limit(1500);
      if(error)throw error;
      if(token!==sequence||owner!==user?.id)return;
      const seen=new Set();
      const pending=[];
      for(const photo of data||[]){
        if(seen.has(photo.plant_id))continue;
        seen.add(photo.plant_id);
        if(photo.analysis_status==="pending")pending.push(photo);
      }
      button.disabled=!pending.length||busy;
      checkAt=Date.now();
      draw(pending.length?
        pending.length+" plant"+(pending.length===1?"":"s")+" with new photos":
        "No new photos awaiting review.");
    }catch(e){
      if(token===sequence){button.disabled=true;draw("Could not check the photo queue. "+String(e.message||"Try again."),true);}
    }
  }
  button.addEventListener("click",()=>{
    if(button.disabled||!user)return;
    // A prefilled, user-initiated ChatGPT conversation, not a scheduled task or API request.
    window.open("https://chatgpt.com/?q="+encodeURIComponent(reviewPrompt),"_blank","noopener,noreferrer");
    draw("ChatGPT opened. Press Send to review all new photos in one chat.");
  });
  document.addEventListener("gaia:auth",e=>{
    const prior=user?.id||null;
    client=e.detail?.client||null;
    user=e.detail?.user||null;
    if((user?.id||null)!==prior){++sequence;checkAt=0;}
    void refresh();
  });
  document.addEventListener("gaia:photo-reviews-changed",()=>void refresh());
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible"&&Date.now()-checkAt>15000)void refresh();
  });
  if(window.GAIA_CLOUD){
    client=window.GAIA_CLOUD.client||null;user=window.GAIA_CLOUD.user||null;
  }
  void refresh();
})();
