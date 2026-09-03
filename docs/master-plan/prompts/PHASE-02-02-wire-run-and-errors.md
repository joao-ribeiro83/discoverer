# PHASE 2.2 — Wire Run, and the error surface

**Model:** Opus · **Effort:** high

## Purpose

Make the product's primary action work, and make failure **visible**.

> Clicking **Run** on a real migrated worksheet produced **no network request, no console
> error, no toast, and no loading state.** The page still read *"Run the map to see results."*
>
> **Silent failure is the worst possible outcome:** the user cannot distinguish "not clicked"
> from "broken" — and it is exactly how a 100 % execution failure stayed hidden from manual
> testing.

## Scope

1. **Wire Run.** The viewer must issue `POST /api/maps/{id}/execute` and render the result.
2. **Parameter prompts.** Worksheets carry parameters — the viewer shows `&Dt Início`,
   `&Dt Fim` in titles today. 7 521 parameters exist across 898 maps.
3. **Full action state machine:** a disabled state **with a stated reason**, a loading state, a
   success state, an error state.
4. **Errors carry the backend's `kind`** (`CONFIG` / `ORACLE` / `AUTH`), not a raw message.
5. **A global error boundary.** Nothing today shows a user that the system is broken — the
   audit had to read network traces to discover it.
6. **The refusal UI** (D-036), first version.

## The refusal UI is not an edge case

The Phase 3 query planner will refuse legitimate requests: multi-folder aggregates pending the
fan-trap guard, `AVG` / `COUNT DISTINCT` across a fan, quarantined formulas. **The estate has
282 `COUNT DISTINCT` totals.** This is ordinary user behaviour.

A refusal must render as **an explanation with a next step** —

> *"This worksheet totals a value across a one-to-many join. Discoverer would have refused
> this too. Here is why, and here is what to change."*

— never as a generic error. Without this, the first support ticket is *"your product can't
average"*.

## Prerequisites

Phase 2.1. Phase 1.1 (execution works for single-folder maps and refuses multi-folder
aggregates with a real message).

## Required files to read first

- `docs/master-plan/research/ux-analysis.md` §4 rules R3 and R4 — **the authoritative brief**
- `docs/master-plan/DECISION_REGISTER.md` D-036, D-102
- `AUDIT_UI_UX_ASSESSMENT.md` §3.4
- `frontend/src/pages/MapViewerPage.tsx`
- `frontend/src/components/data-table/ResultsTable.tsx` (503 lines) — **read its docstring;
  its group-break and re-sort behaviour is correct and must not regress**
- `frontend/src/components/parameters/`
- `backend/src/routes/map-execution.ts` — the response shape and the `kind` taxonomy

## Required tooling

**Skills:** `frontend-design` **or** `ui-ux-pro-max` — exactly one.
**Agents:** none.
**Plugins / MCPs:** `Claude_Browser` — **essential**; this defect is only visible live.

## Implementation instructions

- **Find why the click does nothing before changing anything.** It may be a missing handler, a
  guard that silently returns, or a disabled state with no visual. Fix the cause, not the
  symptom — and check whether the same pattern exists on other primary actions.
- Protect `ResultsTable`'s behaviour: it renders group breaks, subtotals at change and grand
  totals with repeats suppressed, **and drops back to a plain grid when the user re-sorts,
  because a subtotal stranded among re-sorted rows would be a lie.** That instinct is right.
  Do not regress it.
- The parameter prompt reads the map's parameters and blocks execution until required ones are
  supplied. Free-text is acceptable here — LOV pick-lists arrive in Phase 5.2.
- The error boundary is app-level and must report, not swallow.
- All four locales.

## Tests

- Clicking Run issues the request
- A map with parameters shows the prompt and does not execute until it is satisfied
- A `CONFIG` error renders differently from an `ORACLE` error
- A refusal renders the explanation component, not the generic error
- The error boundary catches a thrown render error and shows a recovery path
- **No path leaves the button in a state with no feedback**

## Security checks

- Errors must not leak raw `ORA-` text to the user (SEC-07). If the backend still sends it,
  render the `kind` and log the detail — and note the backend fix belongs to Phase 6.4.
- Parameter values are sent as bind variables server-side; the client must not build SQL.

## Validation

`Claude_Browser`, against a real migrated worksheet:
1. Click Run on a single-folder map → rows render
2. Click Run on a multi-folder aggregate map → the **refusal explanation** renders
3. Click Run on a parameterised map → the prompt appears
4. `read_network_requests` confirms the call fires in every case
5. `read_console_messages` confirms no unhandled errors
6. Screenshot each of the three outcomes

## Acceptance criteria

- [ ] Run issues a request and renders rows, a prompt, or an explained refusal
- [ ] **No path produces silence**
- [ ] Errors carry `kind`, not a raw message
- [ ] A global error boundary exists and reports
- [ ] The disabled state states its reason
- [ ] `ResultsTable`'s group-break and re-sort behaviour is unchanged
- [ ] All four locales carry the new keys
- [ ] Three screenshots attached

## Documentation updates

- `docs/user-guide/executing-maps.md` — parameters, and **what a refusal means**
- Start `docs/troubleshooting/` with the refusal reasons; Phase 3.3 will extend it
- Mirror into all locales

## Git checkpoint

One commit for Run, one for the error surface and boundary, one for the refusal UI. Push.

## Handover artefacts

- Three screenshots: rows, refusal, prompt
- The root cause of the silent failure, recorded in the checkpoint — **it may recur elsewhere**

## Explicitly out of scope

- Dashboard placeholders. Phase 2.3.
- LOV pick-lists. Phase 5.2.
- Crosstab, drill, conditional formats. Phase 7.3.
- The backend `ORA-` mapping. Phase 6.4.
- Export from the grid. Phase 7.3.

## Resume instructions

Read the checkpoint, then click Run in the browser on each of the three map kinds. If all
three give visible feedback, this stage is done.

## TOKEN-BUDGET SAFE EXECUTION

1. Diagnose the silent failure first and record the cause **before** writing new UI.
2. **No specialist agents.**
3. Verify in the browser after each increment.
4. Checkpoint after each commit.
5. Commit coherently.
6. Leave the tree committed and frontend tests green.
7. If interrupted, record which of the three outcomes render correctly.

---

## ⟐ ADDITIONS from the plan review (E-02 / E-03 / E-09)

### 1. There is no error boundary — and `Suspense fallback={null}` is a second, silent failure

`grep -rn "ErrorBoundary|componentDidCatch|getDerivedStateFromError" src/` returns **nothing**.
Every page is `lazy()`-loaded behind a single `<Suspense fallback={null}>` (`src/App.tsx:67`).

That is **two** failure modes:

1. Any render-time throw **white-screens the whole application**, with no recovery UI. v1.0
   covers this.
2. **`fallback={null}` means route transitions have no loading state at all.** On a slow
   connection the user clicks a nav item and *nothing happens*. If the dynamic `import()` fails,
   nothing happens permanently and no error appears.

The second violates D-102 and Section 6's *"no silent failure"* rule, and v1.0 does not name it.
**It is also, precisely, the shape of the defect that let F-01 hide** — *"no network request, no
console error, no toast and no loading state"* — sitting one line above every route in the app.

- Add the error boundary **and** a route-level skeleton.
- [ ] **A forced chunk-load failure renders a retry, not a blank page.**

### 2. The error path bypasses i18n at every call site

`src/lib/api.ts:54`:

```ts
export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string
```

The fallback is a **hard-coded English literal**, used across **28 files**, none passing a
translated one. Any failure without a `response.data.error` string — network drop, timeout,
non-JSON 5xx, CORS — renders English regardless of locale. **This is a Portuguese estate, and
these are the failures that matter most.**

The locales themselves are perfect (**1 100 keys each across all four**, CI-gated by
`scripts/i18n-check.mjs`) — **key parity cannot catch a string that never reaches the locale
files.**

- Make the translated fallback **required**; map the backend's `kind` taxonomy to locale keys,
  not to raw text.
- Also fix `src/components/ui/dialog.tsx:43` and `sheet.tsx:60`, which hard-code
  `<span className="sr-only">Close</span>` in English on every dialog in the app.
- [ ] **No English error text appears in a non-English locale.**

### 3. Run has no disabled-with-reason state

`MapViewerPage.tsx:102` — the Run button's only disabled condition is `runMutation.isPending`.
D-102 requires *"a disabled state **with a reason**"*. Name the three real ones: no output
columns, no data-source connection, and **insufficient entitlement — which Phase 1.1's
`assertDataEntitlement` newly creates as a reachable state** ("you may open this map but not run
it"). Today that would render as an enabled button that fails.

### 4. Do NOT rebuild what already works

`getErrorKind()` already maps `CONFIG / CONNECT / TIMEOUT / QUERY / CANCELLED`, each with its own
copy (`ExecutionPanel.tsx:37-46, 182-286`). Run's request → parameter-prompt gate → spinner →
toast flow is correct (`MapViewerPage.tsx:32-62, 102-109`). **Extend both. Replace neither.**
