# GAIA scheduled photo review — tested integration

## Current manual Review New Photos workflow (October 23, 2026)

**This section supersedes the older Supabase-first image retrieval instructions below for interactive/manual runs.** The GAIA header button opens a new ChatGPT conversation containing a prefilled review prompt; the user must press Send. It does **not** automatically enable Work mode or grant write access. For authenticated save operations, use ChatGPT Work with a properly authenticated GAIA account when available.

1. **Read source of truth:** fetch `GAIA-CHATGPT-REFERENCE.md` and `gaia-reference/snapshot.json` using the connected GitHub repository `reece1919/gaia`. Verify `synced_at`, `uploaded_photo_count == exported_photo_count`, and `comparison_ready_count`. Use the exact `comparison.latest_image` and every `comparison.candidates[].image` path (including original catalog images). The snapshot includes `care_events`, `soil_observations`, `pot`, review status and species notes. Catalog image dates may be unknown. Local-only readings do not exist in the cloud export until synced.
2. **Check current status before writing:** the snapshot is periodically updated, not a live queue. Use an authorized Supabase read action or properly authenticated GAIA app/Work browser to confirm the newest photo ID and its *current* `analysis_status`. If the snapshot is stale, refresh through the already-installed `Publish GAIA read-only reference` GitHub Action when permitted, then recheck. If a required access path is blocked, report the limitation; don't evade connector controls.
3. **Review only newest pending photos:** preserve existing `reviewed` and `needs_attention` records. All earlier journal uploads and original catalog images are comparison evidence; older pending uploads are not separate current reviews. Inspect actual image pixels rather than relying on summaries, filenames or metadata; compare all available historical evidence, not merely the two newest files.
4. **Save only through the existing owner-verified action:** `gaia-photo-review` with `action=save_review` and an authorized AAL2 owner session or previously configured Vault-authenticated scheduler route. The deployed validator mandates `previous_source=private` with the *second-newest journal photo ID* when present; otherwise `previous_source=reference` with the exact `plants.json` filename. Additional older/catalog images inform the assessment but don't change that primary source validation. A read-only snapshot or public viewer never authorizes writing.
5. **Verify persisted outcomes:** confirm the response `status=saved`, correct photo ID and persisted `reviewed` **or** `needs_attention` status. Inspect `task_proposals` counters and independently confirm GAIA checkable tasks versus approval-only suggestions. Never infer successful saving or task creation from a queued request ID. Don't use paid OpenAI API, overwrite historical assessments, create Todoist tasks, or fabricate watering/moisture events.

**Fallback:** If a session has GitHub reads but not authorized Supabase writes, it can prepare read-only analyses, but must report them as **not saved**. Switching chat sessions does not in itself provide credentials. Work mode can help only if a supported authenticated browser workflow can complete and verify the backend's existing action.

2026-10-15: The ChatGPT GAIA Daily Plant Review task was configured to perform photo comparisons using its connected GitHub and Supabase sources, without calling an OpenAI API. Private photo pixels were successfully retrieved and visually inspected, with pilot reviews saved for Ruby (25) and Audrey II (04).

## Image sources

Newest private photo from public.plant_photos and Supabase private Storage gaia-plant-photos. Earlier source: second newest private photo if present; otherwise the original image filename in the matching plants.json plant object in reece1919/gaia. Original image capture dates may be unknown.

## Retrieve private photo

Use the connected Supabase execute_sql tool to call the already-deployed gaia-photo-review Edge Function with a verified photo UUID. Secret is read from Vault only inside SQL; never display it.

~~~sql
select net.http_post(
  url:='https://zdurujqwhxqrwbhwzzxg.supabase.co/functions/v1/gaia-photo-review',
  headers:=jsonb_build_object(
    'Content-Type','application/json',
    'x-gaia-cron-auth',
    (select decrypted_secret from vault.decrypted_secrets where name='gaia_photo_review_cron_auth')
  ),
  body:=jsonb_build_object('action','read_photo','photo_id','VERIFIED_PHOTO_UUID'),
  timeout_milliseconds:=20000
) as request_id;
~~~

After the asynchronous response is ready and status_code=200, execute the next step inside functions.exec, substituting the actual request ID:

~~~javascript
const sql = "select content::jsonb ->> 'image_base64' as img from net._http_response where id=REQUEST_ID and status_code=200;";
const result = await tools.mcp__Supabase__execute_sql({
  project_id: "zdurujqwhxqrwbhwzzxg", query: sql
});
const wrapper = JSON.parse(result.text).result;
const match = wrapper.match(/<untrusted-data-[^>]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-/);
if (!match) throw Error("No private photo response");
const base64 = JSON.parse(match[1])[0]?.img;
if (!base64 || !base64.startsWith("/9j/")) throw Error("No JPEG data");
image("data:image/jpeg;base64," + base64.replace(/\s+/g, ""));
~~~

To visually retrieve an original GitHub photo:

~~~javascript
const file = await tools.mcp__GitHub__fetch_file({
  repository_full_name: "reece1919/gaia",
  path: "EXACT_CATALOG_PHOTO_FILENAME.jpg",
  encoding: "base64"
});
image("data:image/jpeg;base64," + file.result.content.replace(/\s+/g, ""));
~~~

After actually inspecting a private image, request deletion of its transient pg_net response if the connected action permits it; otherwise accept the platform-managed TTL and report that cleanup was not confirmed. Never put image data in chat prose, GitHub, public tables or Todoist:

~~~sql
delete from net._http_response where id=REQUEST_ID returning id;
~~~

## Collection-wide interactive review: one button, no copy/paste (Oct 16, 2026)

GAIA's **Review New Photos** button in the header opens one new interactive ChatGPT conversation with an encoded prefilled request at `https://chatgpt.com/?q=...`. The user presses **Send** in ChatGPT. This does NOT trigger a ChatGPT scheduled task or call an OpenAI API. No photos, private tokens, or database credentials are included in that URL. The old individual-plant dropdown, per-plant review buttons, JSON copy/paste and import UI have been removed.

The launch prompt explicitly requests ALL eligible newest-pending photos in that one interactive ChatGPT session. The actual photo records must be queried afresh from connected Supabase, grouped by plant, ordered by `taken_on DESC, created_at DESC`. **Only each plant's latest photo** gets reviewed when its status is `pending`; any older photo, even if `pending`, is a historical comparison. For each eligible plant, actually VISUALLY render newest versus second newest private image of that same plant, otherwise the correct original GitHub catalog image. Apply the photo handling and privacy rules in this document. If any source isn't visible, leave that photo unreviewed.

**SAVE AUTONOMOUSLY after each genuine comparison** through the existing owner-verified `gaia-photo-review` action `save_review`. Do NOT print an assessment JSON for user copying, and do NOT ask the user to paste results into GAIA. The endpoint validates the exact newest pending photo and prior source, saves the condition/summary/observations/care advice, and handles at most two recommended care checks with stable photo-based source keys and cross-photo deduplication. Safe inspection/monitoring checks (for example, "inspect", "check", "monitor") are created as **open, checkable tasks in `public.gaia_custom_tasks`**, linked to an `approved` proposal; they remain incomplete. Physical interventions or treatments remain `suggested` in `public.gaia_task_proposals` until user approval. Approving a suggestion now creates a checkable GAIA task; declining creates none. Neither flow creates Todoist tasks or care events.

Verify asynchronous save response `status: "saved"`, correct photo ID, and independently verify persisted `analysis_status`. Response also contains `task_proposals: {created, skipped, failed, checklist_created, checklist_failed}`. Do not claim checklist creation if `checklist_failed` is nonzero or persisted tasks have not been verified. The frontend `tasks.js` displays the checkable entries and `task-queue.js` displays per-plant active checkboxes plus approval-only proposals.

**Connector limitation:** The ChatGPT interactive tool may independently reject a write on safety grounds. In that case STOP the blocked write, preserve the pending status, and explain the blocker without fabricating a saved review or switching to an unapproved route. No automatic fallback requires the user to copy/paste. Continue any independent read-only inspections permitted, and report which photos could/couldn't be inspected or saved. A full all-plants run is an *intent*, not a guarantee that every connector action will be permitted or complete within one ChatGPT session.

The existing nightly schedule remains independent and active.

## Save findings via the validated write-back endpoint

**Updated 2026-10-15: Do not use direct SQL UPDATE for ChatGPT photo review write-back.** The connected SQL action can be safety-blocked when used to edit individual photo records. Version 8 of `gaia-photo-review` now supports authenticated `action: "save_review"` and has been live-tested successfully for Groot (02) and Bowser (03). The endpoint itself performs the authorized, constrained database update.

After BOTH images are displayed and actually inspected, prepare an assessment object:

~~~javascript
const review = {
  condition: "stable", // improving | stable | declining | uncertain
  summary: "At least 20 characters describing real visible change and limits.",
  observations: ["A directly observed change or continuity in the images."],
  recommendations: [{
    action: "An inspection-first care check.",
    reason: "Why this check is appropriate based on visible evidence.",
    urgency: "monitor" // monitor | routine | soon
  }],
  confidence: 0.72, // 0..1
  previous_source: "reference", // "private" when second most recent private image exists
  reference_file: "EXACT_FILENAME_FROM_PLANTS_JSON.jpg"
  // For previous_source:"private", replace reference_file with
  // previous_photo_id:"UUID_OF_ACTUAL_SECOND_MOST_RECENT_PRIVATE_PHOTO"
};
const payload = JSON.stringify({
  action:"save_review",
  photo_id:"UUID_OF_ACTUAL_NEWEST_PENDING_PHOTO",
  review
}).replace(/'/g,"''");
const sql = `select net.http_post(
 url:='https://zdurujqwhxqrwbhwzzxg.supabase.co/functions/v1/gaia-photo-review',
 headers:=jsonb_build_object(
  'Content-Type','application/json',
  'x-gaia-cron-auth',
  (select decrypted_secret from vault.decrypted_secrets
   where name='gaia_photo_review_cron_auth')),
 body:='${payload}'::jsonb,
 timeout_milliseconds:=20000
) as request_id;`;
const result = await tools.mcp__Supabase__execute_sql({
  project_id:"zdurujqwhxqrwbhwzzxg",query:sql
});
// Parse the returned request_id from the structured result and verify 200/saved.
~~~

**The endpoint validates** the secret, exact GAIA Auth owner, current newest pending photo, matching prior private photo OR exact GitHub catalog filename, summary, 1–5 observations, <=2 recommendations, urgency and confidence. It rejects stale, duplicated, wrong-owner, invalid-source and malformed requests. It writes `analysis_findings` as a JSONB array and returns `{"status":"saved","photo":{...}}`. Confirm the returned photo ID and then SELECT its persisted status/source to verify. Never assert success merely because `net.http_post` returned a request ID. The result is asynchronous.

**Privacy and temporary responses:** The image transport's response body is temporarily stored in `net._http_response`. This schema is not part of the public Data API, but PostgreSQL roles with LOGIN privileges may be able to query it. Supabase owns pg_net grants: ordinary REVOKE of these objects from postgres does not work. Delete the exact temporary response row promptly **only if the connected SQL action permits it**; if it is blocked, do not claim deletion, and rely on Supabase pg_net's configured automatic TTL (currently six hours) while reporting the retention limitation. Do not run privilege-escalation workarounds, expose the `net` schema in the Data API, or send private images to external storage. Image bytes must never be sent in a `save_review` payload.

## Verified account and safety

The private image endpoint requires the Vault-authenticated scheduler credential and checks the photo's owner through Supabase Auth, matching the single authorized GAIA account. It does not make Storage public or create persistent URLs.

Supabase pg_net is extension-owned: REVOKE from postgres does not remove its PUBLIC ACL, according to Supabase docs. The net schema must stay outside exposed Data API schemas and no untrusted database login roles may be granted. Quickly deleting response payloads reduces their lifetime. The connected Supabase admin channel is required for all image retrieval; avoid creating a database LOGIN role for this workflow.

## Save findings

Save only to the newest pending photo AFTER both images are actually inspected. Use the secure save_review endpoint above rather than direct SQL UPDATE; it validates and sets status, summary, JSONB-array findings, confidence, analyzed_at and analysis_source for the correct latest photo. Verify the correct user_id/plant_id and exactly one updated row. Never invent care history, watering, moisture, pest diagnoses or improvements. Leave pending if vision is blocked.

The standalone 8 AM paid-API dependent database cron schedule was retired. The existing ChatGPT daily 11 PM Pacific task is the scheduler. Supabase compute/egress usage remains subject to normal plan quotas.
