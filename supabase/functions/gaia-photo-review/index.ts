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
      light:sliceText(p.cardCare?.light,70),soil:sliceText(p.cardCare?.soil,70)
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
    if(!validUuid(p.id) || !p.object_path.startsWith(owner+"/"+p.plant_id+"/"))
      throw Error("Private photo owner or plant path mismatch");
    const {data:blob,error} = await admin.storage.from(bucket).download(p.object_path);
    if(error || !blob) throw Error("Stored photo could not be read");
    if(blob.size > 8_388_608) throw Error("Stored photo exceeds allowed size");
    const buffer = new Uint8Array(await blob.arrayBuffer());
    content.push({type:"image_url",image_url:{
      url:"data:image/jpeg;base64,"+toBase64(buffer),detail:"low"
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
    candidates.push({plantId,latest,earlier:history[1]||null});
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
          analysis_findings:result.findings,analysis_confidence:result.confidence,
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
      .select("user_id").eq("analysis_status","pending").limit(1000);
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
  if(!owners.length)return reply({status:"no_pending_photos",reviewed:0,inspected:0,comparisons:0,baselines:0});
  const apiKey=Deno.env.get("OPENAI_API_KEY");
  if(!apiKey) return reply({status:"vision_not_configured",
    error:"Automated visual comparison requires a configured vision service; stored photos remain pending."},
    isCron?200:503);
  let force=false;
  if(!isCron){try{const body=await req.json();force=body?.force===true;}catch(_){/* empty body */}}
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
