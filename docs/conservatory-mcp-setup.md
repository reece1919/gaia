# The Conservatory: ChatGPT MCP bridge

## Production status — November 20, 2026

The browser-based `Conservatory MCP Bridge` uses the existing GAIA/Supabase OAuth
connection. Supabase Edge Function `conservatory-mcp` **version 4 is active**.

- `search_plants`: **verified live** through regular ChatGPT Chat, no GitHub fallback.
- `get_care_history`: **verified live** with owner-scoped OAuth, retrieving real
  records for plant 04 (Audrey II) after the approved policy change.
- `record_care_event`: **deployed**, but the first genuine in-chat write has not
  yet been performed. All 44 automated Node tests, Deno typecheck, and Chromium
  smoke tests passed; tests use mock DB records instead of adding dummy care.
- `get_connection_status`: reports signed-in session; MFA is optional for plant
  care. The connected ChatGPT tool discovery may need a fresh conversation to
  expose newly added tools.

## Authentication and authorization

- OAuth 2.1 issues user-scoped JWT access tokens; the MCP middleware validates
  them with Supabase Auth. No service-role key or unrestricted database SQL is
  used for care.
- The user **explicitly authorized** removing mandatory MFA only from
  `public.plant_care_events` on November 20, 2026.
- The prior restrictive `require_verified_totp_aal2` policy was removed
  transactionally. Table RLS remains **enabled** and all four
  `care_{select,insert,update,delete}_own` policies remain, each restricting
  records to `auth.uid() = user_id`.
- No other table's RLS policies were changed. MFA can still protect other Grimoire
  records. Supabase OAuth's existing AAL1 limitation therefore no longer
  prevents *this table's* owner-scoped care access.
- For care writes, the model supplies an exact plant ID, supported action,
  completed date, note and stable UUID. The server derives `user_id` from
  `auth.getUser()`, validates the catalog ID and event, inserts via the RLS-
  protected user client, and verifies the exact record by UUID/read-back.
  Repeating the same UUID for the same event is idempotent; changing the details
  under that UUID is rejected.

## Supported care actions

`prune`, `fertilize`, `repot`, `pest`, `bath`, `inspect`, `water`, `note`.

Routine watering is optional. Propagation and acquisitions have dedicated
existing workflows and must not be silently misclassified as other actions.

## Verification

- [Approved code and test suite: PR #15](https://github.com/reece1919/gaia/pull/15)
- [OAuth upstream issue, no longer a blocker for plant care](https://github.com/supabase/auth/issues/2838)
- The owner-scoped live read from plant 04 returned historical inspection,
  watering and pruning entries, without administrative SQL access.
- A genuine care-write request is the next acceptance test; do not create
  imaginary events to simulate user activity.

## Privacy considerations

`plants.json` in the **public** repository includes historical note objects for
110 plants, and ~94 catalog cover-photo references. These are already public
static fields, distinct from the RLS-protected Supabase journal. No evidence
from the inspected catalog file establishes that synced private
`plant_care_events` or private `plant_photos` are exported into GitHub.
Audit other export paths and user intention before altering or deleting public
history/photos. MFA never retroactively protects data committed publicly.


## Remaining work

- Have ChatGPT reload the updated MCP tool list and perform one **real**
  completed care event when the user naturally has something to record.
- Read back the same event ID and verify it appears in the existing Conservatory
  web journal; do not add a second database.
- Consider connecting the existing botanical skill plugin to the browser MCP
  bridge so there is only one clear user-facing entrypoint.
