# GAIA — Plant Collection Dashboard

**Live site:** https://reece1919.github.io/gaia/

GAIA tracks a collection of 45 plants with photos, current health, care instructions, follow-up priorities, and care history. The site is published with GitHub Pages from the `main` branch.

## How the website works

- **`index.html`** holds the page layout and styles.
- **`plants.json`** is the source of truth for plant records and the recent-care summary. It contains all 45 plant profiles, their care sections, health labels, tags, and history.
- **`app.js`** loads `plants.json`, builds the plant cards, updates the collection counts, and powers the search and filters.
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

GAIA currently reads static data from GitHub. It does **not** yet write watering checkoffs made in the browser back to the repository or synchronize them across devices. Any such write/sync feature will need additional development. The GitHub Pages site and the repository are **public**; avoid storing sensitive personal information.


## Interactive care journal

The dashboard now supports **Watered, Fertilized, Repotted, Pest treatment**, plus dated **Foliage bath, Inspected, Pruned, and Observation** records. Open any plant card and use the quick buttons to log today's action, or open "Add dated entry or note" to backdate an event or include details. Entries appear in the plant's care log, can be undone, and can be exported to a JSON backup.

### Data storage and synchronization

- By default, entries are saved in **this browser's localStorage**, not in GitHub. They persist across reloads on that device, but **do not synchronize** across devices or browsers.
- **Supabase sync is optional and not enabled until the following setup is completed.** Do not claim cloud sync is working before completing and testing it.
- The cloud table holds **care events only**; plant profiles continue to be edited in `plants.json` via GitHub. Existing static care history remains available.
- The public GitHub repository includes a safe template `gaia-config.js` with blank values. Do **not** put a Supabase service-role, secret key, or database password in public files.

### Enable private cross-device sync with Supabase

1. Create/select a Supabase project under your account.
2. Run the SQL in [`supabase/gaia_care_events.sql`](supabase/gaia_care_events.sql) in the **Supabase SQL Editor**. This creates `plant_care_events`, enables Row Level Security, and allows authenticated users to read/write **only their own entries**. Never disable RLS for this table.
3. In Supabase Authentication URL Configuration, use `https://reece1919.github.io/gaia/` as the Site URL and add `https://reece1919.github.io/gaia/**` as an allowed Redirect URL. Enable email OTP/magic-link authentication. You can restrict account registration once your account is established.
4. In Supabase Project Settings → API, copy the **project URL** and the **publishable key / legacy anon key** (public, browser-safe key only). Put these in `gaia-config.js` under `url` and `anonKey`. Never use service-role or secret keys.
5. Commit the change, allow GitHub Pages to deploy, open GAIA on your device, then use **Sync, account & backup → Email me a sign-in link** and sign in with your email.
6. Test by recording a care activity on one device and signing into the same account on a different device. Tap **Sync journal** if it doesn't appear immediately. This is refresh/manual synchronization, not realtime push.
7. If you logged entries before cloud setup, select **Import earlier device entries** after signing in. It copies existing device-only entries into your account; it doesn't delete the local backup.

### Recovering care entries

The **Export journal backup** button downloads the current visible journal in JSON. Keep backups if you're using device-only storage or before clearing browser/site data. Device-only entries may be lost if the browser storage is cleared or you use a private browsing window.

## Editing the site

## Recovery

GitHub retains file revision history. If an update breaks something, previous commits can be used to restore a working version.
