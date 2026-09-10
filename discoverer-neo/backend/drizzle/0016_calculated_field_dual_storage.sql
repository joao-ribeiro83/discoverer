-- Phase 4.5 / D-055 — dual storage for calculated fields.
--
-- `map_calculated_fields.formula` is `readableFormula ?? tokens`: the token
-- form with `[6,n]`/`[8,n]` substituted for the names they point at, and every
-- `[1,n]` function code left as-is. That string is neither runnable nor
-- re-parseable — substituting a name like `R Com Tx Com Vig` into a token tree
-- destroys the bracket structure the tree was written in (decoder analysis C-8).
--
-- So the compiled expression cannot be derived from what we stored, and the
-- renderer could only ever be improved by re-migrating the estate. These
-- columns break that: `source_tokens` is the verbatim token form, and
-- `source_attrs.elementBindings` carries the element table's own name lookup,
-- so `dn-migrate verify` can recompile any row at any time from what is in the
-- target database alone.
--
-- The token form is provenance and is never overwritten by a compile run.

ALTER TABLE "map_calculated_fields"
  -- The verbatim `[class,id]` token string, exactly as the `.DIS` body held it.
  ADD COLUMN "source_tokens" text,
  -- The Oracle expression the renderer emitted, or NULL when it refused.
  ADD COLUMN "compiled_sql" text,
  -- D-059 bucket: COMPILED | COMPILED_UNVERIFIED | QUARANTINED | FAILED.
  -- NULL means "not compiled yet", which is a fifth state on purpose: a row
  -- that has never been through a compile run must not read as a clean one.
  ADD COLUMN "compile_status" varchar(32),
  -- Why the row is quarantined or failed. NULL on a compiled row.
  ADD COLUMN "compile_reason" text;

-- The partition is grouped by status on every verify run and read by the
-- refusal UI per map; both are covered by this.
CREATE INDEX "map_calculated_fields_compile_status_idx"
  ON "map_calculated_fields" ("compile_status");
