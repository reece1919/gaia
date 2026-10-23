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
    "Run a COMPLETE INTERACTIVE GAIA PHOTO REVIEW now for ALL newest pending plant photos in one chat. This is a manual run launched from GAIA, not the nightly job. Use ChatGPT's visual inspection, NOT a paid OpenAI API. Do not require manual photo uploads, copying JSON, or Todoist tasks.",
    "FIRST read connected GitHub repo reece1919/gaia: GAIA-CHATGPT-REFERENCE.md, gaia-reference/snapshot.json and GAIA-SCHEDULED-PHOTO-REVIEW.md. The snapshot includes plant care history and actual image paths for all journal uploads plus original catalog photos. Check synced_at, uploaded_photo_count vs exported_photo_count, and each plant's comparison.latest_image and comparison.candidates. Fetch and visually render the actual referenced image files through GitHub; metadata alone is not visual review.",
    "Freshness is critical: the GitHub snapshot is periodically refreshed, NOT live. Check the current latest-photo IDs and statuses in Supabase project zdurujqwhxqrwbhwzzxg via an authorized read operation when available. If newer uploads exist, refresh the existing GitHub snapshot through an authorized Work/browser session if supported before assessing; otherwise report exactly which items cannot be confirmed current. Do NOT work around connector safety denials or treat stale snapshot statuses as definitive.",
    "Review ONLY the newest photo per plant when its LIVE analysis_status is pending. Earlier pending uploads are historical evidence, not separate current reviews. Preserve all existing reviewed and needs_attention records; never overwrite them. If live status cannot be verified, report the limitation and do not attempt unverified writes.",
    "For each eligible plant, actually VISUALLY INSPECT the latest image and every available earlier journal/catalog candidate; use direct image pixels, not just descriptions. Original catalog capture dates may be unknown; do not invent dates. Consider recorded watering, measured soil moisture and scale, observed new growth, pot mix and notes; missing or not-yet-synced care entries are UNKNOWN rather than proof an event did not happen. Distinguish camera/light changes from real plant changes.",
    "Produce a condition (improving/stable/declining/uncertain), evidence-based summary, 1-5 direct observations, 0-2 low-risk checks with rationale and urgency, confidence (0-1), and exact comparison identity. Use the EXISTING authenticated GAIA Edge Function action=save_review described in GAIA-SCHEDULED-PHOTO-REVIEW.md. IMPORTANT: its write validator requires previous_source=private and previous_photo_id of the SECOND-newest journal photo when one exists; otherwise previous_source=reference and the exact plants.json catalog filename. Additional older/catalog images are useful visual context, not the required save payload's primary previous_source.",
    "Authenticated save is separate from read-only GitHub access. If this ChatGPT session lacks authorized Supabase write access, use an authenticated browser in ChatGPT Work mode if available (including GAIA owner login and AAL2 verification). Never expose or copy secrets or create an anonymous write route. If an operation is denied by safety checks, STOP that blocked operation; do not circumvent it or claim success.",
    "After each authorized save, verify the returned status=saved and photo ID, independently verify latest status becomes reviewed or needs_attention, and verify resulting GAIA checkable tasks and approval-only proposals. Do not perform real care actions, change care events, or create Todoist tasks. Continue through the entire queue within the capabilities and limits of the session, reporting what could not be completed.",
    "At the end report how many eligible plants, images/pairs inspected, reviews saved, pending/needs_attention statuses, checklist tasks created, approval proposals queued, unsynced or stale data, and any failed/blocked steps. Never claim a save, task, or complete batch without evidence.",
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
    draw("ChatGPT opened. For authenticated saving, select Work mode, then press Send.");
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
