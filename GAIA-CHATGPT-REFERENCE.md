# GAIA — ChatGPT read-only reference

This repository includes a scheduled, **read-only** snapshot of the GAIA plant collection, intended for analysis and care recommendations without editing records or relying on paid vision API calls.

## Read the collection

- **Plant facts, dates, care observations and review metadata:** `gaia-reference/snapshot.json`
- **All uploaded photo history:** `gaia-reference/photos/`. Each entry in a plant's `photos` list has a `snapshot_image` path. The most recent two are also available under `latest_photo.snapshot_image` and `previous_photo.snapshot_image`.
- **Original catalog photos:** Each plant's `reference_image` points to its existing image in the repository when available. A catalog reference is **not** a private photo-journal upload.
- **Live browser gallery:** `private-view.html` (requires its separate viewing link and is not a reliable machine-readable source)

The snapshot is **not live**: check `synced_at` and `generated_at`. If a watering event, pot profile, or moisture check is missing, say **not recorded or not synced**, not that it never happened.

## Activate automatic updates (one-time setup)

1. In the GitHub repository, open **Settings → Secrets and variables → Actions**.
2. Add repository secret `GAIA_VIEW_TOKEN` with the access-token value from the existing GAIA viewer link (the portion after `access=`). Never commit this token into a file.
3. Open **Actions → Publish GAIA read-only reference → Run workflow** to create the first snapshot. Check `uploaded_photo_count` against `exported_photo_count`; they must match.
4. Subsequent updates run four times daily and after reference exporter/catalog changes. The workflow commits refreshed JSON and EXIF-stripped, resized WebP images. You may rerun it manually for a fresher reference.

Until the secret is configured, the scheduled workflow skips publication instead of failing.

## Security and interpretation

- The exported content and photos will be visible to anyone who can read the GitHub repository (and on public GitHub Pages). This export includes user-approved plant notes and photos, but **does not export Supabase keys, viewing tokens, account IDs, or write-capable credentials**.
- Supabase's owner-only edit permissions are not modified by this export.
- Every photo-review status represents its saved record; `pending` is not an analysis. No ChatGPT image inspection occurs as part of the sync.
- For plant decisions, compare the two photo files yourself and integrate actual dates, species, last watering and measured moisture readings from the snapshot.
- The export only contains cloud-synced care records. Measurements still on a local device must be synced to GAIA before appearing here.

Exporter: `scripts/gaia_reference_snapshot.py`. Workflow: `.github/workflows/gaia-readonly-snapshot.yml`.
