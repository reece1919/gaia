/* Canonical pure validation for an authenticated Conservatory care event. */
export const ACTIONS = Object.freeze(["prune","fertilize","repot","pest","bath","inspect","water","note"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateCareEntry(input, latestDate) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {error:"Expected one care entry object."};
  const {id,plant_id,action_type,happened_on,note=""}=input;
  if (typeof id!=="string" || !UUID.test(id)) return {error:"A stable UUID event ID is required."};
  if (typeof plant_id!=="string" || !/^\d{2,3}$/.test(plant_id)) return {error:"Invalid plant ID."};
  if (!ACTIONS.includes(action_type)) return {error:"Unrecognized care action."};
  if (typeof happened_on!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(happened_on)) return {error:"Invalid event date."};
  const d=new Date(happened_on+"T12:00:00Z");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0,10)!==happened_on || happened_on>latestDate)
    return {error:"Date must be a valid past or current date."};
  if (typeof note!=="string" || note.length>1000) return {error:"Note must be text no longer than 1,000 characters."};
  return {value:{id,plant_id,action_type,happened_on,note:note.trim()}};
}
