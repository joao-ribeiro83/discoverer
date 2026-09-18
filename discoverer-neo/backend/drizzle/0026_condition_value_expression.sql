-- A Discoverer condition can compare against an EXPRESSION, not just a value:
-- `Data Comparacion <= TO_DATE(:Dt Fim,'DD-MON-RRRR') + 0.99999` is the "to the
-- end of that day" idiom, and the commonest filter the reference estate writes.
--
-- Neo's row could hold an expression on the LEFT (as a hidden calculated field)
-- and nothing but a literal or a bind on the right, so the whole condition was
-- dropped: 205 filters across 152 of 923 maps. A dropped filter is not a
-- visible failure — the map still runs, and returns more rows than Discoverer
-- did, with nothing to say so.
--
-- This is the symmetric column. Same storage as the left side, same cascade.

ALTER TABLE "map_conditions" ADD COLUMN "value_calculated_field_id" uuid;--> statement-breakpoint
ALTER TABLE "map_conditions" ADD CONSTRAINT "map_conditions_value_calculated_field_id_fkey" FOREIGN KEY ("value_calculated_field_id") REFERENCES "public"."map_calculated_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- The filters a map lost, so the viewer can say the result is under-filtered
-- rather than letting it read as complete. One object per dropped condition:
-- {"text": "<the condition as Discoverer wrote it>", "reason": "<why>"}.
ALTER TABLE "maps" ADD COLUMN "dropped_filters" jsonb;
