# UX Direction — consolidated

**Produced:** 2026-09-02, **inline** (decision D-005). `AUDIT_UI_UX_ASSESSMENT.md` already
carries a live-browser assessment with per-page line counts, a P0/P1/P2 requirement list and
explicit reference-product guidance. What was missing is a **design contract** — an
information architecture and a set of rules the frontend phases build against. That is
below.

---

## 1. The diagnosis, in one line

**The parts are better than the whole.** ~11 000 lines of working backend sit behind a front
door that says *"This page is coming soon."* The component craft is genuinely good; the
failure is **assembly and honesty about state**, not craft.

**Enterprise-ready: no.** Not because components are missing, but because the product's own
surface — as opposed to its admin surfaces — is the one that does not exist.

---

## 2. What must be protected

| Asset | Why it is good |
| ----- | -------------- |
| **`ResultsTable.tsx`** (503 lines, virtualised) | Renders Discoverer group breaks, subtotals at change and grand totals with repeats suppressed — **and drops back to a plain grid when the user re-sorts, because a subtotal stranded among re-sorted rows would be a lie.** That instinct is exactly right and must survive every refactor. |
| **`CrosstabTable.tsx`** | Crosstab rendering **exists**. The audit's first pass missed it because the file is untracked. |
| **The map builder** | `BusinessAreaTree.tsx` (430 lines) plus dedicated Conditions / Parameters / Calculated Fields / Sort / Column Config / Properties panels. **The mental model matches Discoverer's** — a governed semantic layer, not a free canvas. |
| **i18n** | 4 locales × 12 namespaces = 48 files, all present and consistent in size. For a Portuguese first estate, well judged. |
| **Theming** | `light \| dark \| high-contrast`, persisted per user in the database. |
| **Performance defaults** | 17 `lazy()` route splits, TanStack Virtual, Query for server state with Zustand confined to builder-local state. |

---

## 3. Information architecture — the contract

Discoverer users think in **workbooks → worksheets**, and share and schedule at the workbook
level. The current model presents 564 workbooks as **923 unrelated maps** whose only link is
a name prefix (`GD_M.M27_V08 — …`). The IA must reflect the user's model, not the table
layout.

```
Dashboard            what changed, what I ran, what is scheduled — real numbers or nothing
Workbooks            564 rows · the primary browse surface (needs the `workbooks` table)
  └ Worksheets       923 · ordered within a workbook, opened in Viewer or Builder
Explore              ad-hoc: pick a business area → build a worksheet
Schedules            exists and is real — remove the dashboard's claim that it does not
Exports              job list + downloads
Admin                Business Areas · Folders · Items · Joins · Hierarchies ·
                     Custom Functions · Item Classes · Data Sources · Users ·
                     Security · Migration · Audit
Settings             locale · theme · density · preferences
```

**Sequencing note:** the Maps list must ship **before** the `workbooks` table exists — it is
a P0 unblocker and cannot wait on a schema change. Build it as a flat, filterable worksheet
list, then let the workbook grouping land above it. The route stays `/maps`.

---

## 4. Rules the frontend phases build against

### R1 — No placeholder ever ships in a value slot

The dashboard currently renders developer apology notes **inside `<h*>` elements where KPI
numbers belong**:

> *"No workspace-wide execution count endpoint exists yet — see each map's history for its own runs."*
> *"Scheduling has not been built yet."* — **factually wrong**; an 816-line service and a 727-line page exist.

Either implement the endpoint or **remove the card**. A card that explains its own absence is
worse than no card. (Also: `Admin -> Data Sources` ships a raw ASCII arrow.)

### R2 — Empty states must tell the truth

Not *"No maps yet. Create one from the Maps page."* against 923 maps, pointing at a
placeholder. Say **"923 worksheets exist; none are shared with you."** The empty state is
where a broken data path becomes visible or stays hidden.

### R3 — No silent failure, ever

Clicking **Run** on a real migrated worksheet produced **no network request, no console
error, no toast, no loading state**. Silent failure is the worst outcome: the user cannot
distinguish "not clicked" from "broken", and it is precisely how a 100 % execution failure
stayed hidden from manual testing.

Every primary action must have: a disabled state **with a stated reason**, a loading state,
a success state, and an error state carrying the backend's `kind` (`CONFIG` / `ORACLE` /
`AUTH`) rather than a raw message. Plus a **global error boundary** — today nothing tells a
user the system is broken.

### R4 — Refusals are a first-class UI state

The query planner will refuse legitimate user requests: multi-folder aggregates pending the
fan-trap guard, `AVG` / `COUNT DISTINCT` across a fan, quarantined formulas. **The estate has
282 `COUNT DISTINCT` totals**, so this is ordinary behaviour, not an edge case.

A refusal must render as an explanation with a next step — *"This worksheet totals a value
across a one-to-many join. Discoverer would have refused this too. Here is why, and here is
what to change."* — never as a generic error. Without this, the first support ticket is
*"your product can't average"*.

### R5 — Tests pin what is wanted, not what is current

`frontend/src/__tests__/dashboard.test.tsx:93` **asserts** the string *"Scheduling isn't
available yet"* — so removing the placeholder becomes a test failure. Delete that assertion
as part of removing the placeholder.

### R6 — Governed, not free-form

**Take** Power BI's field-well metaphor for axis assignment (it maps cleanly onto `axis_type`
+ `axis_edge`), Looker's governed-model browsing for the business-area tree, and Tableau's
parameter-prompt patterns.

**Refuse** free-form drag-anywhere canvases. Discoverer's contract is a *governed* semantic
layer — folders, items, joins and conditions defined by an administrator. A self-service
canvas that lets users bypass the model would discard the very thing being migrated. The
current builder is right to be structured.

---

## 5. Work, by priority

### P0 — the product does not function without these

1. **The real Maps list.** Search; business-area filter; `mine | shared | all` tabs; recency
   sort; create action; row actions (open, view, share, schedule, export, delete with
   confirmation). **Depends on the `GET /api/maps` visibility fix** — the endpoint returns
   only owned and shared maps, hiding all 923.
2. **Wire Run**, to R3's standard, including the parameter prompt (worksheets carry
   parameters — the viewer shows `&Dt Início`, `&Dt Fim` in titles).
3. **Delete every dashboard placeholder** and the test that asserts one.
4. **Global error boundary and a real error surface.**

### P1 — parity with Discoverer

5. Crosstab rendering wired once `axis_edge` is populated (`CrosstabTable.tsx` exists).
6. **Workbook view** — 564 workbooks above the 923 worksheets.
7. Conditional formatting / exception highlighting — **schema ready, no UI**.
8. Hierarchy drill up / down / to-detail, once hierarchies migrate.
9. **Title token substitution** — the viewer prints `&Date (&Time) &Dt Início &Dt Fim`
   literally today.
10. **Item-class / LOV pick-lists** for parameters instead of free text — the payload is
    7 521 parameters and 5 605 conditions currently rendering as free-text boxes.
11. **Refusal UI** (R4).

### P2 — enterprise finish

12. Full keyboard support and a documented shortcut map. **Fix the duplicated checkbox** —
    the login form exposes a shadcn button-checkbox *and* an exposed native input announced
    as **"on"**, so a screen-reader user hears a duplicated, unlabelled control. The pattern
    likely repeats wherever the `Checkbox` primitive is used.
13. Truthful empty states everywhere (R2).
14. Bulk operations across a 923-worksheet estate.
15. Saved views, column pinning, export-from-grid.
16. Density control; print/PDF layout honouring `map_page_setup` (**923 rows already migrated
    and entirely unused**).
17. A design-token pass — 20 shadcn primitives is a foundation, not yet a system.
18. Migration UI: surface the four-bucket formula partition and the planner-decision
    histogram, so a migration's real state is visible in the product rather than in a log.

---

## 6. Accessibility

**Partial — a real effort, thin coverage.** 71 `aria-*` attributes and 11 explicit `role=`
across the component tree. One concrete defect found (the duplicated checkbox, above).

**Not audited to depth, and must be:** full keyboard traversal; focus management in dialogs;
contrast ratios across all three themes; **virtualised-grid screen-reader behaviour** (a
known hard case, and the grid is the product's core surface).

`frontend/e2e/accessibility.spec.ts` exists — but **CI has never run**, so it has never
executed in an automated context. Wiring CI is therefore an accessibility fix as much as an
engineering one.
