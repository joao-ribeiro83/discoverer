# Discoverer Neo — UI / UX Assessment

**Audit date:** 2026-09-01 · Assessed live at `http://localhost:5173` as
`admin@discoverer.local`, plus source review of `frontend/src`.

---

## 1. Verdict

**The frontend is the project's weakest dimension — but not for the reason it first
appears.** The component work is genuinely good: a virtualised results grid that renders
Discoverer group breaks and subtotals correctly, a real map builder with drag-and-drop, a
complete four-locale i18n layer, three themes, and 17 route-level code splits.

The failure is that **the product's front door does not exist.** The Maps page — the only
route from which a user could reach any of that — renders "This page is coming soon." The
result is ~11 000 lines of working backend behind a placeholder.

**Enterprise-ready: no.** The gap is one of assembly and finish, not of craft.

---

## 2. What actually exists

**Stack:** React 19 · Vite · TypeScript · TanStack Query + Table + Virtual · Zustand ·
shadcn/ui (20 primitives) · Tailwind · dnd-kit · react-hook-form + zod · Monaco ·
Playwright.

**18 pages**, 17 lazily loaded:

| Page | Lines | State |
| --- | --- | --- |
| `SecurityPage` | 805 | Real, substantial |
| `MigrationPage` | 789 | Real, substantial |
| `SchedulesPage` | 727 | Real, substantial |
| `MapBuilderPage` | 434 | Real — **unreachable** |
| `DataSourcesPage` | 440 | Real |
| `AuditLogPage` | 430 | Real |
| `MapViewerPage` | — | Real — **unreachable** |
| `MapsListPage` | **22** | **Placeholder** |
| `DashboardPage` | — | Real shell, placeholder content |
| Business Areas / Folders / Items / Joins / Hierarchies / Custom Functions / Users / Settings / Login | — | Real |

**Component tree:** `admin/`, `auth/`, `data-table/`, `layout/`, `map-builder/` (+ `panels/`),
`parameters/`, `ui/`.

---

## 3. Critical problems

### 3.1 The Maps page is a placeholder, so the product is unreachable (F-06)

`MapsListPage.tsx` is 22 lines. Live tree at `/maps`:

```
heading "Maps" · "Browse and manage your visual maps."
heading "Placeholder" · "This page is coming soon."
```

Routing (`App.tsx:96-100`) has `index → MapsListPage`, `:id → MapBuilderPage`,
`:id/view → MapViewerPage`. **There is no create action and no list.** Reaching the
builder or viewer requires hand-typing a UUID — which I did, and both rendered a real
migrated worksheet correctly, title and all.

### 3.2 The dashboard reports zero against 923 maps (F-07)

`GET /api/maps` → `{"data":{"mine":[],"shared":[]}}`. All 923 maps belong to the
`migration@migrated.local` service user and `map_shares` is empty. The dashboard therefore
shows **"Total Maps 0"** and **"No maps yet. Create one from the Maps page."** — pointing
the user at the placeholder.

### 3.3 Developer apology notes are rendered as KPI values (F-13)

From the live accessibility tree, inside `<h*>` elements where numbers belong:

| Card | Rendered "value" |
| --- | --- |
| Total Executions | *"No workspace-wide execution count endpoint exists yet — see each map's history for its own runs."* |
| Scheduled Maps | *"Scheduling has not been built yet."* |
| Data Sources | *"See Admin -> Data Sources for the full list."* |
| Scheduled Results | *"Scheduling isn't available yet — this section will populate once schedules ship."* |

The scheduling text is **factually wrong**: `routes/schedules.ts`,
`scheduler.service.ts` (816 lines) and `SchedulesPage.tsx` (727 lines) all exist, and
`/schedules` is in the navigation. Worse, `__tests__/dashboard.test.tsx:93` **asserts** this
string — the test suite locks the placeholder in as correct behaviour (F-30).

Note the raw `->` in the Data Sources card: an unrendered ASCII arrow in shipped copy.

### 3.4 The Run button fails silently (F-08)

Clicking **Run** on migrated worksheet `GD_M.M02_V01` produced **no network request**:

```
POST /api/auth/login → 200
GET  /api/maps → 200
GET  /api/maps/5b73118c-…/ → 200      ← nothing after this
```

No console errors. No toast. No loading state. The page still reads *"Run the map to see
results."* The worksheet carries parameters (`&Dt Início`, `&Dt Fim` in its title) so a
parameter prompt was expected. Silent failure is the worst possible outcome: the user
cannot distinguish "not clicked" from "broken", and it is how F-01 stayed hidden from
manual testing.

---

## 4. What is genuinely good

### 4.1 `ResultsTable.tsx` is Discoverer-faithful and well reasoned

503 lines, virtualised via `@tanstack/react-virtual`, with real legacy semantics:

```ts
/**
 * With `groupBreakAliases` and `totals` it draws the worksheet the way
 * Discoverer did: repeated group values suppressed, a subtotal at each change,
 * grand totals at the foot. That layout only holds while the rows are in the
 * [query's own order] … back to a plain grid — a subtotal stranded among
 * re-sorted rows would be a [lie].
 */
```

Group breaks, subtotals at change, grand totals, suppressed repeats, and — the detail that
shows real care — **it drops back to a plain grid when the user re-sorts**, because a
subtotal in re-sorted rows would be meaningless. That is exactly the right instinct.

**Correction — crosstab rendering DOES exist.** My first pass concluded it was missing because
`grep` over `ResultsTable.tsx` found no `crosstab` or `pivot`. It is a separate component:
**`frontend/src/components/data-table/CrosstabTable.tsx`** — which my grep missed because the
file is **untracked in git** and I was searching tracked paths. This matters twice over: the
capability is present, and the file is one of the 36 uncommitted source files (DOC-04).

That `map_type` is `TABLE` on all 923 maps and `axis_edge` NULL on all 25 960 rows is
*correct*, not a gap: `crosstabs: 0` is a true property of this estate, and Discoverer records
no row-vs-column edge at all.

### 4.2 The map builder expresses the Discoverer model

`map-builder/` has `BusinessAreaTree.tsx` (430 lines) plus dedicated panels for
Conditions, Parameters, Calculated Fields, Sort, Column Config and Properties, with
dnd-kit for placement and a `ColumnConfigDialog` covering display name, format mask, format
presets, sort order and **column width**. The mental model matches Discoverer's.

### 4.3 Internationalisation is complete and in sync

4 locales × 12 namespaces = 48 files, all present:

| Locale | Files | Size |
| --- | --- | --- |
| `en` | 12 | 45 478 B |
| `es-ES` | 12 | 51 231 B |
| `fr-FR` | 12 | 52 698 B |
| `pt-PT` | 12 | 50 831 B |

Sizes are consistent with translation expansion, not with staleness. Every user-facing
string sampled routed through `t()`. Three themes (`light|dark|high-contrast`) are modelled
in the database as a user preference. For a product whose first customer estate is
Portuguese, this is well judged.

### 4.4 Sound engineering defaults

17 `lazy()` route splits · react-hook-form + zod · a `status "Loading page"` live region ·
a `region "Notifications (F8)"` toast landmark with a keyboard hint · TanStack Query for
server state with Zustand confined to builder-local state.

---

## 5. Accessibility

**Partial.** 71 `aria-*` attributes and 11 explicit `role=` across the component tree — a
real effort, not an afterthought, but thin for an enterprise application.

**Concrete defect found (F-26):** the login form exposes two controls for one checkbox:

```
checkbox "Remember me" [ref_8] type="button"
checkbox "on"          [ref_9] type="checkbox"
label    "Remember me" [ref_10]
```

A shadcn button-checkbox plus an exposed native input announced as **"on"**. A screen-reader
user hears a duplicated, unlabelled control. This pattern likely repeats wherever the
`Checkbox` primitive is used.

**Not audited to depth:** full keyboard traversal, focus management in dialogs, contrast
ratios across all three themes, virtualised-grid screen-reader behaviour (a known hard
case). `e2e/accessibility.spec.ts` exists — but CI has never run (INF-04), so it has never
executed in an automated context.

---

## 6. Requirements for an enterprise-grade frontend

### P0 — the product does not function without these

1. **Build the real Maps list.** Search, business-area filter, `mine | shared | all` tabs,
   recency sort, create action, row actions (open, view, share, schedule, export, delete
   with confirmation). Requires the F-07 API fix.
2. **Wire Run.** Visible disabled state *with a reason*, parameter prompt, loading state,
   error toast carrying the backend's `kind` (`CONFIG` vs `ORACLE` vs `AUTH`) rather than a
   raw message.
3. **Delete every placeholder.** Remove the four dashboard cards or implement their
   endpoints — and remove the test that asserts the placeholder text.
4. **A global error boundary and a real error surface.** Nothing today shows a user that
   the system is broken; the audit had to read network traces to discover it.

### P1 — parity with Discoverer

5. **Crosstab rendering** in `ResultsTable` once `axis_edge` is populated.
6. **A workbook view** — 564 workbooks currently present as 923 unrelated maps linked only
   by a name prefix (`GD_M.M27_V08 — …`).
7. **Conditional formatting / exception highlighting** — schema ready, no UI.
8. **Hierarchy drill** up/down/to-detail once hierarchies migrate.
9. **Title token substitution** — the viewer currently prints `&Date (&Time) &Dt Início
   &Dt Fim` literally.
10. **Item-class / LOV pick-lists** for parameters instead of free text.

### P2 — enterprise finish

11. Full keyboard support and a documented shortcut map; fix the duplicated checkbox.
12. Empty states that tell the truth ("923 maps exist but none are shared with you" —
    not "No maps yet").
13. Bulk operations across a 923-worksheet estate.
14. Saved views, column pinning, and export-from-grid.
15. Density control and print/PDF layout honouring `map_page_setup` (923 rows already
    migrated and currently unused).
16. A design-token pass — 20 shadcn primitives is a foundation, not yet a system.

---

## 7. Reference products — what to take and what to refuse

**Take:** Power BI's field-well metaphor for axis assignment (it maps cleanly onto
`axis_type` + `axis_edge`); Looker's governed-model browsing for the business-area tree;
Tableau's parameter-prompt patterns.

**Refuse:** free-form drag-anywhere canvases. Discoverer's contract is a *governed*
semantic layer — folders, items, joins and conditions defined by an administrator. A
self-service canvas that lets users bypass the model would discard the very thing being
migrated. The current builder is right to be structured.

---

## 8. Summary

| Dimension | Rating | Note |
| --- | --- | --- |
| Component craft | **Good** | ResultsTable and the builder panels are genuinely strong |
| Information architecture | **Broken** | Core route is a placeholder |
| Data visibility | **Broken** | 923 maps invisible to every user |
| Error handling | **Poor** | Silent failure on the primary action |
| Discoverer fidelity | **Partial** | Breaks/totals excellent; no crosstab, no drill, no exceptions |
| i18n | **Strong** | 4 locales complete and in sync |
| Theming | **Good** | 3 themes, persisted per user |
| Accessibility | **Partial** | Real effort, thin coverage, one concrete defect |
| Performance | **Good** | Virtualisation + 17 route splits |
| Enterprise polish | **Not yet** | Placeholder copy and apology text in shipped UI |

**One sentence:** the parts are better than the whole — this front end needs assembly and
honesty about state far more than it needs new components.
