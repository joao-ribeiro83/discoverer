-- Phase 9.1 — the values behind a compiled calculation's literal binds.
--
-- The Phase 4 renderer writes every literal as a bind (D-054), and
-- `compiled_sql` kept only the placeholders: 5 178 migrated calculations could
-- never run (ORA-01008, "not all variables bound"). `dn-migrate verify
-- --compile` writes the values here, keyed by bind name.

ALTER TABLE "map_calculated_fields" ADD COLUMN "compiled_binds" jsonb;
