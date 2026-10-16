# GAIA scheduled photo review — tested integration

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

## Interactive manual review from GAIA

The GAIA Photo Journal and GAIA Insights now include **Review with ChatGPT** and a **Review & Import** panel. This is not an external trigger for the ChatGPT scheduled task: it opens a new interactive ChatGPT conversation via the prefilled https://chatgpt.com/?q= URL. The user must send the prompt. It references the exact newest pending photo and prior image source, so images can be inspected via the connected tools without reuploading.

The reviewer should return a copyable JSON object with one pending photo_id and a review containing condition, summary, observations, at most two care recommendations, confidence, and exact previous_source+reference_file OR previous_source+previous_photo_id. The user pastes **only the JSON** into GAIA, previews it, and confirms approval.

For manual imports, GAIA uses the user's *authenticated, AAL2-verified* Supabase session to POST to the same owner-validated gaia-photo-review Edge Function with action="save_review". The function now permits either its Vault-authenticated cron identity OR that verified GAIA account; it does not expose service-role credentials to the browser. Both routes use the same strict latest-pending, single-owner, prior-image and field validation. The import panel verifies the persisted row before reporting success. A signed-out request is rejected with 401. An end-to-end import using the user's live AAL2 session still needs a browser test.

This manual workflow does not invoke OpenAI's paid API and does not claim to automatically execute the scheduled task. The automatic nightly workflow remains enabled but its unattended writeback may still be subject to connector safety checks.

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
