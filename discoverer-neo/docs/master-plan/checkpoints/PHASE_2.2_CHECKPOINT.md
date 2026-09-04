# Phase 2.2 checkpoint — Wire Run, and the error surface

**Status:** complete. Three commits on `master`, pushed.

| Commit | What |
|---|---|
| `2186551` | Run: disabled-with-reason, running label, refusal-aware toast |
| `921dd16` | App error boundary, route fallback, i18n error path, SEC-07 ORA- suppression |
| `8ff872a` | Refusal contract (backend `code` → `kind: REFUSED`) and the refusal UI + docs |

---

## Root cause of the "silent failure" — it was an observation error, not a code defect

The audit reported Run as dead on a real migrated worksheet: *no network
request, no console error, no toast, no loading state.* Reproduced live at
`/maps/5b73118c-.../view` (`GD_M.M02_V01`), every one of those observations is
correct — **and every one of them is what a modal parameter gate legitimately
looks like.** The click opens the **Run parameters** prompt, which Radix
renders through a portal into `<body>`. The audit's page reads were scoped to
`<main>`, so the dialog was invisible to them. Filling in `Dt Início` /
`Dt Fim` and confirming sends the POST.

**Why this matters beyond this stage.** Every dialog in the app is a portal.
Any check that reads `<main>` — or `get_page_text`, which defaults to
`article`/`main` — will report "nothing happened" for a working modal. When
verifying an action that may open a dialog, take a screenshot or query
`document.querySelectorAll('[role=dialog]')`; do not conclude silence from a
scoped text read.

Recorded here because the same blind spot will recur.

## What actually was missing

Verified by grep before changing anything:

1. **No error boundary anywhere.** `ErrorBoundary|componentDidCatch|getDerivedStateFromError`
   returned zero hits. A render throw white-screened the document.
2. **`Suspense fallback={null}`** on `/change-password` (`App.tsx:67`). The
   Layout already had a real `RouteFallback`; only this one route had none.
   The plan review's claim that *every* route had `fallback={null}` was stale.
3. **`getErrorMessage`'s fallback was the English literal** `'Something went
   wrong'`, with 53 of 53 call sites passing no fallback.
4. **`dialog.tsx:43` / `sheet.tsx:60`** hard-coded `<span class="sr-only">Close</span>`.
5. **Frontend `ExecutionErrorKind` was missing `FORBIDDEN`**, which the backend
   already emits (`KIND_STATUS` in `map-execution.ts`). An entitlement refusal
   rendered with no headline.
6. **Run's only disabled condition was `isPending`** (D-102).
7. **No refusal surface.** D-014 arrived as `kind: CONFIG` + English prose.

## Design decisions worth knowing

- **Translated fallback by default, not a required parameter.** The review
  asked for a required translated fallback. Resolving the default through the
  imported i18next instance gives the same guarantee — no English in a
  non-English locale — in three lines instead of 53 call-site edits. Callers
  can still pass something more specific.
- **A refusal carries a `code`, not a message the client matches on.**
  `SqlGenerationError` gained an optional `code`; set, the route sends
  `kind: 'REFUSED'` plus `code` and `details`. Regex-matching the English
  message would have broken the first time it was reworded.
- **The client does not guess entitlement.** Only "no output columns" is
  knowable before asking the server, so that is the only stated disabled
  reason. Entitlement and connection arrive as `FORBIDDEN` / `CONNECT` after
  the click. Inventing a client-side entitlement check would have been a lie.

## Verified in the browser (frontend :5174 → Docker backend :3000)

All three outcomes render, all issue their request, no unhandled console errors.

| Outcome | Map | Result |
|---|---|---|
| Rows | `74126b91-999e-44ea-8a0d-7c738d0013ee` — `GD_M.M123_V01.DIS — Mais de 10 dias` | 712 rows, 185 ms, spinner + skeleton while running, "Map executed" toast |
| Refusal | `d0ecc804-84c6-4b7a-a9eb-89dd99710b2f` — `ZZ Fan-trap refusal demo` | amber explanation, both folder names, next step, "Worksheet not run" toast |
| Prompt | `5b73118c-52e0-486b-9f75-885c17507371` — `GD_M.M02_V01` | Run parameters dialog, `Dt Fim` / `Dt Início`, required marks |

The refusal was re-checked in **pt-PT**: title, why, folders and next step all
render in Portuguese, and the toast reads *"Folha não executada"*. No English
leaked.

`ZZ Fan-trap refusal demo` is a deliberately kept fixture (two joined folders,
`SUM` on the many side) — no migrated worksheet in the estate reaches the
D-014 guard today, because they fail earlier. Do not delete it without
replacing the refusal reproduction.

## Tests

- `frontend/src/__tests__/map-viewer-run.test.tsx` — Run issues the request;
  the prompt blocks execution until required values are supplied; disabled Run
  states its reason in text and via `aria-describedby`; the boundary catches a
  render throw, reports to console, and offers retry + reload; a chunk-load
  failure is named as a load problem.
- `frontend/src/__tests__/execution-panel.test.tsx` — CONFIG and QUERY get
  different headlines; a refusal renders `execution-refusal` and suppresses
  `execution-error`; a REFUSED response with no code falls back to the banner.
- `backend/src/__tests__/sql-generator.test.ts` — the D-014 refusal carries
  `code: 'MULTI_FOLDER_AGGREGATE'` and names both folders in `details`.

Frontend 148/148 pass. Backend sql-generator 107/107 pass. `i18n-check.mjs`
passes for all three non-English locales. Typecheck and lint clean in both
workspaces.

## Found in passing — not this stage's scope

A sweep of the estate (132 of 924 maps executed with no parameters) returned
**129 CONFIG failures to 3 successes.** The dominant message is
`Unknown item reference "1,95" at position 0` — a formula referencing an item
by its Discoverer ordinal, which the migration did not resolve. That is a
Phase 3 query-engine problem, not a UI one, but it means the "rows render"
path is rare in practice today. Worth measuring properly before Phase 3
planning.
