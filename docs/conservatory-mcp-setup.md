# The Conservatory: user-authenticated MCP connection

Status (November 20, 2026): **MCP catalog lookup works in ordinary ChatGPT web Chat.**
The custom `Conservatory MCP Bridge` is connected to the deployed Supabase
Edge Function. The signed-in OAuth bearer token is currently `aal1` even when
consent was given from an MFA-verified browser session. The private journal has
a restrictive `aal2` RLS policy, so private care reads and writes remain blocked.
The connection does not have a care-writing tool.

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
- OAuth discovery, ES256 signing, and MCP resource metadata are working.
- MCP endpoint: https://zdurujqwhxqrwbhwzzxg.supabase.co/functions/v1/conservatory-mcp
  (ACTIVE). The public OAuth metadata is accessible without a JWT, but the
  actual MCP middleware validates the caller's Supabase OAuth token.
- Anonymous and malformed-token MCP calls are rejected with HTTP 401.
- The web Chat custom plugin `Conservatory MCP Bridge` successfully called
  `search_plants` for Sovereign (plant ID 50), without GitHub or desktop mode.
- `get_care_history` correctly blocks private records on AAL1. The diagnostic
  read-only `get_connection_status` tool reports AAL without disclosing user
  identity, tokens or account details.
- Node regression suite (36 tests), Deno type-checks and Chromium smoke tests
  passed before the diagnostic deployment. Plant records were not changed.

## Confirmed Supabase OAuth limitation
A real OAuth session returned `aal1` when queried through the connected
ChatGPT MCP tool. Even though the consent page insists on an existing AAL2
browser session, the Supabase OAuth authorization-code exchange mints **new
AAL1 client sessions**. Supabase Auth upstream issue
https://github.com/supabase/auth/issues/2838 describes this behavior and is
still open as of November 20, 2026. Reconnecting or completing MFA again does
not upgrade the OAuth client's token.

**Do not weaken existing AAL2 restrictive RLS**, trust only `client_id` as an
MFA substitute, or use a privileged service-role connection for ordinary care.
A supported mechanism to issue delegated AAL2 tokens or a carefully reviewed
second proof of MFA would be required for private care. The latter would be a
new security architecture and requires separate design and owner approval.

Until then, use the signed-in Conservatory website to read/write private care.
Public plant catalog lookup remains available from ordinary ChatGPT Chat.

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
authorization. The public catalog MCP is connected, but private record tools must not be
represented as working until an AAL2-capable delegated authentication mechanism
is verified.
