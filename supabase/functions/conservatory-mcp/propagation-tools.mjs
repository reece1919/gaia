/* Conversational Nursery operations. Existing Supabase tables remain authoritative.
 * Every query uses the OAuth caller's RLS-scoped client and verified user ID.
 * Propagation retains the existing AAL2 policies; this module never bypasses RLS.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLANT=/^\d{2,3}$/;
export const METHODS=Object.freeze(["soil","water","sphagnum","perlite","division","other"]);
export const STAGES=Object.freeze(["cutting","rooting","establishing","established","lost"]);
export const DESTINATIONS=Object.freeze(["undecided","keep","gift","trade","return"]);
const BATCH_FIELDS="id,label,parent_plant_id,method,started_on,notes,created_at,updated_at";
const CUTTING_FIELDS="id,batch_id,nickname,stage,destination,rooted_on,potted_on,established_on,linked_plant_id,notes,created_at,updated_at";

function requiredOwner(userId) {
  if(typeof userId!=="string"||!userId) throw Error("A verified Conservatory owner is required.");
}
function uuid(id) {
  if(typeof id!=="string"||!UUID.test(id)) throw Error("A stable UUID is required for idempotent writes.");
  return id;
}
function string(value,max,label,{required=false}={}) {
  if(typeof value!=="string"||value.length>max) throw Error(label+" must be text up to "+max+" characters.");
  const v=value.trim();
  if(required&&!v) throw Error(label+" is required.");
  return v;
}
function date(value,today,label) {
  if(value===null) return null;
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw Error("Invalid "+label+" date.");
  const parsed=new Date(value+"T12:00:00Z");
  if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==value||value>today)
    throw Error(label+" must be a real date no later than today.");
  return value;
}
function catalogId(value,catalog,{nullable=false}={}) {
  if(value===null&&nullable) return null;
  if(typeof value!=="string"||!PLANT.test(value)) throw Error("Invalid catalog plant ID.");
  if(!Array.isArray(catalog)||!catalog.some(p=>String(p.id)===value))
    throw Error("Plant ID is not in the current Conservatory catalog.");
  return value;
}
function optional(input,key,validator,output) {
  if(Object.hasOwn(input,key)&&input[key]!==undefined) output[key]=validator(input[key]);
}
function equalFields(row,expected) {
  return !!row && Object.entries(expected).every(([key,value])=>row[key]===value);
}
async function readOne(db,table,id,userId,fields) {
  const r=await db.from(table).select(fields).eq("id",id).eq("user_id",userId).maybeSingle();
  if(r.error) throw Error("Nursery read-back failed. No write can be confirmed.");
  return r.data;
}
async function insertAndVerify(db,table,row,userId,fields) {
  const r=await db.from(table).insert({...row,user_id:userId});
  if(r.error && r.error.code!=="23505")
    throw Error("Nursery write failed. Check your authenticated account and MFA.");
  const stored=await readOne(db,table,row.id,userId,fields);
  if(!equalFields(stored,row))
    throw Error("Nursery write verification failed or the supplied UUID already belongs to different data.");
  return {saved:true,verified:true,already_recorded:!!r.error,record:stored};
}

export async function getPropagationNursery({db,userId,limit=30}) {
  requiredOwner(userId);
  if(!Number.isInteger(limit)||limit<1||limit>100) throw Error("Limit must be 1–100.");
  const b=await db.from("gaia_propagation_batches")
    .select(BATCH_FIELDS).eq("user_id",userId)
    .order("created_at",{ascending:false}).limit(limit);
  if(b.error) throw Error("Cannot read private propagation batches.");
  const batches=b.data||[];
  if(!batches.length) return {batches:[],cuttings:[],has_more_batches:false};
  const ids=batches.map(x=>x.id);
  const c=await db.from("gaia_propagation_cuttings")
    .select(CUTTING_FIELDS).eq("user_id",userId).in("batch_id",ids)
    .order("created_at",{ascending:true}).limit(1000);
  if(c.error) throw Error("Cannot read private propagation cuttings.");
  return {batches,cuttings:c.data||[],cuttings_truncated:(c.data||[]).length===1000,
    has_more_batches:batches.length===limit};
}

export async function createPropagationBatch({db,userId,catalog,today,entry}) {
  requiredOwner(userId);
  if(!entry||typeof entry!=="object"||Array.isArray(entry)) throw Error("Expected one propagation batch.");
  const row={
    id:uuid(entry.id),
    label:string(entry.label,100,"Batch label",{required:true}),
    parent_plant_id:entry.parent_plant_id==null?null:catalogId(entry.parent_plant_id,catalog),
    method:entry.method??"soil",
    started_on:entry.started_on==null?null:date(entry.started_on,today,"Start"),
    notes:string(entry.notes??"",1500,"Batch notes")
  };
  if(!METHODS.includes(row.method)) throw Error("Unsupported propagation method.");
  return insertAndVerify(db,"gaia_propagation_batches",row,userId,BATCH_FIELDS);
}

export async function createPropagationCutting({db,userId,entry}) {
  requiredOwner(userId);
  if(!entry||typeof entry!=="object"||Array.isArray(entry)) throw Error("Expected one cutting.");
  const row={
    id:uuid(entry.id),
    batch_id:uuid(entry.batch_id),
    nickname:string(entry.nickname??"",100,"Cutting nickname"),
    stage:entry.stage??"cutting",
    destination:entry.destination??"undecided",
    notes:string(entry.notes??"",1500,"Cutting notes")
  };
  if(!STAGES.includes(row.stage)||!DESTINATIONS.includes(row.destination))
    throw Error("Unsupported cutting stage or destination.");
  const batch=await readOne(db,"gaia_propagation_batches",row.batch_id,userId,"id");
  if(!batch) throw Error("That propagation batch is not visible to your signed-in account.");
  // Other fields use the existing database defaults, not a second ledger.
  const inserted=await db.from("gaia_propagation_cuttings").insert({...row,user_id:userId});
  if(inserted.error&&inserted.error.code!=="23505")
    throw Error("Could not save cutting under the current account and MFA permissions.");
  const saved=await readOne(db,"gaia_propagation_cuttings",row.id,userId,CUTTING_FIELDS);
  if(!equalFields(saved,row))
    throw Error("Cutting verification failed or the supplied UUID already belongs to different data.");
  return {saved:true,verified:true,already_recorded:!!inserted.error,record:saved};
}

export async function updatePropagationCutting({db,userId,catalog,today,entry}) {
  requiredOwner(userId);
  if(!entry||typeof entry!=="object"||Array.isArray(entry)) throw Error("Expected a cutting update.");
  const id=uuid(entry.id);
  if(typeof entry.expected_updated_at!=="string"||!entry.expected_updated_at)
    throw Error("Read the cutting first and provide its updated_at value.");
  const patch={};
  optional(entry,"nickname",x=>string(x,100,"Cutting nickname"),patch);
  optional(entry,"notes",x=>string(x,1500,"Cutting notes"),patch);
  optional(entry,"stage",x=>{if(!STAGES.includes(x))throw Error("Invalid cutting stage.");return x;},patch);
  optional(entry,"destination",x=>{if(!DESTINATIONS.includes(x))throw Error("Invalid cutting destination.");return x;},patch);
  for(const key of ["rooted_on","potted_on","established_on"])
    optional(entry,key,x=>date(x,today,key),patch);
  optional(entry,"linked_plant_id",x=>catalogId(x,catalog,{nullable:true}),patch);
  if(!Object.keys(patch).length) throw Error("No changes were supplied.");
  // Optimistic concurrency avoids silently replacing newer edits made on the website.
  const current=await readOne(db,"gaia_propagation_cuttings",id,userId,CUTTING_FIELDS);
  if(!current) throw Error("Cutting not found under the signed-in owner.");
  if(current.updated_at!==entry.expected_updated_at) {
    if(equalFields(current,patch))
      return {saved:true,verified:true,already_recorded:true,record:current};
    throw Error("The cutting changed elsewhere. Read its latest details before updating.");
  }
  const updated=await db.from("gaia_propagation_cuttings")
    .update({...patch,updated_at:new Date().toISOString()})
    .eq("id",id).eq("user_id",userId)
    .eq("updated_at",entry.expected_updated_at)
    .select(CUTTING_FIELDS).maybeSingle();
  if(updated.error) throw Error("Cutting update failed. Check owner permissions and MFA.");
  if(!updated.data) throw Error("Concurrent change detected. Read the cutting again.");
  const verified=await readOne(db,"gaia_propagation_cuttings",id,userId,CUTTING_FIELDS);
  if(!equalFields(verified,patch))
    throw Error("Updated cutting could not be independently verified.");
  return {saved:true,verified:true,already_recorded:false,record:verified};
}
