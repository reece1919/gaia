# The Conservatory | Phase II architecture and rollout

As inspected November 20, 2026. This is the target architecture and development
handoff. **Draft PR #16 has not been merged or deployed.**

## Canonical experience

**One authoritative entrypoint for live owner data:** the existing connected
**Conservatory MCP Bridge** (Supabase Edge Function `conservatory-mcp`,
OAuth to the existing Supabase Auth identity). Use it in ordinary ChatGPT
conversations and mobile, not an administrator connection or a new database.

The user-facing name is **The Conservatory**. The site at
`https://reece1919.github.io/gaia/` remains the graphical companion; GAIA
GitHub identifiers and Supabase table names are retained intentionally.

There are currently three overlapping private plugin packages:
- `plugin_asdk_app_6b00a0305fe88191be30a1ff076e8dec`: **working
  connected app**. Preserve OAuth registration, credentials and active
  connection. Its published description is stale (calls the app read-only).
- `plugins_6aff7c8240c8819193e1d60e73bd882c`:
  `conservatory-grimoire`, an **advisory botanical-companion skill** with
  existing MCP metadata. This provides guidance but must not be mistaken for
  a second authoritative data service.
- `plugins_6aff804089b481919221d0cfe02b670c`:
  `the-conservatory`, a **legacy bootstrap skill** that still claims the
  authenticated bridge has not been built. Its guidance is stale.

**Consolidation order:** first ship and verify additive bridge tools; then
update the preferred companion skill to reflect the live capabilities; test
normal Chat and mobile; only afterward review disabling the redundant legacy
skill. Do not uninstall, replace or reauthorize the working MCP app as a
cleanup shortcut. A plugin label alone does not establish that its MCP tools
are available in the current conversation.

## Sources of truth

| Record | Authority | Conversational path |
| --- | --- | --- |
| Permanent named plants and IDs | GitHub `plants.json` on `main` | Search via bridge; approved acquisitions/edits through GitHub PR |
| Private care events | `public.plant_care_events` | Existing `record_care_event`, unchanged |
| Propagation batches | `public.gaia_propagation_batches` | New `get_propagation_nursery` / `start_propagation_batch` |
| Individual cuttings | `public.gaia_propagation_cuttings` | New `add_propagation_cutting` / `update_propagation_cutting` |
| Private propagation photos | Existing private Supabase Storage | Website only; not exposed via new MCP tools |

A separate stem returned to its original pot is a care matter, not an
independent propagation. A cutting becoming established does not create an
official collection entry automatically.

## Authentication boundary

The November 20 care-journal change removed mandatory AAL2 from
`plant_care_events` only; owner-only RLS remains. Nursery batch, cutting,
photo and storage RLS **still requires AAL2**. The existing bridge currently
reports AAL1. The new tools give an explicit MFA-required error rather than
misrepresenting an RLS-filtered empty list as an empty Nursery. They never use
a service-role key, Supabase management SQL or a second credential source.

Do not expand AAL1 permission to propagation without a separate informed
security decision and a reviewed migration.

## New tool semantics (PR #16)

- **Read Nursery:** only the signed-in owner's records, with exact stable IDs
  and `updated_at` for updates.
- **Start batch:** explicit recorded start, optional existing catalog parent,
  one UUID, owner-derived row, independent read-back; retry uses the same UUID.
- **Add cutting:** existing owned batch, one UUID per distinct cutting, owner
  derived, independently verified; no automatic plant card.
- **Update cutting:** explicit observed progress only; rejects stale versions,
  preserves unspecified fields, checks final state after writing. Do not infer
  a rooting milestone from dates or a photograph.

Offline Node tests cover validation, unauthorized or denied writes,
idempotent retries, unknown parent IDs and concurrent edits. The GitHub CI
workflow includes these tests and a Deno typecheck of the server.

## Acquisitions and collection updates

The permanent catalog lives in a **public GitHub repository** and currently
contains 110 active plants, with the retired ID `65` reserved. Do not create
another plant table in Supabase merely to make writing easier.

For an explicit acquisition or edit request in ChatGPT:
1. Read current `plants.json` from GitHub. Confirm the plant is an
   established collection member, not a tracked cutting.
2. Resolve the existing plant ID for edits; for additions assign an unused
   monotonically increasing text ID above the current maximum. Preserve
   old IDs, including leading zeroes. Check normalized name uniqueness.
3. Prepare a complete card with confirmed name, known/provisional species,
   acquisition date, condition uncertainty and standard care fields.
   Do not fabricate a cover photo, watering or pest treatment. Empty cover
   references are legitimate until the user supplies a photo.
4. Commit proposed `plants.json` changes on a feature branch and open a
   **draft pull request** using the installed GitHub connector. Run
   `scripts/conservatory-catalog-guard.mjs` and CI. Review public notes
   and images before any public merge.
5. Merge/publish only after the user authorizes the consequential deployment.
   Read the refreshed catalog back through the bridge and website.
6. If a cutting graduates, link its `linked_plant_id` to the verified newly
   published catalog ID using the existing Nursery record. Do not create
   another cutting, care event or catalog row for the same accession.

The catalog guard catches duplicate/recycled IDs and names, deleted plants,
missing card structures, and incomplete acquisitions; it cannot independently
prove a plant's species or that a photo corresponds to a particular plant.

## Production rollout checklist

- Keep PR #16 draft until tests and review pass.
- Compare GitHub `supabase/functions/conservatory-mcp` with active
  Supabase Edge Function version 4; deploy only on approval.
- Verify the original four MCP tools and the existing Sovereign care event
  before and after deployment.
- Verify AAL1 Nursery calls fail explicitly. AAL2 read and authorized test
  writes must be performed using a real owner-authenticated session, not
  management SQL. Do not create fake plants or care entries just for a test.
- Confirm normal ChatGPT and mobile expose newly registered tools after any
  necessary tool refresh.
- Revisit duplicate skill packages only after one canonical experience works
  consistently.
