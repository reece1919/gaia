# Conversational collection changes | The Conservatory

Status: **GitHub-assisted, review-gated workflow**, not a new MCP or direct Supabase catalog writer.

## One permanent catalog

The live GAIA web app and the existing authenticated MCP both identify plants from the public GitHub `plants.json` catalog. Private owner-scoped care history stays in Supabase `plant_care_events`. Retired plant ID `65` remains permanently reserved. The Propagation Nursery feature is retired and is not part of this workflow.

A conversational assistant with the existing GitHub connector can **prepare** and test public catalog acquisitions or edits directly from ordinary ChatGPT:

1. Read `main:plants.json` freshly and resolve an existing plant by stable ID and normalized name; never trust remembered counts.
2. For edits, change only user-authorized fields for the exact existing ID. Keep the original object and unaffected records intact.
3. For acquisitions, confirm this is an independently owned new plant. Assign a two- or three-digit string ID above the current maximum. Reject duplicate IDs and case-/Unicode-normalized name duplicates. Do not reuse archived IDs or recast cuttings as separate plants.
4. Construct the standard existing `plants.json` card shape, including `id`, `name`, `species` (explicitly unconfirmed if needed), `searchName`, `searchSpecies`, `status`, `photo` (empty when not supplied), `photoAlt`, `newAddition`, `pest`, `added`, `tags`, `sections`, `history` and `cardCare`. Reuse structure, **not the sample plant's care history**. Dates, care treatments, photos, scientific names and conditions must never be invented.
5. Create a feature branch from the current `main`, commit only the intended catalog edit, and open a PR. The `Conservatory catalog integrity` workflow compares the proposed catalog to the PR base, rejects duplicate/recycled IDs, deleted plants, malformed new entries, and missing card structure. Do not bypass the guard or publish an unreviewed modification.
6. Before any merge, show the user the proposed **public** plant details, relevant changes and passing CI checks. Obtain authorization for the consequential publication. If the user withholds approval, leave the PR unmerged.
7. Once merged, check the GitHub Pages deployment, re-read `plants.json` via the connected MCP `search_plants` and confirm the new/updated plant ID. Do not claim a successful update just because a PR exists.

No service-role keys, GitHub write tokens in browser code, second Supabase catalog, or separate app are required. If the GitHub connector is missing, do not imply that an update was saved.

## Botanical uncertainty

The botanical guide's `byPlant` mappings connect verified families to reusable taxon references. Specific cultivar identities remain provisional unless evidence supports them. **Puck (#92) and Zoidberg (#111) have no family mapping on purpose**; they are labeled unidentified in the permanent catalog. The live learning UI must handle missing references gracefully instead of fabricating a species. For future acquisitions, add a supported guide entry and family lesson when appropriate, or explicitly document the unknown identity before approving the PR.

## Verification

- `node --test tests/learning-hub.test.cjs`
- `node --test tests/conservatory-catalog-guard.test.mjs`
- `node scripts/conservatory-catalog-guard.mjs /path/to/base-plants.json plants.json` (run automatically in a PR)
- Existing Conservatory care/OAuth/browser tests unchanged.

*Remember: Github publication is public; the authenticated care journal is private.*
