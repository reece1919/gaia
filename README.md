# GAIA — Plant Collection Dashboard

**Live site:** https://reece1919.github.io/gaia/

GAIA tracks a collection of 45 plants with photos, current health, care instructions, follow-up priorities, and care history. The site is published with GitHub Pages from the `main` branch.

## How the website works

- **`index.html`** holds the page layout and styles.
- **`plants.json`** is the source of truth for plant records, quick-care icon metadata, dashboard tasks, and the recent-care summary. It contains all 45 plant profiles, their care sections, health labels, tags, and history.
- **`app.js`** builds the plant cards and quick-care icons, updates counts, and powers the search and filters.
- **`tasks.js`** powers the private cross-device task checklist.
- **`01-...jpg` through `45-...jpg`** are the plant photos, currently stored in the repository root.

The plant records were migrated from the October 12, 2026 dashboard without dropping its 424 care sections, 266 history fields, or 71 history notes.

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
- The scheduled **GAIA Hourly Plant Watch** is intended to monitor meaningful changes and update the private review table when supported. Scheduled executions and future database writes are independent from the browser panel and are not guaranteed by the existence of the panel.
- Reports are **recommendations, not confirmed care history**. They do not automatically complete tasks or modify `plants.json`.
- The header's **Ask GAIA** link opens the user's [ChatGPT plant-care project](https://chatgpt.com/g/g-p-6a68d01f4a088191820e9381dd3d14c8/project) in a new tab. This URL is present in the **public** GitHub Pages HTML; only a properly signed-in ChatGPT account with access to that private project can open its content.

The implementation is in `insights.js`; the page reads from the existing private `gaia_ai_reviews` table protected by Row Level Security. Avoid adding OpenAI API credentials to `index.html`, `gaia-config.js`, or other public files.

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
