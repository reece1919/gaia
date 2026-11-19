/* Un-deployed, user-scoped care bridge. No service-role key; Supabase RLS is authoritative.
   This is a future connector endpoint, not yet used by the web form or ChatGPT. */
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { validateCareEntry } from "./validation.mjs";

const allowedOrigin="https://reece1919.github.io";
const baseHeaders={"content-type":"application/json","cache-control":"no-store"};
const cols="id,user_id,plant_id,action_type,happened_on,note,created_at";
function respond(body:unknown,status=200,origin=""){
  const headers:Record<string,string>={...baseHeaders};
  if(origin===allowedOrigin)headers["access-control-allow-origin"]=allowedOrigin;
  return new Response(JSON.stringify(body),{status,headers});
}
function claimsFromVerifiedToken(token:string){
  // Only used AFTER auth.getUser(token) has validated this JWT.
  try{
    const encoded=token.split(".")[1];
    const base=encoded.replace(/-/g,"+").replace(/_/g,"/");
    return JSON.parse(atob(base.padEnd(Math.ceil(base.length/4)*4,"=")));
  }catch{return null;}
}
function pacificToday(){
  const parts=new Intl.DateTimeFormat("en-US",{
    timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(new Date());
  const part=(type:string)=>parts.find(p=>p.type===type)?.value||"";
  return part("year")+"-"+part("month")+"-"+part("day");
}
async function knownPlant(id:string){
  const response=await fetch("https://reece1919.github.io/gaia/plants.json",{
    headers:{accept:"application/json"},signal:AbortSignal.timeout(6000)
  });
  if(!response.ok)throw new Error("Catalog is unavailable");
  const json=await response.json();
  return Array.isArray(json.plants) && json.plants.some((p:unknown)=>
    !!p && typeof p==="object" && String((p as {id?:string}).id)===id);
}
Deno.serve(async(req:Request)=>{
  const origin=req.headers.get("origin")||"";
  if(req.method==="OPTIONS"){
    if(origin!==allowedOrigin)return respond({error:"Origin not allowed"},403,origin);
    return new Response(null,{status:204,headers:{
      "access-control-allow-origin":allowedOrigin,
      "access-control-allow-headers":"authorization,apikey,content-type",
      "access-control-allow-methods":"POST,OPTIONS",
      "access-control-max-age":"3600"
    }});
  }
  if(req.method!=="POST")return respond({error:"Method not allowed"},405,origin);
  const authorization=req.headers.get("authorization")||"";
  if(!/^Bearer\s+\S+$/i.test(authorization))return respond({error:"Sign-in required"},401,origin);
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_ANON_KEY");
  if(!url||!key)return respond({error:"Service configuration unavailable"},503,origin);
  const client=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const token=authorization.replace(/^Bearer\s+/i,"");
  const {data,error:identityError}=await client.auth.getUser(token);
  if(identityError||!data.user)return respond({error:"Invalid user session"},401,origin);
  const claims=claimsFromVerifiedToken(token);
  if(claims?.sub!==data.user.id || claims?.aal!=="aal2")
    return respond({error:"Verified MFA session required"},403,origin);
  let body:unknown;
  try{
    const raw=await req.text();
    if(raw.length>4000)return respond({error:"Request too large"},413,origin);
    body=JSON.parse(raw);
  }catch{return respond({error:"Invalid JSON"},400,origin);}
  const checked=validateCareEntry(body,pacificToday());
  if(checked.error)return respond({error:checked.error},422,origin);
  const event=checked.value;
  if(!event)return respond({error:"Invalid care event"},422,origin);
  let validPlant=false;
  try{validPlant=await knownPlant(event.plant_id);}
  catch{return respond({error:"Plant catalog temporarily unavailable"},503,origin);}
  if(!validPlant)return respond({error:"Unknown plant ID"},422,origin);

  // Never accept user_id from the request. Use the authenticated owner only.
  const record={...event,user_id:data.user.id};
  const {error:insertError}=await client.from("plant_care_events").insert(record);
  if(insertError && insertError.code!=="23505")
    return respond({error:"Could not save care event under current access permissions"},403,origin);
  const {data:saved,error:readError}=await client.from("plant_care_events")
    .select(cols).eq("id",event.id).eq("user_id",data.user.id).maybeSingle();
  if(readError||!saved)return respond({error:"Event could not be verified"},502,origin);
  const equivalent=saved.plant_id===event.plant_id &&
    saved.action_type===event.action_type &&
    saved.happened_on===event.happened_on &&
    saved.note===event.note;
  if(!equivalent)return respond({error:"Event ID already belongs to a different care record"},409,origin);
  return respond({ok:true,event:saved,replayed:!!insertError},insertError?200:201,origin);
});
