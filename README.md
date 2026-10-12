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

## Recovery

GitHub retains file revision history. If an update breaks something, previous commits can be used to restore a working version.
