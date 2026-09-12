-- Phase 6.1 / SEC-01 — an account can be deactivated without being deleted.
--
-- The admin guide described an Active/Inactive toggle that had no column
-- behind it. The auth guard and the refresh route read this on every call,
-- so switching it off ends the account's session on its next request.

ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
