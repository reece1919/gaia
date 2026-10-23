# GAIA — Plant Collection Dashboard

## Clipboard field sheets

Use **Export clipboard sheet** below the header to prepare the collection in its current saved order. Choose all plants or only those shown by the current filter. **Print landscape / save PDF** uses US Letter landscape with eight plants per page (six pages for 48 plants). The sheet includes plant IDs, common names, recorded watering, a writable watering date, inner pot width/depth in inches, actual soil mix, new growth, moisture, notes, and the latest associated open task with a Done box. Current recorded values are reference only. Todoist tasks confidently matching exactly one plant are preferred; retained GAIA tasks are the fallback. If neither exists, the latest logged care event is shown without a completion box. Long task/mix text may be shortened on paper; spreadsheet exports retain it in full.

Download **spreadsheet (.xlsx)** for Excel, or **CSV** for direct round-trip editing. Yellow spreadsheet columns are changes; `recorded_` columns retain reference values. Blank/unchecked means no update. Keep plant IDs as text, including leading zeros. Dates use `YYYY-MM-DD`. To import an edited Excel file, save its **Tracking** tab as CSV. The scan key is also included in the workbook's guide tab in ordered JSON chunks.

**Scan completed sheet** uses a manual ChatGPT transcription handoff, with no paid OpenAI API: choose the saved export, copy scan instructions, open ChatGPT and attach the sheet photos, then paste the returned JSON into GAIA. The optional photo preview stays in the browser and is not uploaded automatically. JSON/CSV file imports are also accepted. Export scan keys are retained locally for the latest 20 sheets per signed-in account; download the scan key JSON to use another device or recover after browser storage is cleared. Sign in and verify MFA before preparing a sheet intended for import.

Preview loads current owner records, allows edits and per-plant exclusion, and requires **Save selected changes**. Saving uses the existing owner-authenticated Supabase client/RLS. Pot updates preserve unspecified fields and reject changes made after preview. Watering and soil/growth observations are appended, with deterministic per-sheet IDs and read-back verification; repeated imports do not replace existing observations. A watering already logged for the same plant/date is not duplicated. Task completion is tied to the exact exported task and never implies watering. Changed/removed GAIA tasks and edited Todoist tasks are rejected; Todoist completions are checked against a fresh open-task list. Partial failures are reported alongside retained successful writes. Pending local care/pot changes must sync before import. No photo assessments are changed, no tasks are created, and no new tables, credentials or service-role access are added.

Code: `clipboard-core.js` (validation/interchange/Excel package), `clipboard-store.js` (authenticated persistence), `clipboard.js` and `clipboard.css` (UI and printing). Core/store checks: `node --test tests/clipboard.test.cjs`. The optional Playwright test `tests/clipboard.browser.cjs` runs against a local server with all private APIs mocked. `tests/clipboard-browser.html` is an isolated browser fixture; its saves affect in-memory test records only.


## Todoist / GAIA tasks (October 2026)

A small optional, collapsible Todoist list is available below the collection totals. It filters open Todoist tasks with the personal `gaia` label, using ORBIT's existing secure OAuth bridge and the shared account's MFA session. No Todoist token is stored in GAIA; the herbarium appearance and plant records were not redesigned.

**Live site:** https://reece1919.github.io/gaia/

GAIA tracks a collection of 48 plants with care profiles, 45 original catalog photos, current health, care instructions, follow-up priorities, and care history. The site is published with GitHub Pages from the `main` branch.

## How the website works

- **`index.html`** holds the page layout and styles.
- **`plants.json`** is the source of truth for plant records, quick-care icon metadata, dashboard tasks, and the recent-care summary. It contains all 48 plant profiles, their care sections, health labels, tags, and history.
- **`app.js`** builds the plant cards and quick-care icons, updates counts, and powers the search and filters.
- **`species-guide.js`** is the read-only species encyclopedia, shared by related plants and linked to Kew's botanical reference.
- **`tasks.js`** powers the private cross-device task checklist.
- **`01-...jpg` through `45-...jpg`** are the plant photos, currently stored in the repository root.

The plant records were migrated from the October 12, 2026 dashboard without dropping its 424 care sections, 266 history fields, or 71 history notes.

## Botanical species guide

Every plant card includes a **Species info** shortcut, which opens an expandable **About this species** panel. It shows a botanical reference, genus, family, typical growth habit, distinguishing traits, propagation, and a native range where specifically verified. The external Kew link searches Plants of the World Online and opens in a new tab.

The content lives in `species-guide.js` rather than in the individual care journal or the Supabase database. Plants are mapped by their stable `id` in `byPlant`; repeat specimens of the same taxon share one `taxa` entry. When adding a new plant, assign its ID to a verified taxon key. Until then, the normal plant card continues working without a Species info shortcut.

**Taxonomic caution:** The reference taxon may only be a genus or broader group if a plant's specific identification is uncertain. Cultivars, hybrids, and provisional IDs must not be silently upgraded to confirmed species. The guide provides general botany; use the individual card's WATER, LIGHT, SOIL, and care journal for actual care decisions. Do not invent native ranges when they are unverified.

## Learn about types and families

Every plant-type and botanical-family heading has an independent **Learn about this plant type/family** expander. It teaches what the group is, how to recognize it, typical growth conditions, and something interesting or potentially misleading. The lessons remain accessible even when the plants in a category are collapsed. They do not write any data to Supabase and never use card position to associate a lesson or care record with a plant.

The general guidance is stored in `group-learning.js`: `types` is keyed by the existing `cardCare.type` values and `families` is keyed by botanical family names from `species-guide.js`. Each entry contains `about`, `recognize`, `conditions`, and `learn`. Collection-specific examples help compare the differences between related plants. Kew (Plants of the World Online) links support family research; the RHS houseplant guide covers general care.

**Important:** A type is a horticultural category or growth habit, not necessarily a botanical taxon. A family is a shared evolutionary lineage, not a guarantee of identical light, soil, watering, or temperature needs. Follow each plant's individual care profile for care decisions. If a new type or family is introduced, add the corresponding educational entry to `group-learning.js`.

## GAIA Learning Hub — care-first navigation (October 23, 2026)

GAIA now opens with **Care Center**, followed by two independent read-only reference views:

1. **Care Center** — the existing original plant cards, photo journal, soil/pot and care trackers, tasks, Insights and backups are preserved in one DOM home. A new catalog-condition triage overview clearly labels catalog flags as non-live observations. Each expanded card shows the plant's saved quick-care cues, latest loaded watering entry when available, saved soil mix when available, and an explanation of its broader growth pattern. Links navigate to education and its botanical family.
2. **Care Academy** — seven practical lessons (watering, light, roots/pots, environment, pests, growth/propagation and dormancy). Each lesson covers why it matters, actions to practice, exceptions and links to actual plants in the collection. Overlapping practice groups compare dry-adapted plants, moderate dry-down, moisture-preferring plants, specialist growing media and seasonal patterns. The examples teach observation; they do **not** generate watering reminders or invent sensor readings.
3. **Botanical Library** — taxonomy grouped by family → genus → catalog plant (species/cultivar label). The underlying botanical family is read from `species-guide.js`, and its education profile from `group-learning.js`. Uncertain IDs remain tentative and all botanical rows link back to the original plant card rather than cloning photo/journal controls.

Implementation: `learning-hub.js` + `learning-hub.css`. The new hub safely moves existing dashboard DOM nodes *as original elements* into a Care Center tabpanel, while the other views are read-only generated content. It never rewrites cloud records, creates separate plant cards, or uploads photos. Plant navigation uses stable `data-plant-id` values. The previous type/family visual grouping is still available from within Care Center, and owner-defined card ordering is preserved.

Run `node --test tests/learning-hub.test.cjs` to verify all 48 botanical mappings, 18 type lessons, 23 family lessons, every Academy practice ID, script loading order and stable photo/care card association. This test is also run by the GitHub Security baseline workflow.

Read-only learning recommendations do not override a plant-specific care cue, recorded history, or verified assessment. No Supabase migrations, new secrets, API calls or background inference are involved.

## Browse by plant type and botanical family

The collection defaults to **By type & family**. Each type heading uses the existing plant-type icon and label from `app.js`/`plants.json`. Within a type, cards are grouped alphabetically by botanical family, then by individual plant name. Both type and family headings can be collapsed, and the displayed counts follow search filters.

The **Custom order** button restores the signed-in user's existing manual order. Clicking **Rearrange** automatically selects Custom order before drag/keyboard reordering; saving the order is unchanged. The selection of grouped/custom view is saved on this device only; custom plant order continues syncing through GAIA's existing account. The browser's read-only taxonomy comes from `species-guide.js`, and `collection-grouping.js` only moves existing card elements without modifying care or photo data.

For newly added records, set `cardCare.type` to the appropriate existing type key and add a matching entry to `species-guide.js`'s `byPlant` and `taxa` dictionaries for accurate family grouping. Unknown families are shown as unclassified rather than invented.

## Editing plant records

To update a plant, edit the matching object in the `plants` array in `plants.json`. Each record has a stable `id`, `name`, `species`, `status`, `photo`, `tags`, `sections`, and `history`.

- Edit `name` or `species` to change the card title. Update `searchName` or `searchSpecies` too when changing identification so the search stays useful.
- Set `status` to **Excellent**, **Good**, **Fair**, **Watch**, or **Concern**.
- Edit or add a `sections` entry using its `label` (such as `WATER`, `LIGHT`, or `NEXT ACTION`) and `bodyHtml`.
- Add care log entries under `history.notes` using `bodyHtml`. Maintain the relevant `history.facts` values (such as last watered or last repotted) as events are confirmed.
- Update `recentCare` and `updatedAt` for collection-wide changes.
- For a new plant, add a new object with a unique `id` and the same field structure. If adding a photo, upload that image to the repository and set `photo` to its filename.

**Publishing:** Save/commit changes to `main`; GitHub Pages republishes them automatically. Normal record edits do not require changing `index.html` or downloading a new dashboard file.

## Important limitations

Plant profiles and task definitions are static GitHub data; interactive care journals, private photos and completed tasks sync across signed-in devices via Supabase. Cloud actions do not automatically edit the GitHub plant files. The GitHub Pages site and repository are public; never commit sensitive information.


## Interactive care journal

The dashboard now supports **Watered, Fertilized, Repotted, Pest treatment**, plus dated **Foliage bath, Inspected, Pruned, and Observation** records. Open any plant card and use the quick buttons to log today's action, or open "Add dated entry or note" to backdate an event or include details. Entries appear in the plant's care log, can be undone, and can be exported to a JSON backup.

### Data storage and synchronization

- By default, entries are saved in **this browser's localStorage**, not in GitHub. They persist across reloads on that device, but **do not synchronize** across devices or browsers.
- **Supabase sync is configured and tested across the computer and iPhone.** Device-only journal entries remain local unless imported into the account.
- The cloud table holds **care events only**; plant profiles continue to be edited in `plants.json` via GitHub. Existing static care history remains available.
- The public GitHub repository contains only browser-safe Supabase URL and publishable key values in `gaia-config.js`. Never commit a service-role key, secret key, or database password.

### Supabase connection and setup status

- Supabase project **GAIA** (US West) exists and is healthy.
- Private table `public.plant_care_events` created with Row Level Security and four owner-only policies.
- Browser-facing project URL and **publishable** key configured in `gaia-config.js`. No service-role key or database password is in the site.
- The care, photo and task tables use owner-only Row Level Security. Authentication settings are configured and sign-in has been tested on desktop and iPhone.

### Authentication configuration (already completed)

1. Open [Supabase Authentication URL Configuration](https://supabase.com/dashboard/project/zdurujqwhxqrwbhwzzxg/auth/url-configuration).
2. Set the **Site URL** to `https://reece1919.github.io/gaia/`.
3. Add `https://reece1919.github.io/gaia/` to **Redirect URLs**, and save. You can use `https://reece1919.github.io/gaia/**` for additional routes in the future.
4. Verify Email authentication is enabled under **Authentication → Providers → Email**.
5. On [GAIA](https://reece1919.github.io/gaia/), use **Sync, account & backup** at the bottom of the page to sign in with your GAIA email and password. Email links are available as a fallback.
6. Add a care entry on one device; open GAIA on another, sign into the same account and tap **Sync journal** to verify it appears. Synchronization occurs when you load/reload the app, save entries, or tap Sync; it is not realtime push.
7. If you recorded entries before signing in, choose **Import earlier device entries** on each relevant device. It copies them to your private account without deleting the device-only backup.

### Recovering care entries

The **Export journal backup** button downloads the current visible journal in JSON. Keep backups if you're using device-only storage or before clearing browser/site data. Device-only entries may be lost if the browser storage is cleared or you use a private browsing window.

## Dashboard task checklist

The collection dashboard displays quick care icons for light, plant type, watering threshold, and preferred soil. Their metadata lives in each plant's `cardCare` entry in `plants.json`, and the full care guidance remains in the plant profile. These are care guidelines, not live moisture readings.

The expandable **Tasks to complete** checklist appears near the top. Its six starter tasks come from the Oct 12 care notes; edit `dashboardTasks` in `plants.json` to change them. Keep stable task IDs when updating the wording, so previous completions remain valid.

Task checkboxes are private and cross-device: checking or unchecking saves an owner-only row in `public.gaia_task_completions` (see [`supabase/gaia_task_completions.sql`](supabase/gaia_task_completions.sql)). They do not create a care event or imply watering actually occurred; log real work in the matching plant's care journal.

While signed in, open **Tasks to complete → Add a task** to create personal care follow-ups. You can choose a plant or the whole collection, set an optional due date, and add notes. Personal tasks can be marked complete, edited, or removed without changing the curated follow-ups. Overdue and due-today dates are highlighted whenever GAIA is opened. This is **in-app due-date tracking, not phone notifications**. Personal tasks live in the private owner-only `public.gaia_custom_tasks` table (see [`supabase/gaia_custom_tasks.sql`](supabase/gaia_custom_tasks.sql)). Watering must still be based on real soil and plant conditions, not rigid recurring dates.

**Recent care** appears after the plant cards, followed by **Sync, account & backup** at the very bottom.

## Tablet field desk (iPad and other tablets)

GAIA is still a single responsive website — not a separate iPad app or duplicate database — but it now has a dedicated tablet layout for viewport widths of **700–1280 CSS pixels**, covering common portrait/landscape tablet widths. The existing mobile and wide desktop interfaces are retained.

- A **sticky Field Desk** shortcut bar appears after the collection statistics, providing quick navigation to Tasks, Insights, Find a plant, Care journal, and **Ask GAIA** (the existing ChatGPT project). Tapping Tasks or Insights opens its panel; Find a plant focuses search.
- Plant browsing uses **two wider columns** rather than three cramped cards in tablet landscape. Opening a plant expands the specimen across **the full grid width** with a compact, side-by-side cover photo and title. `tablet.js` brings the expanded card into view after reflow.
- Larger touch targets are supplied for care actions, care fact icons, task checkboxes, task editing, upload buttons, search, and other form fields. The same cloud account, private photos, task completion and care journal remain in use.
- No app installation, additional account, separate data store or paid AI API is needed. Visit [GAIA](https://reece1919.github.io/gaia/) using a tablet browser. On iPad, Safari's **Share → Add to Home Screen** can provide a convenient launcher.

This is responsive behavior based on available screen width, so split-screen or Stage Manager may change which layout is used. The browser's rendered appearance should still be checked on physical iPads of the intended sizes.

## GAIA Insights: private AI briefings and ChatGPT project

The Midnight Herbarium now includes a read-only **GAIA Insights** panel between the task checklist and the plant filters. It reads the latest record from `public.gaia_ai_reviews` for the **signed-in GAIA user only**. The report consists of its saved review date, summary, up to five priorities and rationale, and an expandable evidence/uncertainties section. Saved report text is escaped when rendered.

- **No OpenAI API calls happen in GAIA.** The page only reads its authenticated owner's existing Supabase review records; any ChatGPT automated analysis happens separately using the user's ChatGPT scheduled task.
- The panel fetches reviews on sign-in, optionally refreshes when returning to the browser tab or syncing care, and has a manual **Refresh notes** button. It does not offer AI chat within the website.
- If no review is saved for that user, or private record access is unavailable, the panel states this plainly. It does not generate or invent suggestions to fill the space.
- A baseline `manual_review` was saved for October 12, 2026, using only the known static care notes. It reports mite follow-up concerns and plant-specific needs. It is **not** an independent diagnosis, private photo analysis, moisture reading, or care event.
- The scheduled **GAIA Daily Plant Review** checks once daily, normally in the morning, for meaningful changes and updates the private review table when supported. Scheduled executions and future database writes are independent from the browser panel and are not guaranteed by the existence of the panel.
- Reports are **recommendations, not confirmed care history**. They do not automatically complete tasks or modify `plants.json`.
- The header's **Ask GAIA** link opens the user's [ChatGPT plant-care project](https://chatgpt.com/g/g-p-6a68d01f4a088191820e9381dd3d14c8/project) in a new tab. This URL is present in the **public** GitHub Pages HTML; only a properly signed-in ChatGPT account with access to that private project can open its content.

The implementation is in `insights.js`; the page reads from the existing private `gaia_ai_reviews` table protected by Row Level Security. Avoid adding OpenAI API credentials to `index.html`, `gaia-config.js`, or other public files.

## Todoist: recommended plant follow-ups

The connected **GAIA Daily Plant Review** ChatGPT automation has an additional one-way Todoist integration. Its saved actionable GAIA Insights recommendations can become tasks in the existing Todoist **Home → GAIA Recommendations** section (Home project `6hhpRVXF5cQv89rr`, section `6hjxVjvF3fP5gRwJ`).

- Four October 12 baseline recommendations were added: spider-mite checks on the six affected plants, new-arrival inspection, Audrey II's medium and water source, and Malefecent's center/leaf monitoring. These were old-record-based follow-ups; the automation should not recreate them.
- On each daily review, the ChatGPT automation checks existing active/completed Todoist work for overlapping actions before creating **up to three** new, evidence-supported recommendations. Todoist task descriptions include a persistent `GAIA-SYNC-ID`, rationale, and a link back to GAIA. A date is provided only if GAIA's evidence genuinely supports one.
- This is **scheduled one-way coordination**, not a continuous API integration or bidirectional task synchronization. Completing a Todoist task will **not** change GAIA's checklist or record watering, pest treatments, or other physical care. Record confirmed care in the GAIA journal separately.
- The GAIA static website does not call Todoist's API, store Todoist credentials, or incur additional OpenAI API billing. The daily task depends on having access to the connected Todoist and Supabase apps at run time; future sync success should be checked, not assumed.

## Photo-by-photo visual review queue

Every private photo now has an owner-protected visual-review state stored with its `plant_photos` record. New and existing unreviewed images are `pending`. GAIA may later record `reviewed`, `needs_attention`, or `unavailable`, plus a short summary, structured findings, optional confidence, review timestamp, and source.

- A photo must never be marked reviewed unless its actual image pixels were retrieved and inspected.
- Photo dates, captions, filenames, or care history alone are not visual evidence.
- Visual findings are observations, not confirmed diagnoses or care events.
- The browser remains read-only for analysis fields; automated/admin review writes remain separate from ordinary photo uploads.
- The photo journal displays the saved review state and summary but does not itself call an AI service.

Schema: [`supabase/gaia_photo_analysis_queue.sql`](supabase/gaia_photo_analysis_queue.sql).

## Uploading plant photos directly from GAIA

Open any plant profile and find **Photo journal**. While signed in, tap **Take or choose a photo** (Safari offers camera or photo library), optionally set the date and add a note, then choose **Upload photo**. The browser resizes the picture to a JPEG with a maximum dimension of 1,800 pixels. An original image larger than 35 MB or processed image larger than 8 MB is rejected.

- Uploaded photos live in a **private Supabase Storage bucket** (`gaia-plant-photos`), with metadata in `public.plant_photos`. Both use per-user Row Level Security. The authenticated client's public publishable API key is safe for the browser; do not commit secret credentials.
- The newest upload automatically becomes the plant's cover photo **for signed-in viewers**. Older uploads remain in the plant's photo gallery with dates and optional notes, and each can be deleted.
- The original GitHub-hosted photo remains unchanged and serves as a fallback for visitors who are not signed in.
- After uploading on one device, open GAIA on the other and tap **Sync journal**, refresh, or return to its browser tab to load the new gallery. Photo URLs expire after one hour and are refreshed when reloading/syncing.
- To inspect the backend schema and security rules, see [`supabase/gaia_plant_photos.sql`](supabase/gaia_plant_photos.sql).

The site is hosted publicly, but new uploaded photos are **not** published to GitHub or to unsigned visitors. For public photo publishing, use a separate deliberate publishing workflow.

## Editing the site

## Recovery

GitHub retains file revision history. If an update breaks something, previous commits can be used to restore a working version.


## Pot, soil, moisture and growth tracking (October 23, 2026)

Each plant card has **Pot, soil & growth tracking**, separate from the automated photo-review system. The section contains:

- Editable pot profile: inner pot diameter and depth in **inches**, inner pot material, clear-pot indicator, drainage holes, decorative outer pot, actual soil mix and last repotted date.
- Dated observations: optional numeric moisture reading with its meter scale, a **New growth observed** checkbox, and optional notes. At least one observation is required to save an entry. Readings are relative to the meter's scale, not laboratory-calibrated moisture percentages.
- Recent observation history and last watered date (from the existing signed-in care journal).
- Device-local saving even before sign-in, with private owner-only cross-device sync once signed into GAIA. As with the original journal, device-only entries are not automatically transferred to an account; use the same signed-in account for cross-device records.

**Photo-review failures do not prevent manual observations.** Checking "New growth observed" and saving creates a dated event; it does not change the plant's health category or require a photo analysis.

Source: \`pot-soil.js\` and \`pot-soil.css\`. Tables: \`public.gaia_pot_profiles\` and \`public.gaia_soil_observations\`. RLS is enabled with owner-only policies, no anonymous data access; see \`supabase/gaia_pot_soil_growth.sql\`.
