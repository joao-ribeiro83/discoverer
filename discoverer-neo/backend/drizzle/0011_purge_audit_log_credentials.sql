-- Redact credentials already written to audit_log.
--
-- The audit hook used to redact only EXACT key names, so `passwordEnc` (the
-- Oracle password, which reaches the API as plaintext) and `newPassword` were
-- stored in the clear. The hook was fixed first; this rewrites the history it
-- left behind.
--
-- Values are redacted IN PLACE, not deleted: an audit trail whose rows vanish
-- is a worse audit trail than one whose secrets are starred out.
--
-- Re-runnable. The UPDATE only touches rows the redactor would actually
-- change, so a second run is a no-op even where the first already ran.

CREATE OR REPLACE FUNCTION redact_audit_details(doc jsonb, depth integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  result jsonb;
  k text;
  v jsonb;
BEGIN
  -- Same depth ceiling as the redactor in backend/src/plugins/audit.ts.
  IF doc IS NULL OR depth > 6 THEN
    RETURN doc;
  END IF;

  IF jsonb_typeof(doc) = 'object' THEN
    result := '{}'::jsonb;
    FOR k, v IN SELECT * FROM jsonb_each(doc) LOOP
      -- Separators stripped before matching, so api_key matches apikey —
      -- mirrors isSensitiveKey().
      IF regexp_replace(lower(k), '[^a-z0-9]', '', 'g')
           ~ '(password|secret|token|credential|apikey|authorization)' THEN
        result := result || jsonb_build_object(k, '[REDACTED]');
      ELSE
        result := result || jsonb_build_object(k, redact_audit_details(v, depth + 1));
      END IF;
    END LOOP;
    RETURN result;
  END IF;

  IF jsonb_typeof(doc) = 'array' THEN
    RETURN coalesce(
      (SELECT jsonb_agg(redact_audit_details(e, depth + 1))
         FROM jsonb_array_elements(doc) AS e),
      '[]'::jsonb
    );
  END IF;

  RETURN doc;
END;
$fn$;
--> statement-breakpoint

UPDATE audit_log
   SET details = redact_audit_details(details)
 WHERE details IS NOT NULL
   AND redact_audit_details(details) IS DISTINCT FROM details;
--> statement-breakpoint

DROP FUNCTION redact_audit_details(jsonb, integer);
