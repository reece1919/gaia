# GAIA interface audit — October 23, 2026

Status: **Partially implemented; unselected decisions still open**. Based on the checked-in primary dashboard HTML, loaded frontend modules, generated plant cards, educational views, and task/photo interfaces. This is a source-level audit; it is not a measured browser usability test on the owner's phone.

## Approved decisions implemented — October 23, 2026

The owner approved **only** items **2, 4, 6, 7, and 8**. These are implemented in-place:
- **2:** `task-queue.js` avoids creating empty card summaries and hides existing empty task sections after refresh; active tasks and proposals still show.
- **4:** `learning-hub.js` moves the original WATER, LIGHT, and SOIL blocks into a single **Care Essentials** section, with a collapsed **Why this care works** explanation; no separate copies of last watering, soil mix, or light metadata.
- **6:** `compact-shell.js` brings the existing **Run new analysis**, **Refresh saved results**, and review summary widgets into **Photo reviews**. `photos.js` keeps Delete per photo and places secure-access test buttons in expandable **Photo troubleshooting**.
- **7:** The redundant static card icon legend is gone from `index.html`; all `app.js` care icon tooltips/ARIA and individual explanations remain.
- **8:** The original `#care-overview` auth, password, MFA, syncing, backups, and status elements moved as live DOM nodes into **Tools & reviews → Settings & Backup**, with original handlers preserved.

Unapproved issues remain as-is: **1** stale catalog archive, **3** task-inbox consolidation, and **5** overlapping taxonomy between Care and Botany (as well as the other pending candidates). No database changes. The existing `tests/learning-hub.test.cjs` covers moved control identity, photo IDs, learning material, non-empty task UI, and these unchanged surfaces.

## Non-negotiable design principle

Prioritize (1) do the next care task, (2) find the correct plant, (3) make an observation/photo/watering record, (4) learn why, and (5) browse botany. Distinguish **saved catalog condition flags** and **historical examples** from live readings. Do not delete or modify underlying private records during UX cleanup.

## Completed, no ambiguity

- Moved the hero's three existing collection-health counters, still with the same IDs and update listeners, into the nested **Tools & reviews → saved condition flags** disclosure. None of the health numbers is constantly displayed in the masthead.
- On phones the duplicate **Care Center** heading is hidden; **Care / Learn / Botany** is sufficient navigation. The care tasks, search, and original cards remain accessible.
- Updated the regression fixture to assert the existing photo, Insights, clipboard, condition, and stats nodes survive DOM reflow without cloning. Check via the GitHub Actions baseline test.

## Audit matrix (no further removal authorized yet)

| Rank | Surface | Verified issue | Suggested UX decision | Risk / what to preserve |
|---|---|---|---|---|
| 1 | `#recent-care` via `plants.json.recentCare` and `app.js` | Labeled *Recent*, but it describes **Oct 10–12** and a next check on **Oct 13** (past on audit date). | Remove from the daily Care screen or fold under **Historical collection notes** with a truthful date. | Preserve archive text; it is not a live care event or current task. **Await approval.** |
| 1 | `.gaia-card-todos`, `.gaia-plant-todos` from `task-queue.js` | Every card can display **No pending GAIA to-dos**; expanded card can separately show **No active checklist tasks**. Repeats empty state across 48 plants. | Hide task boxes when no real task/proposal; preserve visible active tasks, approvals, and Todoist integration. | No changes to tasks or reminders. **Approved and implemented.** |
| 1 | `.gaia-care-reason` vs `.card-quick-facts` / WATER/LIGHT/SOIL / `.ps-panel` | New care reasoning shows **light, watering cue, last watering and actual soil mix** that are already accessible elsewhere inside the same open card. | Replace repeated values with one concise **Why this plant needs this care** explanation and link to Academy. | Preserve quick facts and actual readings. **Approved and implemented.** |
| 1 | `#gaia-task-approvals` + `#gaia-tasks` + per-card task snippets | Approve/decline proposals appear in the global approval queue and in per-card expanded areas; task priorities are a separate pane. | One actionable task/inbox hub; show only active items on each specimen. | Do not change approvals, create duplicate tasks, or delete legacy records. **Await approval.** |
| 2 | `#gaia-insights`, `#gaia-photo-review-summary`, manual photo review entry and per-photo review | "Review New Photos" launches new ChatGPT analysis; "Refresh photo comparisons" reloads already saved outcomes; separate UI makes these easy to confuse. | One clearly labeled photo-reviews area with **Run new analysis** vs **Refresh saved results**, with detailed reviews in original plant galleries. | Actions are different; must not merge their backend effects. **Approved and implemented.** |
| 2 | `.gaia-collection-toolbar` / family lesson grouping vs Botanical Library | Care tab still offers **By type & family**, and each type/family heading can show educational text, while the library already has family → genus → plant and learning notes. | Make Care tab search/custom order only; move taxonomy-first browsing to Botanical Library. Or keep grouping as an optional advanced view. | Preserve owner custom ordering, recorded mapping and easy plant navigation. **Await approval.** |
| 2 | `.species-info-shortcut` and in-card `.species-guide` vs Botanical Library | A species button and expansive species panel repeat part of the dedicated Botanical Library and type/family lessons. | Keep a compact one-line botanical identity and a **Learn about this plant** link to library, not a second full reference article inside every care card. | Preserve pronunciations, common names, uncertain IDs and Kew references. **Await approval.** |
| 2 | Individual photo galleries in `photos.js` | Every saved photo has a prominent **Test secure access** button, primarily useful for troubleshooting rather than daily care. | Relocate diagnostic to an expandable **Troubleshooting** area; keep viewing and deletion accessible. | Security test operation must remain available if needed. **Await approval.** |
| 3 | `.card-icon-guide` | Four card icons already explain themselves when tapped; an additional dedicated legend is nested in Tools. | Move to Help or remove the extra legend if users can discover meanings from icon tap labels. | Keep accessible labels/tooltips. **Approved and implemented.** |
| 3 | `#care-overview` account and backup area | A large **Care journal** heading appears as a footer, mostly containing sign-in / sync / security and backup functions already semantically different from care. | Rename/move to **Account & backups**, accessible from Tools/Settings, not a prominent extra care section. | **Do not delete** backup, authentication or MFA workflows. **Approved and implemented.** |
| 3 | `.history` and static catalog fields on all 48 cards | Static "Last bath", "Last photo review", and catalog-condition paragraphs can be mistaken for live journals, adding layers of historical information. | Collapse behind **Catalog history**, date it, and distinguish from recorded owner actions. | Preserve history and provenance; avoid treating old notes as measured current conditions. **Await approval.** |
| 3 | `.gaia-unified-priorities` vs private GAIA Insights and Todoist | Same saved review drives suggested-priority list and Insights brief, while actions are ultimately handled through Todoist. | Display a compact actionable list near existing tasks, with full reasoning in the Insights drawer only. | Maintain dated recommendations and explicit task approval; no automatic care. **Await approval.** |

## Keep visible / keep functional

- Top-level **Care / Learn / Botany** navigation.
- Easy **Ask GAIA** access.
- Plant name + verified original cover image, search, practical care icons and condition notes.
- Care events, soil observations, new-growth checks, pot/soil profile, photo upload/history and secure storage.
- Actual open tasks and owner-approved proposals; no fake auto-watering rules.
- Export / scan clipboard, data backup, login, MFA, and other maintenance features behind a disclosure.
- The Academy's seven practical lessons and Botanical Library's family/genus identification, outside the main daily workflow.

## Technical redundancy observed, separate from visible UX

- `index.html` contains many historical CSS blocks and cascading layout overrides. Consolidation is a code-maintenance project, not a license to remove user features.
- Root contains both `todoist-system.js` and `gaia-todoist-checkable.js` with overlapping purpose; verify actual loading and bridge calls before any code removal.
- A hidden legacy task editor/checklist remains present for migration compatibility. Do not remove until legacy data and integration behavior are confirmed safe.

## Approval needed

Do **not** remove, merge, or turn off any other candidate yet. Ask the owner which numbered candidates they approve, and offer the conservative alternative (collapse/relocate rather than delete). All future work should check signed-in photos, stable IDs, tasks, and the phone's first-screen layout.
