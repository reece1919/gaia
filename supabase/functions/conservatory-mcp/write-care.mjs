import {validateCareEntry} from "./validation.mjs";

/* All database access uses the already-verified user's RLS-scoped Supabase client.
 * This module never accepts user_id from the MCP caller and never uses service keys.
 */
export async function saveVerifiedCareEvent({entry, today, userId, catalog, db}) {
  if (!userId || typeof userId !== "string") throw new Error("Signed-in owner identity is required.");
  const checked = validateCareEntry(entry, today);
  if (checked.error || !checked.value) throw new Error(checked.error || "Invalid care event.");
  const event = checked.value;
  if (!Array.isArray(catalog) || !catalog.some(p => String(p.id) === event.plant_id))
    throw new Error("Unknown plant ID; search the catalog before recording.");

  // Always derive user_id from the authenticated session.
  const {error: insertError} = await db.from("plant_care_events")
    .insert({...event, user_id: userId});
  if (insertError && insertError.code !== "23505")
    throw new Error("The care event could not be saved under the current account permissions.");

  // Idempotent retry: a repeated UUID only succeeds if it belongs to this
  // owner's identical, previously saved record.
  const {data: saved, error: readError} = await db.from("plant_care_events")
    .select("id,plant_id,action_type,happened_on,note,created_at")
    .eq("id", event.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (readError || !saved)
    throw new Error("The event could not be verified in your private care journal.");
  if (saved.plant_id !== event.plant_id ||
      saved.action_type !== event.action_type ||
      saved.happened_on !== event.happened_on ||
      saved.note !== event.note)
    throw new Error("This event ID is already associated with a different record. Use a new ID for a distinct action.");

  return {saved:true,verified:true,already_recorded:!!insertError,event:saved};
}
