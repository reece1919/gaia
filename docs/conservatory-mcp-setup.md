# The Conservatory: user-authenticated MCP connection

Status (November 19, 2026): **Read-only endpoint deployed; OAuth sign-in not active yet.**
The GitHub Pages consent route is public, the Supabase Edge Function is ACTIVE, and
the existing private ChatGPT plugin has been updated to version 0.2.0 with an OAuth
MCP connection. The Supabase OAuth server itself is not enabled, so user-linked
reads are **not yet verified or available**. There is no care-writing MCP tool.

## Existing resources to reuse
- Supabase project `GAIA` (`zdurujqwhxqrwbhwzzxg`).
- Existing `auth.users` identity and MFA verification.
- Existing owner-scoped `public.plant_care_events` journal with a **restrictive**
  policy requiring `auth.jwt()->>'aal' = 'aal2'`.
- Static public plant catalog at `https://reece1919.github.io/gaia/plants.json`.
- Existing private ChatGPT plugin `The Conservatory`; **update it in place**
  only after an authenticated MCP endpoint is deployed and verified.

## Design
Use the [Supabase BYO MCP server guide](https://supabase.com/docs/guides/ai-tools/byo-mcp)
and [OAuth 2.1 for MCP](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication).
An Edge Function exposes Streamable HTTP MCP. Supabase OAuth 2.1 handles client
registration, user consent, authorization-code exchange, token rotation, and
OAuth discovery. The server middleware authenticates the caller and supplies a
**user-scoped Supabase client**, never a service-role key.

This avoids a separate OAuth database or user identity system.

## Verified production status
- Consent page: https://reece1919.github.io/gaia/oauth/consent/ (HTTP 200).
- MCP endpoint: https://zdurujqwhxqrwbhwzzxg.supabase.co/functions/v1/conservatory-mcp
  deployed with gateway JWT precheck disabled **only** to allow OAuth metadata;
  user authorization is enforced by the endpoint's `withSupabase({auth:'user'})`.
- Public JWKS publishes an ES256 asymmetric signing key.
- OAuth resource metadata reports the correct Supabase Auth issuer.
- Anonymous and malformed-bearer MCP requests both return HTTP 401.
- OAuth authorization-server discovery currently returns HTTP 404 until the
  Supabase dashboard OAuth server is enabled.
- Live test: https://github.com/reece1919/gaia/actions/runs/44638832844

## Remaining account configuration
The owner has approved production read-only deployment. The connected Supabase
management tools cannot change OAuth server settings in the Auth dashboard.

1. Open the existing GAIA project in Supabase: **Authentication > URL Configuration**.
   Inspect and retain the current Site URL; do not change existing login redirects
   without verifying dependent flows.
2. Open **Authentication > OAuth Server**, enable OAuth 2.1, configure the Authorization
   Path so **Site URL + path** resolves to
   `https://reece1919.github.io/gaia/oauth/consent/`, and enable
   **Dynamic Client Registration** for ChatGPT.
3. Confirm the OAuth authorization-server discovery endpoint returns a valid
   issuer document, then sign into GAIA with the owner's AAL2 MFA session.
4. Open the existing private **The Conservatory** plugin and complete its OAuth
   connection. Test that read-only plant lookup and private care-history reads work.
   Verify AAL1 and other users cannot read the owner's records.
5. Only then plan the separate explicitly authorized care-writing MCP tool with
   stable UUIDs, retry handling, and read-back verification.

Do not paste account credentials or session tokens into ChatGPT or GitHub.
No extra database, new user identity, or service-role token is needed.

## CI coverage
- `deno check supabase/functions/conservatory-mcp/index.ts` verifies the MCP
  server's type contract.
- `node --test tests/conservatory-oauth-consent.test.cjs` checks that signed-out
  and AAL1 sessions cannot approve, that approval requires a user click, and
  that denial uses the deny API.
- Browser interaction with a real Supabase Auth OAuth request still needs
  an isolated authenticated test, not an administrative SQL shortcut.

## Scope of the deployed read-only server
- `search_plants`: read-only, selected ID/name/species fields from the existing
  static catalog. No history, images or private data are returned.
- `get_care_history`: read-only, private events through RLS.
- No writes or private photo retrieval in this first phase.

## Privacy investigation
`plants.json` in the **public** repository includes historical note objects for
110 plants, and ~94 catalog cover-photo references. These are already public
static fields, distinct from the RLS-protected Supabase journal. No evidence
from the inspected catalog file establishes that synced private
`plant_care_events` or private `plant_photos` are exported into GitHub.
Audit other export paths and user intention before altering or deleting public
history/photos. MFA never retroactively protects data committed publicly.

## Next release gate
The current deployment is read-only. Adding care writes, changing existing
Supabase policy, or exposing private photos requires separate review and
authorization. OAuth consent must be tested with a real owner's AAL2 session
before saying the plugin is connected.
