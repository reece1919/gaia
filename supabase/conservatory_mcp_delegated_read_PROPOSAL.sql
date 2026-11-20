-- PROPOSED ONLY. Do NOT execute against production without explicit approval.
-- 24-hour MFA-approved, read-only exception for ONE verified OAuth client.
-- Existing owner policies, AAL2 write protection, and care data are preserved.
BEGIN;

DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='plant_care_events'
      AND policyname='require_verified_totp_aal2'
      AND permissive='RESTRICTIVE' AND cmd='ALL'
  ) THEN
    RAISE EXCEPTION 'Expected existing restrictive AAL2 policy was not found; review before changing security.';
  END IF;
  IF (SELECT count(*) FROM pg_policies
      WHERE schemaname='public' AND tablename='plant_care_events'
        AND policyname IN ('care_select_own','care_insert_own','care_update_own','care_delete_own')) <> 4
  THEN
    RAISE EXCEPTION 'Expected four owner-only care policies not found; aborting.';
  END IF;
END;
$guard$;

CREATE TABLE public.conservatory_mcp_read_grants (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  oauth_client_id uuid NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, oauth_client_id),
  CONSTRAINT conservatory_read_grant_max_24h
    CHECK (expires_at > approved_at AND expires_at <= approved_at + interval '24 hours'),
  -- Only this verified ChatGPT OAuth app is eligible; no blanket client grants.
  CONSTRAINT conservatory_read_grant_client
    CHECK (oauth_client_id = 'dfd21ef1-7d12-4e41-8729-663abb5fc781'::uuid)
);

ALTER TABLE public.conservatory_mcp_read_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conservatory_mcp_read_grants FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.conservatory_mcp_read_grants TO authenticated;
GRANT INSERT (user_id, oauth_client_id, expires_at)
  ON public.conservatory_mcp_read_grants TO authenticated;

-- The owner may manage grants after MFA. An OAuth client can only inspect its
-- own unexpired grant, which the policy below needs in order to check access.
CREATE POLICY conservatory_grant_read_owner_or_client
ON public.conservatory_mcp_read_grants FOR SELECT TO authenticated
USING (
  user_id = (select auth.uid())
  AND (
    ((select auth.jwt()) ->> 'aal') = 'aal2'
    OR (
      ((select auth.jwt()) ->> 'client_id') = oauth_client_id::text
      AND expires_at > now()
    )
  )
);

-- The browser's verified AAL2 session is mandatory for creating/revoking a grant.
CREATE POLICY conservatory_grant_create_mfa_owner
ON public.conservatory_mcp_read_grants FOR INSERT TO authenticated
WITH CHECK (
  user_id = (select auth.uid())
  AND ((select auth.jwt()) ->> 'aal') = 'aal2'
  AND expires_at > now() AND expires_at <= now() + interval '24 hours'
);

CREATE POLICY conservatory_grant_revoke_mfa_owner
ON public.conservatory_mcp_read_grants FOR DELETE TO authenticated
USING (
  user_id = (select auth.uid())
  AND ((select auth.jwt()) ->> 'aal') = 'aal2'
);

-- Replace one global restrictive rule with four command-specific restrictions.
-- SELECT gets a narrow, explicitly MFA-approved, time-limited exception.
-- INSERT, UPDATE and DELETE continue requiring current AAL2, without exception.
DROP POLICY require_verified_totp_aal2 ON public.plant_care_events;

CREATE POLICY care_mfa_or_active_scoped_conservatory_read
ON public.plant_care_events AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  ((select auth.jwt()) ->> 'aal') = 'aal2'
  OR (
    ((select auth.jwt()) ->> 'aal') = 'aal1'
    AND ((select auth.jwt()) ->> 'client_id') = 'dfd21ef1-7d12-4e41-8729-663abb5fc781'
    AND EXISTS (
      SELECT 1 FROM public.conservatory_mcp_read_grants AS grant_row
      WHERE grant_row.user_id = (select auth.uid())
        AND grant_row.oauth_client_id::text = ((select auth.jwt()) ->> 'client_id')
        AND grant_row.expires_at > now()
    )
  )
);

CREATE POLICY care_mutation_mfa_insert
ON public.plant_care_events AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (((select auth.jwt()) ->> 'aal') = 'aal2');

CREATE POLICY care_mutation_mfa_update
ON public.plant_care_events AS RESTRICTIVE FOR UPDATE TO authenticated
USING (((select auth.jwt()) ->> 'aal') = 'aal2')
WITH CHECK (((select auth.jwt()) ->> 'aal') = 'aal2');

CREATE POLICY care_mutation_mfa_delete
ON public.plant_care_events AS RESTRICTIVE FOR DELETE TO authenticated
USING (((select auth.jwt()) ->> 'aal') = 'aal2');

COMMIT;
