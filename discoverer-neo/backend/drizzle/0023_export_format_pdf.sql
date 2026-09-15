-- Phase 7.3 — add PDF as a third interactive export format, honoring
-- map_page_setup's orientation/margins/header/footer/grid-line settings
-- (a row exists per map from migration, but every field but the source
-- element id is null — see Decision 13; PDF defaults sensibly when so).
--
-- `export_format` also backs schedules.output_format, but schedule creation
-- still only accepts 'XLSX' | 'CSV' (see routes/schedules.ts) — this value
-- is for interactive/export_jobs use only.

ALTER TYPE "export_format" ADD VALUE 'PDF';
