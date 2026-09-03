# Review E — UX Challenge

**Method.** `gsd-ui-auditor`, tight scope, eight closed questions — returned in full (83 387
tokens, 43 tool calls). All CRITICAL/HIGH claims re-verified inline by the main session.
The frontend-design capability was **not** invoked: §5 permits it *"only if the first review
reveals a substantive design gap"*, and the gaps found are absence, correctness and
accessibility, not visual design.

**Headline.** The plan's Phase 2 is aimed correctly, but it under-scopes three things and misses
two entirely — and one of the misses (the builder's drag-only field selection) is a hard
accessibility barrier that no automated sweep can detect and that the plan's own accessibility
gate would pass over.

---

## E-01 · The query builder's core interaction has no keyboard path

- **Severity:** CRITICAL
- **Phase/Stage:** not in any phase · D-103 · §6 "Accessibility"
- **Type:** MISSING

**Finding.** The only way to add a field to a report is to drag it:
`src/components/map-builder/BusinessAreaTree.tsx:346-373` spreads `useDraggable`'s
`{...listeners} {...attributes}` directly onto a plain `<div>`. There is no button, no
double-click, no context menu, no "Add" affordance. A `KeyboardSensor` is configured on the
page-level `DndContext` (`MapBuilderPage.tsx:273-275`), but it serves `useSortable` reordering
*within* the canvas — there is no keyboard route from an unrelated `useDraggable` source tree
into a separate `useDroppable` region.

**A keyboard-only or motor-impaired user cannot build a report at all.** This is WCAG 2.5.7
(Dragging Movements) and it is invisible to `axe` — which is why the existing, genuinely good
axe coverage passes over it.

**Why the plan misses it.** §6 lists *"Accessibility — 2.3, then a dedicated pass"*, and 2.3's
gate is *"Accessibility E2E passes in CI"*. That gate is satisfied by the axe suite, which
cannot see this. D-103 (*"the current structured builder is right"*) is correct about the
governance model and is being read as a clean bill of health for the interaction model.

**Recommendation.** Add to the plan as a stage — **2.4, or a scope item in 7.3** — *"every
drag-only interaction gains a non-drag equivalent."* Minimum: an "Add" button on each tree row
and a keyboard-reachable target selector. Add a gate that is not axe: *a Playwright spec builds
a two-column map using only the keyboard.* Correct §6's accessibility row to say the axe suite
does not cover drag interactions.

---

## E-02 · There is no error boundary, and every route renders `Suspense fallback={null}`

- **Severity:** CRITICAL
- **Phase/Stage:** 2.2 · D-102
- **Type:** UNDER-ENGINEERING

**Finding.** Verified: `grep -rn "ErrorBoundary|componentDidCatch|getDerivedStateFromError" src/`
returns **nothing**. Every page is `lazy()`-loaded and wrapped in a single
`<Suspense fallback={null}>` (`src/App.tsx:67`).

Two failure modes, not one:
1. **Any render-time throw white-screens the whole application**, with no recovery UI. The plan
   has this — 2.2's *"a global error boundary"*.
2. **`fallback={null}` means route transitions have no loading state at all.** On a slow or
   flaky connection the user clicks a nav item and *nothing happens* — no spinner, no skeleton.
   If the dynamic `import()` fails outright, nothing happens permanently and no error is shown.

The second is a direct violation of D-102 (*"No silent failure. Every primary action has a
disabled state with a reason, a loading state, a success state and an error state"*) and of §6's
non-negotiable rule *"no silent failure"* — and the plan does not name it. It is also,
precisely, the shape of the defect the plan says let F-01 hide: *"Clicking Run produced no
network request, no console error, no toast and no loading state."* The same pattern is
one line above every route in the app.

**Recommendation.** Add to 2.2's scope explicitly: *"replace `Suspense fallback={null}` with a
route-level skeleton, and wrap the router in an error boundary that renders a recoverable
error — chunk-load failure included."* Add to 2.2's acceptance: *"a forced chunk-load failure
renders a retry, not a blank page."*

---

## E-03 · The error path bypasses i18n at every call site

- **Severity:** HIGH
- **Phase/Stage:** 2.2 · §9
- **Type:** MISSING

**Finding.** `src/lib/api.ts:54`:

```ts
export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (isAxiosError<{ error?: string }>(err)) return err.response?.data?.error ?? fallback
  return fallback
}
```

The fallback is a hard-coded English literal, and it is used across **28 files** — none passing
a translated fallback. Any failure without a `response.data.error` string — network drop,
timeout, non-JSON 5xx, CORS — renders English regardless of locale.

The locales themselves are genuinely complete: **1 100 keys each across all four**, exact
parity, with a CI gate (`scripts/i18n-check.mjs`). The plan's *"four complete locales… protect
them"* is verified correct. But key parity does not catch a string that never reaches the
locale files at all — and this is a Portuguese estate whose users will meet the English string
on exactly the failures that matter most.

**Two smaller instances:** `src/components/ui/dialog.tsx:43` and `sheet.tsx:60` hard-code
`<span className="sr-only">Close</span>` — screen-reader users on every locale hear English on
every dialog.

**Recommendation.** Add to 2.2's scope: *"`getErrorMessage` takes a required translated
fallback; the backend's `kind` taxonomy maps to locale keys, not to raw text."* Add to the §9
documentation programme: *"locale parity is necessary but not sufficient — add a lint or test
for user-facing string literals in `.tsx` outside `t()`."* This is the one place the plan's
otherwise-strong i18n position has a hole.

---

## E-04 · The dashboard's placeholder mechanism is an em-dash plus a `title` tooltip

- **Severity:** HIGH
- **Phase/Stage:** 2.3 · D-101
- **Type:** INCORRECT (the plan describes the wrong artefact)

**Finding.** The plan says the dashboard *"renders developer notes inside `<h*>` elements where
KPI numbers belong"*, and 2.3's gate is *"No `<h*>` in the dashboard contains prose."* The
actual mechanism is different:

`src/pages/DashboardPage.tsx:58-64, 71-77, 83-89` — three of the four KPI cards render a literal
em-dash **`—`** as the value, with the explanation hidden in a `title` attribute
(*"No workspace-wide execution count endpoint exists yet…"*, *"Scheduling has not been built
yet."*).

**The stated gate would pass on this code unchanged.** `—` is not prose. Meanwhile the reason is
in a tooltip that is invisible on touch devices and not announced by screen readers.

**Recommendation.** Restate 2.3's gate as the rule D-101 actually means: *"every KPI slot either
shows a real number or the card is removed. No em-dash, no `title`-attribute explanation, no
placeholder string."* And add: *"any explanatory text is visible copy, not a `title`
attribute."*

---

## E-05 · Phase 2.1 is smaller than the plan implies — the endpoint already exists

- **Severity:** LOW (good news, but it changes the estimate)
- **Phase/Stage:** 2.1
- **Type:** OVER-ESTIMATE

**Finding.** `frontend/src/lib/api.ts:267-268` already defines
`apiClient.maps.listByBusinessArea(businessAreaId)`, bound to the backend's
`GET /business-areas/:baId/maps`. It has **zero non-test call sites**.

So 2.1 — the plan's P0 unblocker, scoped `Sonnet · high` — is closer to wiring an existing
client method into a new page than to building a data layer. The 923-map visibility work in
1.2 (`GET /api/maps` gaining an `all` scope) remains real.

**Recommendation.** Note in 2.1's prompt that the client method exists, so a session does not
rebuild it. Effort **high → medium** is defensible.

---

## E-06 · Five admin pages have no accessibility assertion, including the security editor

- **Severity:** MEDIUM
- **Phase/Stage:** 2.3
- **Type:** MISSING

**Finding.** Axe coverage is **better than the plan credits** — `@axe-core/playwright` is a real
dependency, `e2e/accessibility.spec.ts` sweeps 9 pages, and `map-builder.spec.ts:135`,
`map-viewer.spec.ts:74`, `admin-business-areas.spec.ts`, `admin-data-sources.spec.ts` and
`login.spec.ts` each carry their own `AxeBuilder` assertions.

Not covered: `/admin/security`, `/admin/audit`, `/admin/migration`, `/settings`,
`/change-password`. The security-policy editor — the surface Phase 6.3 makes load-bearing — has
no a11y check at all.

2.3's gate *"Accessibility E2E passes in CI"* is satisfied while five pages are unexamined.
This is the same shape as B-03: a gate that passes without covering the thing it names.

**Recommendation.** Restate 2.3's gate as *"every route in `App.tsx` has an axe assertion"*, and
name the five. Add `/admin/security` to Phase 6.3's deliverables too, since 6.3 changes it.

---

## E-07 · The builder lets a user compose a query the backend will refuse

- **Severity:** HIGH
- **Phase/Stage:** 2.2 · 3.4 · D-036
- **Type:** MISSING

**Finding.** `src/store/mapBuilder.ts:338-347` guards `addItem` on **`businessAreaId` only** —
the rejection reasons are `'duplicate' | 'cross-business-area'` (`:199`). There is no
folder-level or join-path check. A user can freely combine items from two folders in the same
business area with no join between them.

There is also **no whole-map validate or preview** before Run: grep for `preview|dryRun|
validateQuery` finds only a single-formula test preview (`FormulaEditorDialog.tsx:296`) and a
parameter default preview (`ParametersPanel.tsx:59-68`).

**Why this compounds through the plan.** From Phase 1.1 onward, multi-folder aggregate maps
**refuse**. From Phase 3.3, the planner adds four more refusal rules plus the re-aggregation
refusals — and per B-01, if the join flags are absent, refusals may be the common case. D-036
makes the refusal a good *reactive* state, which is right. But the builder will happily let a
user assemble the refusable query, click Run against production Oracle, wait, and then read an
explanation. For a 15-year Discoverer user, "the tool let me build it and then said no" is the
experience that generates the support ticket D-036 was written to prevent.

**Recommendation.** Add to **Phase 3.3's** scope (not 2.2 — it needs the planner):
*"expose the planner as a validate-only call; the builder runs it on every canvas change and
surfaces the refusal inline, at the moment the offending item is added, naming the rule."*
The planner is already being built to emit a plan rather than execute; a `POST /api/maps/plan`
that returns the plan without running is a small addition and turns every refusal from
post-hoc into pre-flight. Add to 3.3's acceptance: *"adding an item that would cause a refusal
is reported in the builder before Run."*

---

## E-08 · No export history, and no workbook browser

- **Severity:** MEDIUM
- **Phase/Stage:** 7.1 · 7.3
- **Type:** MISSING

**Finding.** Exports work (`ExecutionPanel.tsx` CSV/XLSX), and `export_jobs` is a real backend
table. There is **no export-history route or component anywhere** in `src`. Nothing lets a user
see, re-download or cancel a previous export.

Separately, and confirming the plan's own diagnosis: there is no route that browses the full set
of maps in a business area. The plan covers this at 2.1 (flat list) and 7.1 (workbook grouping).

**Recommendation.** Add export history to **7.3's** scope — the backend table and the
ownership-gated download route both exist (`routes/export.ts:81-110`), so this is a list view
over data already there. For an enterprise BI tool, "where did my export go" is a first-week
question.

---

## E-09 · The Run button has no disabled-with-reason state

- **Severity:** MEDIUM
- **Phase/Stage:** 2.2 · D-102
- **Type:** MISSING

**Finding.** `MapViewerPage.tsx:102` — the Run button's only disabled condition is
`runMutation.isPending`. D-102 requires *"every primary action has a disabled state **with a
reason**."* There is no disabled state for a map with no output columns, no data-source
connection, or insufficient entitlement.

After Phase 1.1's `assertDataEntitlement` lands, "you may open this map but not run it" becomes
a **real and reachable state** — and today it would render as an enabled button that fails.

**Recommendation.** Name the three conditions in 2.2's scope, and add the entitlement one
explicitly since 1.1 creates it.

---

## Verified correct — protect these

The plan's instruction to *protect* the frontend's strengths is well founded, and the review
found more strength than the plan credits:

- **Locales: 1 100 keys, exact parity across all four**, with a CI gate. Verified.
- **Error *kinds* are already distinguished** at the execution surface — `getErrorKind()` maps
  to `CONFIG / CONNECT / TIMEOUT / QUERY / CANCELLED`, each with its own copy
  (`ExecutionPanel.tsx:37-46, 182-286`). Phase 2.2 should **extend** this, not build it.
- **Run's request, loading and error flow is correct** — `handleRun` → `needsParameterPrompt`
  gate → `runMutation` → spinner + disabled while pending → toast on failure
  (`MapViewerPage.tsx:32-62, 102-109`).
- **Icon buttons are labelled** — all 8 `size="icon"` buttons found carry `aria-label` or an
  `sr-only` span. This is better than typical and contradicts the adversarial default.
- **The builder and viewer are real**: `MapBuilderPage.tsx` 434 lines plus 3 209 lines of
  sub-components; `MapViewerPage.tsx` 141 lines. The plan's *"~11 000 lines of working backend
  sit behind a page that says 'coming soon'"* understates it — substantial *frontend* sits
  behind it too.
- **Axe coverage is real and per-feature**, not a single sweep file.
- `MapsListPage.tsx` is **23 lines** and renders `placeholderTitle` / `comingSoon` from
  `locales/en/mapViewer.json:14-15` inside a `CardTitle`/`CardContent`. F-06 confirmed exactly
  as the plan describes.
