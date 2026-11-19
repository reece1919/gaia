# The Conservatory | Conversational care foundation

Status: reviewed-entry web prototype implemented on `feature/conservatory-foundation`. Not deployed.

## Identity
- User-facing product: **The Conservatory**, part of **Grimoire**.
- Retain `gaia` GitHub repository, GitHub Pages path, Supabase project, existing table names, API endpoints, storage paths, IDs, and authentication.
- Preserve existing care history, journal, photo review, Nursery, Todoist bridge, and exports.

## Care recording priorities
- **Do not require routine watering logs.** Watering is intuitive and optional. Keep existing water-related functionality and historical data for compatibility.
- First conversational actions: **pruning, fertilizing, repotting**, followed by propagation, pest treatment, acquisitions, and noteworthy observations.
- Example: “I pruned Sovereign today and removed two damaged leaves.”
- Resolve a plant by exact ID or unambiguous catalog name. Ask for clarification when names collide or an event is ambiguous.
- Extract event type, date, note, and optional relevant details. Never invent product, dose, cuttings, or other measurements.
- Require owner authentication and preserve current MFA/AAL2 protections. Never put service-role keys in ChatGPT prompts or browser code.
- Write through a vetted, narrowly scoped existing authenticated backend route where possible. If none supports the event, design the smallest secure endpoint before implementation.
- Prevent duplicate submissions using a stable request identifier; report partial failures; read back the saved event before claiming success.
- Do not automatically create tasks or change plant health flags when recording an event.

## Verified implementation
- `conservatory-dictation.js` identifies one unambiguous plant and one care action; unknown or duplicate names and ambiguous dates are rejected.
- `index.html` presents an always-visible quick care note and an explicit review-and-save step; `compact-shell.js` keeps it above the search controls on mobile.
- `care.js` uses the existing journal and private `plant_care_events` sync. The exact newly generated event ID is checked against the cloud read-back before reporting verification.
- The existing table has an owner `auth.uid() = user_id` policy and an **RLS restrictive** `aal = aal2` policy for authenticated users. Confirmed read-only in Supabase on Nov 19, 2026.
- Routine watering remains available but is no longer a prominent quick action.
- Node regression and simulated integration suites pass in GitHub Actions. A real mobile Chromium smoke test was also added; check its current workflow status before claiming browser verification.

## Next integration step: ChatGPT-native care
- This website form is not a ChatGPT connector. Connecting Aethera to writes requires a user-delegated authenticated route, not administrative SQL or a pasted service key.
- Reuse the existing Supabase `plant_care_events` table and AAL2 owner permissions. Do not duplicate plant care in another database.
- A future scoped connector should accept a stable event UUID, known plant ID, action type, date, and note, validate the caller, create the event once, and read the same UUID back.
- Voice transcription can supply text to the same validated workflow; no separate AI hosting is needed for the current deterministic parser.

## Known unrelated baseline issue
- The existing main branch has a failing `learning-hub` test because newer plant additions, beginning with Georgia (plant 77), are not yet covered in `species-guide.js`. Do not invent species identifications merely to make this test green; address catalog metadata separately.

## Implementation sequence
1. Confirm existing `plant_care_events` schema and authenticated write path, including permitted event types.
2. Implement and test one non-watering event end to end, preferably pruning, with explicit read-back.
3. Add fertilizing and repotting using the same secure flow; preserve existing journal UX.
4. Validate name disambiguation, date handling, duplicate protection, access controls, and mobile usability.
5. Review changes before merging to `main` and publishing GitHub Pages.

## Out of scope
- Database migration, catalog migration from `plants.json`, new AI hosting, always-on voice hardware, compulsory watering tracking, renaming backend resources, and automatic public photo publication.

## Deployment guardrail
This branch is intentionally separate from `main`. No production deployment, database write, or API deployment is authorized by this planning document.
