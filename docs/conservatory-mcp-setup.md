# The Conservatory: user-authenticated MCP connection

Status: **development branch only**. No OAuth settings, Edge Function, plugin connection,
database policy, or site routing changed in production by this proposal.

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

## Prerequisites (NOT verified or enabled yet)
1. Confirm Supabase Auth has **asymmetric JWT signing keys** (JWKS; ES256 or RS256);
   the documented `withSupabase` middleware rejects legacy HS256-only credentials.
2. Review the staged static consent route at `oauth/consent/index.html`
   and `oauth/consent/consent.js`. It requires the existing signed-in session
   and AAL2 MFA before showing the client, requested identity scopes and
   explicit Approve/Deny buttons. The route is **not yet live**.
   Confirm the Supabase Auth Site URL and authorization path resolve to
   `https://reece1919.github.io/gaia/oauth/consent/` before enabling OAuth.
   A real sign-in/OAuth handshake is not yet verified.
3. Only after route verification, configure Supabase Authentication > OAuth Server:
   authorize path, OAuth 2.1 enablement, and carefully controlled dynamic client
   registration. This modifies authentication behavior and needs explicit approval.
4. Deploy the Edge Function with `verify_jwt=false` so **OAuth discovery** works.
   The endpoint's `withSupabase({auth:'user'})` performs token verification and
   RLS-scoped queries. Never deploy unauthenticated data tools.
5. Verify unauthenticated requests yield 401 with a metadata challenge, and
   authenticated `aal1` users cannot read private care events.
6. Test `search_plants` and `get_care_history` using an authorized owner session.
7. Add `record_care_event` later, with explicit user authorization, a stable UUID,
   no caller-supplied `user_id`, exact-ID read-back, and replay protection.
8. Update the **existing private plugin** to point at the verified MCP endpoint.
   Do not recreate a plugin and do not claim the existing plugin has live access yet.

## CI coverage
- `deno check supabase/functions/conservatory-mcp/index.ts` verifies the MCP
  server's type contract.
- `node --test tests/conservatory-oauth-consent.test.cjs` checks that signed-out
  and AAL1 sessions cannot approve, that approval requires a user click, and
  that denial uses the deny API.
- Browser interaction with a real Supabase Auth OAuth request still needs
  an isolated authenticated test, not an administrative SQL shortcut.

## Scope of the staged server
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

## Release gate
No deployment or Auth configuration changes until the consent UI and OAuth
prerequisites have been reviewed, tests passed, and the owner explicitly
authorizes deployment. Avoid producing extra databases, credentials, or services.
