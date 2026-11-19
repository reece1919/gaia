# The Conservatory | Conversational care foundation

Status: development proposal on `feature/conservatory-foundation`. Not deployed.

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
