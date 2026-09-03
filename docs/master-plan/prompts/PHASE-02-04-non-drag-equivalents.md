# PHASE 2.4 — Non-drag equivalents

**Model:** Sonnet · **Effort:** medium

> ## ⚠ WHY THIS STAGE EXISTS
>
> **A keyboard-only user cannot build a report in this product at all.**
>
> The only way to add a field to a map is to drag it. `BusinessAreaTree.tsx:346-373` spreads
> `useDraggable`'s `{...listeners} {...attributes}` directly onto a plain `<div>` — no button, no
> double-click, no context menu, no "Add" affordance anywhere.
>
> A `KeyboardSensor` **is** configured on the page-level `DndContext`
> (`MapBuilderPage.tsx:273-275`), but it serves `useSortable` reordering *within* the canvas.
> There is no keyboard route from an unrelated `useDraggable` source tree into a separate
> `useDroppable` region.
>
> This is **WCAG 2.5.7 (Dragging Movements)**, on the single core interaction of an enterprise
> BI tool that is replacing a fifteen-year incumbent.
>
> **And no existing gate can catch it.** The accessibility coverage in this repository is
> genuinely good — `@axe-core/playwright` is a real dependency, `e2e/accessibility.spec.ts`
> sweeps 9 pages, and the builder and viewer carry their own `AxeBuilder` assertions
> (`map-builder.spec.ts:135`, `map-viewer.spec.ts:74`). **`axe` cannot detect a drag barrier.**
> Phase 2.3's gate — *"Accessibility E2E passes in CI"* — passes over this defect completely.
>
> That is why this stage exists separately, and why its gate is deliberately **not** an axe
> assertion.

## Purpose

Give every drag-only interaction a non-drag equivalent, and gate it with a test that a green axe
run cannot fake.

## Scope

### 1. Adding a field from the source tree

`BusinessAreaTree.tsx` — each draggable row gains a keyboard- and pointer-accessible **Add**
control. Minimum viable: a real `<button>` with an accessible name naming the field, which adds
the item to the canvas at the end of the current field well.

Where more than one target exists (columns vs rows vs measures), the control needs a target
choice — a small menu, or an Add button per well. **Do not build a drag-anywhere canvas**
(D-103): the governed field-well model is correct and is the thing being migrated. This stage
adds a second *route* to the same governed action, not a second model.

### 2. Audit the rest of the builder for the same pattern

`dnd-kit` is used in more than one place. Find every `useDraggable` / `useSortable` and confirm
each has a non-drag equivalent:

- reordering within a field well (`useSortable` — the `KeyboardSensor` may already cover this;
  **verify by test, not by reading**)
- removing an item
- moving an item between wells
- any panel that reorders (Sort, Conditions, Parameters)

Record which already work. Some will.

### 3. Focus and announcement

- Every new control has an accessible name that identifies **which field** it acts on — not
  "Add", but "Add Widget Price".
- Adding an item moves focus somewhere sensible and announces the result, so a screen-reader user
  knows it worked. A silent success is the same class of defect as D-102's silent failure.

## Prerequisites

Phase 2.2 — the builder and viewer are wired and their error states exist. This stage changes
interaction, and it needs a working page to change.

## Required files to read first

- `frontend/src/components/map-builder/BusinessAreaTree.tsx` — **`:346-373` is the defect**
- `frontend/src/pages/MapBuilderPage.tsx:260-290` — the `DndContext` and its sensors
- `frontend/src/components/map-builder/MapCanvas.tsx` — the drop targets
- `frontend/src/store/mapBuilder.ts:330-350` — `addItem`, the action both routes must share
- `frontend/e2e/map-builder.spec.ts` — the existing spec this stage extends
- `docs/master-plan/DECISION_REGISTER.md` D-103 (governed, not free-form)

## Required tooling

**Skills:** none. **Agents:** none — single-context work.
**Plugins / MCPs:** `Claude_Browser` (the verification loop for every UI change — these defects
are invisible in source review), `playwright` (**the gate**).

## Implementation instructions

- **Both routes call the same store action.** `addItem` already carries the
  `duplicate` / `cross-business-area` guards (`store/mapBuilder.ts:338-347`); a second entry
  point that bypasses them would be a new bug.
- Use a real `<button>`. Do not put a click handler on a `<div>` and add `role="button"` — the
  existing code already gets this right elsewhere (**all 8 `size="icon"` buttons in the app carry
  `aria-label` or an `sr-only` span**; match that standard).
- Keep the drag path exactly as it is. This stage **adds**; it does not replace.
- All four locales (`en`, `es-ES`, `fr-FR`, `pt-PT`) get the new strings in the same change —
  §9 requires them to stay in sync, and `scripts/i18n-check.mjs` gates it.

## Tests

- [ ] **A Playwright spec builds a two-column map using only the keyboard.** No `mouse`, no
      `dragTo`, no `click` with coordinates. Tab, Enter, arrow keys.
- [ ] A spec asserts each new control has an accessible name identifying its field.
- [ ] The existing drag specs still pass — the drag path is unchanged.

## Security checks

None specific. This stage adds no new data path; both routes call the same guarded store action.

## Validation

```bash
cd discoverer-neo && npm run test:e2e --workspace frontend
```

Then, with `Claude_Browser`: tab to the source tree, add a field with the keyboard, and confirm
it appears on the canvas and focus lands somewhere sensible.

## Acceptance criteria

- [ ] **A keyboard-only user can build a two-column map**, proven by a passing Playwright spec
- [ ] Every `useDraggable` / `useSortable` in the builder has a non-drag equivalent, or is
      recorded as already keyboard-reachable **with the test that proves it**
- [ ] New controls carry field-identifying accessible names
- [ ] All four locales carry the new strings; `i18n-check` passes
- [ ] The drag path is unchanged and its specs still pass

## Documentation updates

- `docs/user-guide/` — a short "keyboard shortcuts" section for the builder
- `docs/developer-guide/` — the rule: **any new `useDraggable` ships with a non-drag equivalent
  and a keyboard spec.** Without the rule written down, this regresses on the next feature

## Git checkpoint

One commit. Message naming WCAG 2.5.7 and the review finding, so the reason survives.

## Handover artefacts

- The list of drag interactions found, and which already had keyboard equivalents
- The keyboard-only spec, named so a future session can find it

## Explicitly out of scope

- **A drag-anywhere canvas.** D-103 refuses it, and correctly — the governed semantic layer is
  the thing being migrated.
- Visual redesign. The design system, three themes and four locales are **protected**.
- A full WCAG audit. This stage closes one specific, blocking barrier; a broader accessibility
  pass is scheduled after Phase 7.
- The five routes with no axe assertion — that is Phase 2.3's corrected gate.

## Resume instructions

Read the checkpoint. If the keyboard-only Playwright spec exists and passes, this stage is
done — go to `PHASE-03-01-populate-measure-set.md`. If the Add controls exist but the spec does
not, **write the spec before closing the stage** — without it this regresses silently, exactly as
it did before.

## TOKEN-BUDGET SAFE EXECUTION

1. Read `BusinessAreaTree.tsx` and `MapBuilderPage.tsx`'s `DndContext` first. Then write.
2. **No specialist agents.**
3. Verify in the browser as you go; do not batch verification to the end.
4. **Checkpoint on progress, not only on completion.**
5. One commit.
