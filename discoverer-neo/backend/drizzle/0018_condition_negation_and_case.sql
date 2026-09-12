-- Phase 5.3b — the 80% version of P9 is one boolean (ARCH M1).
--
-- Measured over all 3 395 source condition trees: depth 0 = 92.6%, depth 1 =
-- 7.3%, depth 2 = 7 instances, depth >= 3 = zero. The existing flat group_id +
-- logic_operator model already covers everything up to depth 2. The real
-- ceiling was NOT — Oracle's own `DCBImportedFilterNode::IsNot` — which the
-- parser refused outright rather than drop. This closes that on the schema
-- side; the parser's refusal is closed separately.
--
-- `negated` is per-node: it applies to the row it sits on, never to the group
-- the row belongs to. Negating a whole group would change which rows the
-- OTHER rows in it match.
--
-- `case_sensitive` stores what the parser has always read (`Case Sensitive`,
-- tag 0x0102) and never had a column to land in. Oracle's own default for a
-- text comparison is case-sensitive, so that is this column's default too.

ALTER TABLE "map_conditions"
  ADD COLUMN "negated" boolean DEFAULT false NOT NULL,
  ADD COLUMN "case_sensitive" boolean DEFAULT true NOT NULL;
