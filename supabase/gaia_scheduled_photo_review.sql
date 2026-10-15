-- GAIA scheduled visual review (installed in Supabase on 2026-10-15).
-- Required before deploying the gaia-photo-review function.
ALTER TABLE public.plant_photos
  ADD COLUMN IF NOT EXISTS analysis_started_at timestamptz;
ALTER TABLE public.plant_photos
  DROP CONSTRAINT IF EXISTS gaia_photo_analysis_status_check;
ALTER TABLE public.plant_photos
  ADD CONSTRAINT gaia_photo_analysis_status_check
  CHECK (analysis_status IN ('pending','processing','reviewed','needs_attention','unavailable'));

COMMENT ON COLUMN public.plant_photos.analysis_started_at IS
  'In-progress worker claim; not evidence of an image actually being inspected.';

-- The worker runs server-side with service_role, never with a browser key.
GRANT SELECT, UPDATE ON public.plant_photos TO service_role;
GRANT SELECT ON public.plant_care_events TO service_role;

-- The Cron password is generated in the database and stays inside Vault.
SELECT vault.create_secret(
  replace(gen_random_uuid()::text,'-','') ||
  replace(gen_random_uuid()::text,'-',''),
  'gaia_photo_review_cron_auth',
  'Dedicated credential for scheduled GAIA photo reviews'
) WHERE NOT EXISTS (
  SELECT 1 FROM vault.secrets WHERE name='gaia_photo_review_cron_auth'
);

CREATE OR REPLACE FUNCTION public.gaia_verify_photo_cron(candidate text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $body$
  SELECT COALESCE(
    length(candidate) >= 32 AND candidate = (
      SELECT decrypted_secret FROM vault.decrypted_secrets
      WHERE name = 'gaia_photo_review_cron_auth' LIMIT 1
    ), false
  );
$body$;
REVOKE ALL ON FUNCTION public.gaia_verify_photo_cron(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gaia_verify_photo_cron(text)
  TO service_role;

-- Database Cron evaluates twice at UTC offsets around Pacific 8 AM.
-- The local-hour gate makes it run exactly once at 8 AM Pacific across DST.
SELECT cron.schedule(
  'gaia-private-photo-review-daily-8am-pacific',
  '0 15,16 * * *',
  $cron$
    SELECT net.http_post(
      url:='https://zdurujqwhxqrwbhwzzxg.supabase.co/functions/v1/gaia-photo-review',
      headers:=jsonb_build_object(
        'Content-Type','application/json',
        'x-gaia-cron-auth',
        (SELECT decrypted_secret FROM vault.decrypted_secrets
         WHERE name='gaia_photo_review_cron_auth')
      ),
      body:='{}'::jsonb,
      timeout_milliseconds:=120000
    ) AS request_id
    WHERE EXTRACT(hour FROM (now() AT TIME ZONE 'America/Los_Angeles'))=8;
  $cron$
);
