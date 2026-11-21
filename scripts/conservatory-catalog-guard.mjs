/* Catalog guard for ChatGPT-assisted Conservatory acquisitions and edits.
 * Main collection remains versioned plants.json; no second plant database.
 * This checks structural safety, not whether a photo, species or ownership
 * claim has been independently verified.
 */
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
const idPattern=/^\d{2,3}$/;
const isoDay=/^\d{4}-\d{2}-\d{2}$/;
const RETIRED_IDS=new Set(["65"]); // Archived Clone Force 17 group; never recycle.
const norm=x=>x.normalize("NFKC").trim().toLocaleLowerCase("en-US");

export function inspectCatalogChange(previous,next) {
  const errors=[],added=[],updated=[];
  if(!previous||!next||!Array.isArray(previous.plants)||!Array.isArray(next.plants))
    return {ok:false,errors:["Both catalogs must have a plants array."],added,updated};
  if(previous.schemaVersion!==next.schemaVersion)
    errors.push("Catalog schemaVersion changed unexpectedly.");
  const oldById=new Map(previous.plants.map(p=>[p.id,p]));
  const ids=new Set(),names=new Set();
  const maxPrior=Math.max(0,...previous.plants.map(p=>Number(p.id)||0));
  for(const p of next.plants){
    if(!p||typeof p!=="object"){errors.push("Non-object plant record.");continue;}
    if(typeof p.id!=="string"||!idPattern.test(p.id)){
      errors.push("Plant ID must be a 2–3 digit text value.");continue;
    }
    if(ids.has(p.id))errors.push("Duplicate plant ID #"+p.id);
    ids.add(p.id);
    if(RETIRED_IDS.has(p.id))errors.push("Retired catalog ID #"+p.id+" cannot be reused.");
    if(typeof p.name!=="string"||!p.name.trim()||p.name.length>100)
      errors.push("Plant #"+p.id+" needs a nonempty name up to 100 characters.");
    else {
      const name=norm(p.name);
      if(names.has(name))errors.push("Duplicate catalog name: "+p.name);
      names.add(name);
    }
    if(typeof p.species!=="string"||!p.species.trim())
      errors.push("Plant #"+p.id+" needs a species or explicit unconfirmed identity.");
    if(!Array.isArray(p.sections)||!p.history||!Array.isArray(p.history.facts)||!Array.isArray(p.history.notes))
      errors.push("Plant #"+p.id+" is missing its card sections or history structure.");
    if(!p.cardCare||typeof p.cardCare!=="object")
      errors.push("Plant #"+p.id+" is missing its cardCare profile.");
    if(typeof p.photo!=="string")
      errors.push("Plant #"+p.id+" must have a photo string (empty if none verified).");
    if(p.photo&&!p.photoAlt)
      errors.push("Plant #"+p.id+" needs photoAlt for its linked catalog cover.");
    if(oldById.has(p.id)){
      if(JSON.stringify(oldById.get(p.id))!==JSON.stringify(p))updated.push(p.id);
    }else{
      if(Number(p.id)<=maxPrior)
        errors.push("New plant #"+p.id+" reuses an old catalog ID range; allocate above #"+maxPrior+".");
      if(!isoDay.test(p.added??""))
        errors.push("New plant #"+p.id+" needs a YYYY-MM-DD acquisition date.");
      if(p.newAddition!==true)
        errors.push("New plant #"+p.id+" must be flagged as a new addition.");
      added.push({id:p.id,name:p.name});
    }
  }
  for(const p of previous.plants){
    if(!ids.has(p.id))errors.push("Existing plant #"+p.id+" ("+p.name+") was removed or renumbered; require separate explicit archival review.");
  }
  return {ok:errors.length===0,errors,added,updated};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==4){
    console.error("Usage: node scripts/conservatory-catalog-guard.mjs BASELINE_PLANTS_JSON PROPOSED_PLANTS_JSON");
    process.exitCode=2;
  }else{
    try{
      const result=inspectCatalogChange(
        JSON.parse(readFileSync(process.argv[2],"utf8")),
        JSON.parse(readFileSync(process.argv[3],"utf8"))
      );
      console.log(JSON.stringify(result,null,2));
      if(!result.ok) process.exitCode=1;
    }catch(e){console.error(e.message);process.exitCode=1;}
  }
}
