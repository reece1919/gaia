import { createClient } from "npm:@supabase/supabase-js@2.57.0";

// GAIA private image-review worker. Browser requests require a verified AAL2
// session; unattended requests require a separate secret stored in Supabase Vault.
const headers = {
  "Access-Control-Allow-Origin": "https://reece1919.github.io",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};
const reply = (body, status=200) => new Response(JSON.stringify(body), { status, headers });
const validUuid = value => typeof value === "string" && /^[a-f0-9-]{36}$/i.test(value);
const sliceText = (s, n=900) => String(s || "").trim().slice(0,n);
const bucket = "gaia-plant-photos";
const runLimit = 18; // Upper cost and processing bound per invocation.
const modelName = "gpt-4.1-mini";
const modelSource = "openai-gpt-4.1-mini";

function toBase64(bytes) {
  let result = "";
  for (let i=0; i<bytes.length; i+=8192)
    result += String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(result);
}
function jwtClaims(token) {
  try {
    const value = token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");
    return JSON.parse(atob(value));
  } catch (_) { return null; }
}
function pacificDate() {
  return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"})
    .format(new Date());
}
async function catalog() {
  try {
    const result = await fetch("https://reece1919.github.io/gaia/plants.json",
      {signal:AbortSignal.timeout(6000),headers:{"Accept":"application/json"}});
    if(!result.ok) return new Map();
    const data=await result.json();
    return new Map((data.plants || []).map(p=>[String(p.id),{
      name:sliceText(p.name,90), species:sliceText(p.species,120),
      status:sliceText(p.status,70),
      light:sliceText(p.cardCare?.light,70),soil:sliceText(p.cardCare?.soil,70),
      // Original GitHub card images are historical reference photos, not new uploads.
      referenceFile:typeof p.photo==="string"&&
        /^[a-z0-9][a-z0-9._-]{0,180}\.(jpg|jpeg|png|webp)$/i.test(p.photo)?p.photo:null
    }]));
  } catch (_) { return new Map(); }
}
function cleanAnalysis(raw,mode) {
  if(!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("Invalid vision assessment");
  const summary = sliceText(raw.summary,1400);
  if(summary.length < 12) throw Error("Vision assessment omitted its explanation");
  const allowed = mode==="baseline"
    ? ["baseline","uncertain"]
    : ["improving","stable","declining","uncertain"];
  const condition = allowed.includes(raw.condition) ? raw.condition : "uncertain";
  const findings = (Array.isArray(raw.observations) ? raw.observations : [])
    .filter(v=>typeof v==="string" && v.trim()).slice(0,5).map(v=>({kind:"observation",text:sliceText(v,320)}));
  const actions = (Array.isArray(raw.recommendations) ? raw.recommendations : [])
    .filter(v=>v && typeof v==="object" && !Array.isArray(v) && typeof v.action==="string")
    .slice(0,2).map(v=>({
      kind:"care", text:sliceText(v.action,180),
      reason:sliceText(v.reason,240),
      urgency:["soon","routine","monitor"].includes(v.urgency) ? v.urgency : "monitor"
    }));
  const confidence = Number.isFinite(Number(raw.confidence))
    ? Math.min(1,Math.max(0,Number(raw.confidence))) : null;
  return {
    summary, condition, confidence,
    findings:[{kind:"trend",text:mode==="baseline"?"Baseline only; no historical image available":condition},...findings,...actions],
    needsAttention: condition==="declining" || actions.some(v=>v.urgency==="soon")
  };
}
const referenceBase = "https://reece1919.github.io/gaia/";
async function downloadReference(filename) {
  if(typeof filename!=="string" ||
    !/^[a-z0-9][a-z0-9._-]{0,180}\.(jpg|jpeg|png|webp)$/i.test(filename))
    throw Error("Invalid historical reference filename");
  const url=referenceBase+encodeURIComponent(filename);
  const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error("Historical GAIA image unavailable ("+response.status+")");
  const finalUrl=new URL(response.url);
  if(finalUrl.origin!=="https://reece1919.github.io" ||
    !finalUrl.pathname.startsWith("/gaia/"))
    throw Error("Historical image redirected outside GAIA");
  const type=(response.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
  if(!["image/jpeg","image/png","image/webp"].includes(type))
    throw Error("Historical GAIA reference is not a supported image");
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(!bytes.length||bytes.length>8_388_608)
    throw Error("Historical image empty or exceeds size limit");
  return {bytes,mime:type};
}
async function performVision(admin, owner, latest, earlier, plantInfo, events, apiKey) {
  const photos = earlier ? [earlier,latest] : [latest];
  const content = [{
    type:"text",
    text:"The following photos depict ONE plant, ordered OLDEST then NEWEST. Compare only if two images are attached. " +
      "Plant metadata (may be incomplete): " + JSON.stringify(plantInfo || {}) + ". " +
      "Photo dates: "+JSON.stringify(photos.map(p=>({taken_on:p.taken_on,caption:p.caption}))) + ". " +
      "Logged care actions, for context only: "+JSON.stringify(events.slice(0,8)) + "."
  }];
  for(const p of photos){
    let bytes,mime="image/jpeg";
    if(p.source==="gaia_repository_reference"){
      // Only allow image filenames listed in plants.json; no arbitrary URL fetching.
      if(p.file!==plantInfo?.referenceFile)throw Error("Unrecognized historical reference");
      ({bytes,mime}=await downloadReference(p.file));
    } else {
      if(!validUuid(p.id) || !p.object_path.startsWith(owner+"/"+p.plant_id+"/"))
        throw Error("Private photo owner or plant path mismatch");
      const {data:blob,error} = await admin.storage.from(bucket).download(p.object_path);
      if(error || !blob) throw Error("Stored photo could not be read");
      if(blob.size > 8_388_608) throw Error("Stored photo exceeds allowed size");
      bytes=new Uint8Array(await blob.arrayBuffer());
    }
    content.push({type:"image_url",image_url:{
      url:"data:"+mime+";base64,"+toBase64(bytes),detail:"low"
    }});
  }
  const system = "You are GAIA, a careful plant-care assistant analyzing real photo pixels. " +
    "Never pretend a comparison was performed if only one image was provided. " +
    "Distinguish visible changes from uncertain interpretation; avoid confident diagnoses of pests, disease, moisture, or roots from a distant photo. " +
    "Lighting, angle, and camera exposure may differ. Do not infer unlogged care events. " +
    "Care notes and metadata are context, not photographic observations. " +
    "Propose a maximum of two practical, species-aware care CHECKS or recommendations. " +
    "Do not instruct watering, fertilizer, pesticide, or repotting without an appropriate physical check. " +
    "Return only a JSON object with keys summary (string), condition " +
    "(one of baseline,improving,stable,declining,uncertain), observations (array of concise strings), " +
    "recommendations (array of {action,reason,urgency} where urgency is soon,routine,monitor), confidence (0 to 1).";
  const response=await fetch("https://api.openai.com/v1/chat/completions",{
    method:"POST",
    headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},
    body:JSON.stringify({
      model:modelName,temperature:0.1,max_completion_tokens:750,
      response_format:{type:"json_object"},
      messages:[{role:"system",content:system},{role:"user",content}]
    }),
    signal:AbortSignal.timeout(75000)
  });
  if(!response.ok) throw Error("Vision provider error ("+response.status+")");
  const json=await response.json();
  let parsed;
  try { parsed=JSON.parse(json.choices?.[0]?.message?.content || ""); }
  catch(_) { throw Error("Vision provider returned invalid JSON"); }
  return cleanAnalysis(parsed,earlier ? "comparison" : "baseline");
}
async function reviewOwner(admin, owner, plantCatalog, apiKey, force=false) {
  const {data:photos,error:lookupError}=await admin.from("plant_photos")
    .select("id,user_id,plant_id,object_path,taken_on,created_at,caption,analysis_status,analysis_started_at")
    .eq("user_id",owner).order("taken_on",{ascending:false})
    .order("created_at",{ascending:false}).limit(1200);
  if(lookupError) throw Error("Photo index lookup failed");
  const grouped = new Map();
  for(const p of photos || []) {
    if(!grouped.has(p.plant_id)) grouped.set(p.plant_id,[]);
    grouped.get(p.plant_id).push(p);
  }
  const {data:care,error:careError}=await admin.from("plant_care_events")
    .select("plant_id,action_type,happened_on,note").eq("user_id",owner)
    .order("happened_on",{ascending:false}).limit(400);
  if(careError) throw Error("Care history lookup failed");
  const candidates=[];
  for(const [plantId,history] of grouped) {
    const latest=history[0];
    if(!force && latest.analysis_status!=="pending"){
      const expired=latest.analysis_status==="processing" &&
        latest.analysis_started_at &&
        Date.now()-new Date(latest.analysis_started_at).getTime()>45*60*1000;
      if(!expired) continue;
      const reset=await admin.from("plant_photos").update({analysis_status:"pending",analysis_started_at:null})
        .eq("id",latest.id).eq("user_id",owner).eq("analysis_status","processing");
      if(reset.error) continue;
    }
    const referenceFile=plantCatalog.get(plantId)?.referenceFile;
    const earlier=history[1]|| (referenceFile ? {
      source:"gaia_repository_reference",file:referenceFile,taken_on:null,
      caption:"Original GAIA plant-card image (actual photo date unknown)"
    }:null);
    candidates.push({plantId,latest,earlier});
  }
  const picked=candidates.slice(0,runLimit);
  const successes=[],failures=[];
  // Two reviews concurrently keeps the worker responsive and caps parallel API spend.
  for(let start=0;start<picked.length;start+=2){
    const batch=picked.slice(start,start+2);
    const results=await Promise.all(batch.map(async item=>{
      const {plantId,latest,earlier}=item;
      const claim=await admin.from("plant_photos")
        .update({analysis_status:"processing",analysis_started_at:new Date().toISOString()})
        .eq("id",latest.id).eq("user_id",owner)
        .eq("analysis_status",force?latest.analysis_status:"pending").select("id");
      if(claim.error || !claim.data?.length) return {kind:"skip",plantId};
      try {
        const result=await performVision(admin,owner,latest,earlier,
          plantCatalog.get(plantId)||null,(care||[]).filter(e=>e.plant_id===plantId),apiKey);
        const {error:saveError}=await admin.from("plant_photos").update({
          analysis_status:result.needsAttention?"needs_attention":"reviewed",
          analysis_summary:result.summary,
          analysis_findings:[
            ...result.findings,
            ...(earlier?[{kind:"comparison_source",
              text:earlier.source==="gaia_repository_reference"?
                "Original GAIA reference: "+earlier.file:"Earlier private photo: "+earlier.id}]:[])
          ],analysis_confidence:result.confidence,
          analysis_source:modelSource,analysis_started_at:null,
          analyzed_at:new Date().toISOString()
        }).eq("id",latest.id).eq("user_id",owner).eq("analysis_status","processing");
        if(saveError) throw Error("Could not save visual assessment");
        return {kind:"ok",plantId,mode:earlier?"comparison":"baseline",condition:result.condition};
      } catch(e) {
        // Never claim an image was visually reviewed if the vision or storage step failed.
        await admin.from("plant_photos").update({analysis_status:"pending",analysis_started_at:null})
          .eq("id",latest.id).eq("user_id",owner).eq("analysis_status","processing");
        return {kind:"failed",plantId,error:e instanceof Error?e.message:"Unknown visual analysis error"};
      }
    }));
    for(const result of results){
      if(result.kind==="ok")successes.push(result);
      else if(result.kind==="failed")failures.push(result);
    }
  }
  return {
    inspected:successes.length,
    comparisons:successes.filter(r=>r.mode==="comparison").length,
    baselines:successes.filter(r=>r.mode==="baseline").length,
    needs_attention:successes.filter(r=>r.condition==="declining").length,
    remaining:Math.max(0,candidates.length-picked.length),
    failures
  };
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(req.method!=="POST")return reply({error:"Method not allowed"},405);
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY");
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!service)return reply({error:"GAIA service configuration unavailable"},503);
  const admin=createClient(url,service,{auth:{persistSession:false}});
  const cronToken=req.headers.get("x-gaia-cron-auth");
  let owners=[],isCron=false;
  if(cronToken!==null){
    const {data, error}=await admin.rpc("gaia_verify_photo_cron",{candidate:cronToken});
    if(error || data!==true)return reply({error:"Unauthorized"},401);
    isCron=true;
    const {data:pending,error:pendingError}=await admin.from("plant_photos")
      .select("user_id").in("analysis_status",["pending","processing"]).limit(1000);
    if(pendingError)return reply({error:"Photo queue unavailable"},500);
    owners=[...new Set((pending||[]).map(v=>v.user_id))].slice(0,8);
  } else {
    const bearer=req.headers.get("authorization")||"";
    if(!/^Bearer\s+\S+$/i.test(bearer))return reply({error:"Sign in required"},401);
    const token=bearer.replace(/^Bearer\s+/i,"");
    const client=createClient(url,anon,{auth:{persistSession:false}});
    const {data:identity,error}=await client.auth.getUser(token);
    const claims=jwtClaims(token);
    if(error||!identity.user||claims?.sub!==identity.user.id)
      return reply({error:"Sign in required"},401);
    if(claims.aal!=="aal2")return reply({error:"Verify your authenticator to review private photos"},403);
    owners=[identity.user.id];
  }
  let body={};
  try{body=await req.json();}catch(_){/* empty body */}
  // Safe audit breadcrumbs: log action and completion, never credentials or photo bytes.
  if(isCron && (body?.action==="read_photo" || body?.action==="save_review"))
    console.info("gaia-scheduled-review requested",body.action);
  // Scheduled ChatGPT can request a single image through the database's
  // Vault-authenticated invocation. No public bucket or lasting URL is created.
  if(isCron && body?.action==="read_photo"){
    const id=body.photo_id;
    if(!validUuid(id))return reply({error:"Invalid photo ID"},400);
    const {data:photo,error:readError}=await admin.from("plant_photos")
      .select("id,user_id,plant_id,object_path,taken_on,caption")
      .eq("id",id).maybeSingle();
    if(readError||!photo)return reply({error:"Photo not found"},404);
    const {data:identity,error:identityError}=await admin.auth.admin.getUserById(photo.user_id);
    if(identityError||identity?.user?.email?.toLowerCase()!=="reece1919@gmail.com")
      return reply({error:"Photo owner is not authorized for this review"},403);
    if(!photo.object_path.startsWith(photo.user_id+"/"+photo.plant_id+"/"))
      return reply({error:"Photo storage path mismatch"},403);
    const {data:blob,error:downloadError}=await admin.storage.from(bucket).download(photo.object_path);
    if(downloadError||!blob)return reply({error:"Private photo unavailable"},502);
    if(!blob.size||blob.size>8_388_608)return reply({error:"Photo size unsupported"},413);
    const imageBytes=new Uint8Array(await blob.arrayBuffer());
    console.info("gaia-scheduled-review read_complete",photo.plant_id,imageBytes.length);
    return reply({photo_id:photo.id,plant_id:photo.plant_id,taken_on:photo.taken_on,
      caption:photo.caption,mime:"image/jpeg",
      image_base64:toBase64(imageBytes)});
  }
  // Narrow write-back route for scheduled ChatGPT vision reviews. The request is
  // authenticated by Vault and never accepts a target owner, storage URL, or SQL.
  if((isCron || owners.length===1) && body?.action==="save_review"){
    const photoId=body.photo_id;
    const review=body.review;
    if(!validUuid(photoId)||!review||typeof review!=="object"||Array.isArray(review))
      return reply({error:"Invalid photo review"},400);
    const {data:photo,error:photoError}=await admin.from("plant_photos")
      .select("id,user_id,plant_id,analysis_status,taken_on,created_at")
      .eq("id",photoId).maybeSingle();
    if(photoError||!photo)return reply({error:"Photo not found"},404);
    const {data:identity,error:identityError}=await admin.auth.admin.getUserById(photo.user_id);
    if(identityError||identity?.user?.email?.toLowerCase()!=="reece1919@gmail.com")
      return reply({error:"Photo owner not authorized"},403);
    // Interactive GAIA imports require an AAL2 verified session and exact owner match.
    if(!isCron && photo.user_id!==owners[0])
      return reply({error:"Photo is not owned by this signed-in account"},403);
    if(photo.analysis_status!=="pending")return reply({error:"Latest photo is no longer pending"},409);
    const {data:history,error:historyError}=await admin.from("plant_photos")
      .select("id,taken_on,created_at").eq("user_id",photo.user_id).eq("plant_id",photo.plant_id)
      .order("taken_on",{ascending:false}).order("created_at",{ascending:false}).limit(3);
    if(historyError||history?.[0]?.id!==photoId)
      return reply({error:"Only the latest photo can receive the current review"},409);
    const validCondition=["improving","stable","declining","uncertain"].includes(review.condition);
    const summary=typeof review.summary==="string"?review.summary.trim():"";
    const observations=review.observations;
    const recommendations=review.recommendations;
    const confidence=review.confidence;
    if(!validCondition||summary.length<20||summary.length>1400||
       !Array.isArray(observations)||observations.length<1||observations.length>5||
       observations.some(x=>typeof x!=="string"||x.length<5||x.length>320)||
       !Array.isArray(recommendations)||recommendations.length>2||
       recommendations.some(x=>!x||typeof x.action!=="string"||x.action.length<5||
         x.action.length>200||typeof x.reason!=="string"||x.reason.length>260||
         !["soon","routine","monitor"].includes(x.urgency))||
       typeof confidence!=="number"||!Number.isFinite(confidence)||confidence<0||confidence>1)
      return reply({error:"Assessment failed validation"},400);
    const previousId=history[1]?.id||null;
    const previousSource=review.previous_source;
    if(previousId){
      if(previousSource!=="private"||review.previous_photo_id!==previousId)
        return reply({error:"Incorrect earlier private photo"},409);
    }else{
      if(previousSource!=="reference")return reply({error:"Expected original GAIA reference"},409);
      const plantCatalog=await catalog();
      if(!plantCatalog.get(photo.plant_id)?.referenceFile||
        review.reference_file!==plantCatalog.get(photo.plant_id)?.referenceFile)
        return reply({error:"Reference photo does not match plant catalog"},409);
    }
    const findings=[
      {kind:"trend",text:review.condition},
      ...observations.map(text=>({kind:"observation",text:text.trim()})),
      ...recommendations.map(x=>({kind:"care",text:x.action.trim(),
        reason:x.reason.trim(),urgency:x.urgency})),
      {kind:"comparison_source",text:previousId?
        "Earlier private photo: "+previousId+" versus newer private photo: "+photoId:
        "Original GAIA image: "+review.reference_file+" versus newer private photo: "+photoId}
    ];
    const needsAttention=review.condition==="declining"||
      recommendations.some(x=>x.urgency==="soon");
    const saved=await admin.from("plant_photos").update({
      analysis_status:needsAttention?"needs_attention":"reviewed",
      analysis_summary:summary,
      analysis_findings:findings,
      analysis_confidence:confidence,
      analysis_source:"chatgpt-gaia-scheduled-vision",
      analyzed_at:new Date().toISOString(),analysis_started_at:null
    }).eq("id",photoId).eq("user_id",photo.user_id).eq("plant_id",photo.plant_id)
      .eq("analysis_status","pending")
      .select("id,plant_id,analysis_status,analysis_confidence,analyzed_at");
    if(saved.error)return reply({error:"Could not save photo review"},500);
    if(saved.data?.length!==1)return reply({error:"Review changed or not saved"},409);
    // Recommendations belong in the GAIA approval queue, NEVER completed care history.
    // A normalized action already proposed for this owner+plant is not proposed again.
    let taskProposals={created:0,skipped:0,failed:0};
    if(recommendations.length){
      try{
        const old=await admin.from("gaia_task_proposals")
          .select("title,status").eq("user_id",photo.user_id)
          .eq("plant_id",photo.plant_id).limit(400);
        if(old.error)throw old.error;
        const canonical=t=>String(t||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
        const priorTitles=new Set((old.data||[]).map(t=>canonical(t.title)));
        for(let idx=0;idx<recommendations.length;idx++){
          const rec=recommendations[idx];
          const action=rec.action.trim();
          const title=action.slice(0,160);
          const key=canonical(title);
          if(!key||priorTitles.has(key)){taskProposals.skipped++;continue;}
          const rationale=(rec.reason.trim()+
            " · Photo review urgency: "+rec.urgency+
            " · Visual assessment only; inspect the plant before acting.").slice(0,950);
          const insert=await admin.from("gaia_task_proposals").upsert({
            user_id:photo.user_id,plant_id:photo.plant_id,
            kind:"routine_check",title,rationale,due_on:null,
            confidence,status:"suggested",
            source_key:"gaia-photo-review:"+photo.id+":"+idx
          },{onConflict:"user_id,source_key",ignoreDuplicates:true})
            .select("id");
          if(insert.error){taskProposals.failed++;continue;}
          taskProposals.created+=(insert.data||[]).length;
          taskProposals.skipped+=insert.data?.length?0:1;
          priorTitles.add(key);
        }
      }catch(e){
        taskProposals.failed=recommendations.length;
        console.error("gaia-review recommendation queue unavailable");
      }
    }
    console.info(isCron?"gaia-scheduled-review save_complete":"gaia-manual-review save_complete",photo.plant_id);
    return reply({status:"saved",photo:saved.data[0],task_proposals:taskProposals});
  }
  const apiKey=Deno.env.get("OPENAI_API_KEY");
  if(body?.dry_run===true){
    let photo_access="no_saved_photos";
    if(owners.length){
      const {data:list,error:lookupError}=await admin.from("plant_photos")
        .select("plant_id,object_path").eq("user_id",owners[0]).limit(1);
      if(lookupError)photo_access="index_unavailable";
      else if(list?.length){
        const obj=list[0];
        if(!obj.object_path.startsWith(owners[0]+"/"+obj.plant_id+"/"))
          photo_access="owner_path_mismatch";
        else {
          const {data:blob,error:downloadError}=await admin.storage.from(bucket).download(obj.object_path);
          photo_access=!downloadError&&blob?.size>0?"private_image_verified":"download_failed";
        }
      }
    }
    // Validate the OTHER source of history, not only private Supabase storage.
    const known=await catalog();
    let previous_private=0,previous_reference=0,missing_reference=0;
    if(owners.length){
      const {data:photos}=await admin.from("plant_photos")
        .select("plant_id").eq("user_id",owners[0]).limit(1000);
      const counts=new Map();
      for(const p of photos||[])counts.set(p.plant_id,(counts.get(p.plant_id)||0)+1);
      for(const [id,count] of counts){
        if(count>=2)previous_private++;
        else if(known.get(id)?.referenceFile)previous_reference++;
        else missing_reference++;
      }
    }
    const testFile=[...known.values()].find(p=>p.referenceFile)?.referenceFile;
    let reference_access="no_reference";
    if(testFile){
      try{await downloadReference(testFile);reference_access="gaia_original_verified";}
      catch(e){reference_access=e instanceof Error?e.message:"Reference download failed";}
    }
    return reply({status:apiKey?"ready":"vision_not_configured",
      pending_accounts:owners.length,provider:apiKey?modelSource:null,photo_access,
      historical_reference_access:reference_access,
      history_mapping:{private_pairs:previous_private,github_reference_pairs:previous_reference,missing:missing_reference}});
  }
  if(!owners.length)return reply({status:"no_pending_photos",reviewed:0,inspected:0,comparisons:0,baselines:0});
  if(!apiKey) return reply({status:"vision_not_configured",
    error:"Automated visual comparison requires a configured vision service; stored photos remain pending."},
    isCron?200:503);
  const force=!isCron && body?.force===true;
  const plants=await catalog(),results=[];
  for(const owner of owners){
    try {results.push(await reviewOwner(admin,owner,plants,apiKey,force));}
    catch(e){results.push({inspected:0,comparisons:0,baselines:0,remaining:0,
      failures:[{error:e instanceof Error?e.message:"Review unavailable"}]});}
  }
  const output={
    status:"complete",reviewed:results.reduce((n,v)=>n+v.inspected,0),
    comparisons:results.reduce((n,v)=>n+v.comparisons,0),
    baselines:results.reduce((n,v)=>n+v.baselines,0),
    remaining:results.reduce((n,v)=>n+v.remaining,0),
    failures:results.flatMap(v=>v.failures).slice(0,20)
  };
  return reply(output,output.failures.length&&!output.reviewed?502:200);
});
