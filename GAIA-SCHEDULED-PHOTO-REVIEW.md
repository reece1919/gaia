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

After actually inspecting a private image, always delete its transient pg_net response. Never put image data in chat prose, GitHub, public tables or Todoist:

~~~sql
delete from net._http_response where id=REQUEST_ID returning id;
~~~

## Verified account and safety

The private image endpoint requires the Vault-authenticated scheduler credential and checks the photo's owner through Supabase Auth, matching the single authorized GAIA account. It does not make Storage public or create persistent URLs.

Supabase pg_net is extension-owned: REVOKE from postgres does not remove its PUBLIC ACL, according to Supabase docs. The net schema must stay outside exposed Data API schemas and no untrusted database login roles may be granted. Quickly deleting response payloads reduces their lifetime. The connected Supabase admin channel is required for all image retrieval.

## Save findings

Save only to the newest photo, after both image pixels are inspected, using analysis_status reviewed / needs_attention, analysis_summary (<=1500 chars), analysis_findings (JSONB ARRAY with trend, observations, care recommendations and comparison source), analysis_confidence (0–1), analyzed_at, analysis_started_at=null, and analysis_source=chatgpt-gaia-scheduled-vision. Verify the correct user_id/plant_id and exactly one updated row. Never invent care history, watering, moisture, pest diagnoses or improvements. Leave pending if vision is blocked.

The standalone 8 AM paid-API dependent database cron schedule was retired. The existing ChatGPT daily 11 PM Pacific task is the scheduler. Supabase compute/egress usage remains subject to normal plan quotas.
