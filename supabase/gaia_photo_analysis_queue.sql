-- GAIA private photo visual-review queue.
-- New uploads default to pending. A review must only be completed after actual image pixels are inspected.
alter table public.plant_photos
  add column if not exists analysis_status text not null default 'pending',
  add column if not exists analysis_summary text not null default '',
  add column if not exists analysis_findings jsonb not null default '[]'::jsonb,
  add column if not exists analysis_confidence numeric,
  add column if not exists analyzed_at timestamptz,
  add column if not exists analysis_source text;

alter table public.plant_photos
  drop constraint if exists gaia_photo_analysis_status_check,
  add constraint gaia_photo_analysis_status_check
    check (analysis_status in ('pending','reviewed','needs_attention','unavailable')),
  drop constraint if exists gaia_photo_analysis_summary_check,
  add constraint gaia_photo_analysis_summary_check
    check (length(analysis_summary) <= 1500),
  drop constraint if exists gaia_photo_analysis_findings_array_check,
  add constraint gaia_photo_analysis_findings_array_check
    check (jsonb_typeof(analysis_findings) = 'array'),
  drop constraint if exists gaia_photo_analysis_confidence_check,
  add constraint gaia_photo_analysis_confidence_check
    check (analysis_confidence is null or (analysis_confidence >= 0 and analysis_confidence <= 1)),
  drop constraint if exists gaia_photo_analysis_source_check,
  add constraint gaia_photo_analysis_source_check
    check (analysis_source is null or length(analysis_source) <= 80);

comment on column public.plant_photos.analysis_status is
  'Visual review queue state. New uploads default to pending; automated review may set reviewed, needs_attention, or unavailable.';
comment on column public.plant_photos.analysis_summary is
  'Short evidence-based visual assessment. Empty until actual image pixels have been inspected.';
comment on column public.plant_photos.analysis_findings is
  'Structured visual findings only; must not contain inferred care events or unverified diagnoses.';
comment on column public.plant_photos.analysis_confidence is
  'Optional 0-1 confidence for the visual assessment.';
comment on column public.plant_photos.analyzed_at is
  'Timestamp when image pixels were actually inspected.';
comment on column public.plant_photos.analysis_source is
  'Reviewer source, e.g. ChatGPT GAIA Daily Plant Review.';