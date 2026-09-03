# PHASE 2.3 — Dashboard truth pass

**Model:** Sonnet · **Effort:** medium

## Purpose

Stop the product lying about itself, and get the accessibility suite running in CI.

> The dashboard renders **developer apology notes inside `<h*>` elements where KPI numbers
> belong**:
>
> | Card | Rendered "value" |
> | ---- | ---------------- |
> | Total Executions | *"No workspace-wide execution count endpoint exists yet — see each map's history for its own runs."* |
> | Scheduled Maps | *"Scheduling has not been built yet."* |
> | Data Sources | *"See Admin -> Data Sources for the full list."* |
> | Scheduled Results | *"Scheduling isn't available yet — this section will populate once schedules ship."* |
>
> The scheduling text is **factually wrong**: `routes/schedules.ts`, `scheduler.service.ts`
> (816 lines) and `SchedulesPage.tsx` (727 lines) all exist, and `/schedules` is in the
> navigation.
>
> Worse: `frontend/src/__tests__/dashboard.test.tsx:93` **asserts** that string — **the test
> suite locks the placeholder in as correct behaviour.**

## Scope

1. **Implement or remove.** For each of the four cards: build the endpoint, or delete the card.
   A card that explains its own absence is worse than no card.
2. **Delete `dashboard.test.tsx:93`** and any sibling assertion pinning placeholder text
   (F-30). *A test should pin behaviour that is wanted, not behaviour that is merely current.*
3. Fix the raw ASCII `->` in shipped copy.
4. **F-26** — the login form exposes two controls for one checkbox: a shadcn button-checkbox
   *and* an exposed native input announced as **"on"**. A screen-reader user hears a
   duplicated, unlabelled control. **The pattern likely repeats wherever the `Checkbox`
   primitive is used — grep for it.**
5. Fix the dashboard's "Total Maps 0" against 923 maps — Phase 1.2's `scope=all` supplies the
   real number.
6. **Get the 9 Playwright E2E specs running in CI**, including `accessibility.spec.ts`. They
   have never executed in an automated context because CI has never run.

## Prerequisites

Phase 2.2. Phase 0.1 (CI runs at all).

## Required files to read first

- `docs/master-plan/research/ux-analysis.md` §4 rules R1, R2, R5 and §6 — **the authoritative
  brief**
- `AUDIT_UI_UX_ASSESSMENT.md` §3.3, §5
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/__tests__/dashboard.test.tsx` (especially line 93)
- `frontend/src/components/ui/checkbox.tsx` and `frontend/src/components/auth/`
- `frontend/e2e/` — all 10 files
- `.github/workflows/ci.yml`

## Required tooling

**Skills:** none required.
**Agents:** none.
**Plugins / MCPs:** `Claude_Browser` (verify the rendered result), `playwright` (**essential**
— wiring the E2E suite into CI is half this stage).

## Implementation instructions

- **Recommended per card:** implement the workspace execution count (`query_execution_log`
  exists and Phase 1 starts populating it); **remove** the "Data Sources" card, which is a
  navigation hint, not a metric; **implement** Scheduled Maps and Scheduled Results — the API
  exists.
- Rule R2 applies here too: if a real number is zero, say zero — do not invent prose.
- For the checkbox: use the shadcn primitive **or** the native input, never both. Fix the
  primitive so every consumer is fixed at once (root cause, not the login page alone).
- E2E in CI needs a service container for Postgres and a built frontend. `ci.yml` already
  defines a Postgres service for the backend job — extend rather than duplicate.

## Tests

- The dashboard renders **numbers**, not prose
- The removed cards are gone from the DOM
- `dashboard.test.tsx` no longer asserts placeholder text
- The login checkbox exposes **one** control with an accessible name
- **All 9 Playwright specs run in CI**

## Security checks

- The dashboard aggregates must respect entitlement — a non-admin's counts must reflect only
  what they may see. **Do not add an unscoped count endpoint.**

## Validation

```bash
cd discoverer-neo/frontend && npx vitest run && npx playwright test
```

Then `Claude_Browser`: log in, read the dashboard's accessibility tree, confirm no `<h*>`
contains a sentence.

## Acceptance criteria

- [ ] **No `<h*>` in the dashboard contains prose**
- [ ] The scheduling card reflects that scheduling **exists**
- [ ] "Total Maps" shows 923, not 0
- [ ] `dashboard.test.tsx:93` and any sibling placeholder assertions are gone
- [ ] The login checkbox exposes one accessible control; the `Checkbox` primitive is fixed at
      the root
- [ ] The ASCII `->` is gone
- [ ] **All 9 E2E specs run in CI and `accessibility.spec.ts` passes**

## Documentation updates

- `docs/developer-guide/testing.md` — E2E in CI
- `docs/user-guide/getting-started.md` — what the dashboard shows
- All four locales

## Git checkpoint

One commit per numbered item; the E2E CI wiring separately. Push.

## Handover artefacts

- A dashboard screenshot
- The E2E CI run URL
- A note recording whether the `Checkbox` defect appeared elsewhere

## Explicitly out of scope

- A full accessibility audit — keyboard traversal, dialog focus management, contrast across
  three themes, and **virtualised-grid screen-reader behaviour** (a known hard case) are a
  dedicated later pass. Record findings; do not fix them all here.
- Design-token work. After Phase 7.
- Bulk operations, saved views, column pinning. Phase 7.3 and later.

## Resume instructions

Read the checkpoint, open the dashboard, and check CI for an E2E job. Resume at the first
unchecked criterion.

## TOKEN-BUDGET SAFE EXECUTION

1. Cards first, then the checkbox, then CI wiring. Commit each.
2. **No specialist agents.**
3. Verify in the browser after each card.
4. Checkpoint after each commit.
5. Commit coherently.
6. Leave CI green including the new E2E job.
7. If interrupted, record which cards are resolved and whether E2E runs.

---

## ⟐ CORRECTIONS from the plan review (E-04 / E-06 / A-13 / D-08)

### 1. The gate is wrong — it would pass on the code unchanged

v1.0's gate is *"No `<h*>` in the dashboard contains prose."* **That is not the mechanism.**
`DashboardPage.tsx:58-64, 71-77, 83-89` renders a literal **em-dash `—`** as the KPI value, with
the reason hidden in a **`title` attribute** (*"No workspace-wide execution count endpoint exists
yet…"*, *"Scheduling has not been built yet."*). An em-dash is not prose, so the stated gate
passes while three of four KPI cards show nothing — and the explanation is invisible on touch
devices and unannounced by screen readers.

**Replacement gate:**

- [ ] **Every KPI slot shows a real number, or the card is removed.** No em-dash, no placeholder
      string, and **no explanation hidden in a `title` attribute** — explanatory text is visible
      copy or it does not exist.

### 2. The test pins the placeholder on TWO lines, and one is a locale key

`frontend/src/__tests__/dashboard.test.tsx`:

- `:92` asserts `/No maps yet/` — **the empty state D-101/R2 explicitly forbids** (it must say
  *"N worksheets exist; none are shared with you"*). v1.0 named only line 93, so deleting that
  alone leaves the test enforcing the untruthful empty state.
- `:93` asserts `/Scheduling isn.t available yet/`, sourced from
  `frontend/src/locales/en/mapViewer.json:37` — and **backend scheduling already exists and is
  tested** (`schedules.test.ts`, `scheduler.test.ts`, `integration/export-scheduling.test.ts`).

**Scope:** rewrite the empty-state assertion to the truthful copy; delete the scheduling
assertion **and its key from all four locale files** (`en`, `es-ES`, `fr-FR`, `pt-PT`). Section
9 requires the locales stay in sync — this is a four-file change, not a one-line delete.

### 3. The accessibility gate is satisfied while five routes are unexamined

Axe coverage is **better than the plan credits**: `@axe-core/playwright` is a real dependency,
`e2e/accessibility.spec.ts` sweeps 9 pages, and `map-builder.spec.ts:135`,
`map-viewer.spec.ts:74`, `admin-business-areas.spec.ts`, `admin-data-sources.spec.ts` and
`login.spec.ts` each carry their own `AxeBuilder` assertions.

**Not covered:** `/admin/security`, `/admin/audit`, `/admin/migration`, `/settings`,
`/change-password`. The security-policy editor — which Phase 6.3 makes load-bearing — has no
accessibility check at all.

**Replacement gate:**

- [ ] **Every route in `App.tsx` has an axe assertion.** Name the five above explicitly.

> **And note what axe cannot see.** The builder's core interaction is drag-only and excludes
> keyboard users entirely (review R-06). That is **Phase 2.4's** problem, gated by a
> keyboard-only Playwright spec, because no axe assertion can detect it. Do not treat a green
> axe run as an accessibility pass.
