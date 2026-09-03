-- Bind-safe parameter names.
--
-- `map_parameters.name` is the prompt a Discoverer author typed, and they typed
-- whatever they liked: `Dt Fim Vigência >=`, `Apólice nº`, `VALOR SUPERIOR A`.
-- The SQL generator bound that string verbatim, so any map filtering on such a
-- parameter threw before it could run — 2805 of 4481 parameter conditions on
-- the migrated EUL.
--
-- `bind_name` is the Oracle identifier the parameter binds as, derived from
-- `name` and unique per map. `map_conditions.param_name` stops carrying the
-- display name and carries this instead; the display name stays in
-- `map_parameters.name` as the prompt the user sees.
--
-- The derivation below is the third copy of `makeBindName` — the others are in
-- `backend/src/lib/sql/identifiers.ts` and, because the packages share no code,
-- `migrate/src/services/transformers/transform.ts`. All three must move
-- together; the shared case table in `backend/src/__tests__/identifiers.test.ts`
-- and `migrate/src/__tests__/transformers.test.ts` is what catches it if they
-- do not.

ALTER TABLE "map_parameters" ADD COLUMN "bind_name" varchar(30);--> statement-breakpoint

CREATE FUNCTION "__dn_0008_bind_base"(label text) RETURNS text AS $fn$
DECLARE
  b text;
BEGIN
  b := regexp_replace(upper(coalesce(label, '')), '[^A-Z0-9_]+', '_', 'g');
  b := regexp_replace(b, '^_+', '');
  b := regexp_replace(b, '_+$', '');
  b := left(b, 26);
  IF b = '' THEN
    RETURN 'P';
  ELSIF b !~ '^[A-Z]' THEN
    RETURN left('P_' || b, 26);
  END IF;
  RETURN b;
END
$fn$ LANGUAGE plpgsql IMMUTABLE;--> statement-breakpoint

DO $mig$
DECLARE
  target_map uuid;
  param record;
  taken text[];
  orphans text[];
  orphan text;
  base text;
  candidate text;
  n integer;
BEGIN
  FOR target_map IN
    SELECT map_id FROM map_parameters
    UNION
    SELECT map_id FROM map_conditions WHERE param_name IS NOT NULL
  LOOP
    taken := ARRAY[]::text[];

    -- 1. Every parameter of this map gets a bind name, uniquified in insert
    --    order. Any order would do — conditions are pointed at whatever this
    --    assignment produces — but a stable one keeps the migration repeatable.
    FOR param IN
      SELECT id, name FROM map_parameters
      WHERE map_id = target_map
      ORDER BY created_at, id
    LOOP
      base := "__dn_0008_bind_base"(param.name);
      candidate := base;
      n := 2;
      WHILE candidate = ANY (taken) LOOP
        candidate := left(base, 26 - length('_' || n)) || '_' || n;
        n := n + 1;
      END LOOP;
      taken := taken || candidate;
      UPDATE map_parameters SET bind_name = candidate WHERE id = param.id;
    END LOOP;

    -- 2. Point each PARAMETER condition at its parameter's new bind name.
    UPDATE map_conditions c
    SET param_name = p.bind_name
    FROM map_parameters p
    WHERE p.map_id = c.map_id
      AND p.name = c.param_name
      AND c.map_id = target_map
      AND c.param_name IS NOT NULL;

    -- 3. Whatever step 2 did not match names no declared prompt. A condition
    --    whose text already *is* a bind name is left alone — that is how the
    --    references Discoverer resolved case-insensitively land on the right
    --    parameter (a condition on `RAMO` against a prompt declared `Ramo`;
    --    all 17 such rows on the migrated EUL resolve this way). Anything
    --    still unmatched is a prompt the workbook never declared: it gets a
    --    bind name derived the same way and uniquified against the same set,
    --    so it stays undeclared but is at least nameable in SQL instead of
    --    poisoning every other filter on the map. Collected up front so the
    --    rewrite cannot match a row it already rewrote.
    SELECT coalesce(array_agg(DISTINCT c.param_name ORDER BY c.param_name), ARRAY[]::text[])
    INTO orphans
    FROM map_conditions c
    WHERE c.map_id = target_map
      AND c.param_name IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM map_parameters p
        WHERE p.map_id = target_map AND p.bind_name = c.param_name
      );

    FOREACH orphan IN ARRAY orphans LOOP
      base := "__dn_0008_bind_base"(orphan);
      candidate := base;
      n := 2;
      WHILE candidate = ANY (taken) LOOP
        candidate := left(base, 26 - length('_' || n)) || '_' || n;
        n := n + 1;
      END LOOP;
      taken := taken || candidate;
      UPDATE map_conditions
      SET param_name = candidate
      WHERE map_id = target_map AND param_name = orphan;
    END LOOP;
  END LOOP;
END
$mig$;--> statement-breakpoint

DROP FUNCTION "__dn_0008_bind_base"(text);--> statement-breakpoint

ALTER TABLE "map_parameters" ALTER COLUMN "bind_name" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "map_parameters_map_bind_idx" ON "map_parameters" USING btree ("map_id","bind_name");
