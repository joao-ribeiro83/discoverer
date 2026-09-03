# PHASE 2.1 — The Maps list

**Model:** Sonnet · **Effort:** high *(use Opus if the API contract needs changing)*

## Purpose

Build the product's front door. `MapsListPage.tsx` is **22 lines** and renders *"This page is
coming soon."* — so ~11 000 lines of working backend, a real map builder and a real viewer are
reachable only by hand-typing a UUID.

## Scope

Replace the placeholder with a real list:

- Search by name
- Business-area filter
- `mine | shared | all` tabs
- Recency sort
- Create action
- Row actions: open, view, share, schedule, export, **delete with confirmation**
- Truthful empty states

**Flat worksheet list.** Workbook grouping lands in Phase 7.1 — the Maps list is a P0
unblocker and **cannot wait on a schema change** (D-100). The route stays `/maps`.

## Prerequisites

Phase 1.2 — `GET /api/maps?scope=all` must return the estate.

## Required files to read first

- `docs/master-plan/research/ux-analysis.md` §4 (the four rules) and §5 P0 — **the
  authoritative brief**
- `AUDIT_UI_UX_ASSESSMENT.md` §3.1, §3.2
- `frontend/src/pages/MapsListPage.tsx` (22 lines)
- `frontend/src/App.tsx:96-100` — routing
- `frontend/src/pages/MapBuilderPage.tsx`, `MapViewerPage.tsx` — the destinations
- An existing substantial page for the house pattern: `frontend/src/pages/DataSourcesPage.tsx`
  (440 lines) or `AuditLogPage.tsx` (430)

## Required tooling

**Skills:** `frontend-design` **or** `ui-ux-pro-max` — **exactly one**, per the tooling
manifest.
**Agents:** none.
**Plugins / MCPs:** `Claude_Browser` — **essential**. This page's defects are invisible in
source review; four audit findings came from the browser and nothing else would have found
them.

## Implementation instructions

- **Match the house patterns.** TanStack Query for server state, Zustand only for
  builder-local state, shadcn primitives, `react-hook-form` + `zod` for the create dialog.
  Read a real page first and copy its idiom.
- **Every string routes through `t()`.** Four locales are complete and in sync — `en`,
  `es-ES`, `fr-FR`, `pt-PT`. Add keys to all four; do not leave three stale.
- **Virtualise the list.** The estate is 923 rows and TanStack Virtual is already a dependency.
- Rule R2 — **empty states tell the truth.** Never *"No maps yet. Create one from the Maps
  page."* against 923 maps. Say **"923 worksheets exist; none are shared with you."** The empty
  state is where a broken data path becomes visible or stays hidden.
- Delete with confirmation is destructive — require a typed confirmation or a two-step dialog.

## Tests

- The list renders rows from a mocked `GET /api/maps`
- Each tab issues the correct `scope`
- Search and the BA filter narrow the result
- The empty state renders the **truthful** copy, not a generic one
- Delete requires confirmation

## Security checks

- **Listing a map is not entitlement to its data.** The `all` tab must not imply the user can
  execute what it lists — Phase 1.1's `assertDataEntitlement` governs that, server-side.
- Row actions must be hidden or disabled by permission, and the server must re-check. **Never
  rely on the client to enforce it.**

## Validation

Use `Claude_Browser`:
1. `preview_start` the frontend
2. Log in, navigate to `/maps`
3. `read_page` — confirm 923 rows are reachable, tabs work, the empty state is truthful
4. Click through to the builder and the viewer
5. `read_console_messages` and `read_network_requests` — confirm no errors and correct calls
6. Screenshot as proof

## Acceptance criteria

- [ ] All 923 migrated worksheets are findable and openable from `/maps`
- [ ] Search, BA filter and the three tabs work
- [ ] Create, open, view, share, schedule, export and delete are reachable
- [ ] **The empty state tells the truth**
- [ ] No console errors; every action issues the expected request
- [ ] All four locales carry the new keys
- [ ] A screenshot is attached to the handover

## Documentation updates

- `docs/user-guide/getting-started.md` and `building-maps.md` — the real navigation
- Mirror into `es-ES`, `fr-FR`, `pt-PT`

## Git checkpoint

One commit for the page, one for the locale keys, one for tests. Push.

## Handover artefacts

- A screenshot of the working list
- A note in the checkpoint confirming the estate is reachable through the UI

## Explicitly out of scope

- **Wiring Run.** Phase 2.2.
- Dashboard placeholders. Phase 2.3.
- The `workbooks` grouping. Phase 7.1.
- Crosstab rendering, drill, conditional formats. Phase 7.3.

## Resume instructions

Read the checkpoint, then open `/maps` in the browser. If 923 worksheets are listed and
openable, this stage is done.

## TOKEN-BUDGET SAFE EXECUTION

1. Build the list first; add filters, then actions. Commit each.
2. **No specialist agents in parallel.** None are needed.
3. Verify in the browser after each increment rather than at the end — silent failure is this
   codebase's signature defect.
4. Checkpoint after each commit.
5. Route bulk locale-key addition to a **Haiku** sub-agent if it grows large — one agent.
6. Leave the tree committed and the frontend tests green.
7. If interrupted, record which features are wired and which are stubs.

---

## ⟐ CORRECTIONS from the plan review

### 1. Split into two single-model stages (R-19 / G-04 / D-007)

This prompt's header reads **`Effort: high (use Opus if the API contract needs changing)`** — an
instruction to switch model mid-session, which **D-007 forbids**.

- **2.1a — the API contract** · `Model: Opus · Effort: medium`. The `all` scope's response shape,
  filter and sort parameters, and pagination **with a tiebreaker** (BE-06 — Phase 0.4's baseline
  records how many maps have no sort at all).
- **2.1b — the list UI** · `Model: Sonnet · Effort: medium`.

### 2. The client method already exists — this is wiring (E-05)

`frontend/src/lib/api.ts:267-268` already defines
`apiClient.maps.listByBusinessArea(businessAreaId)`, bound to the backend's
`GET /business-areas/:baId/maps`, with **zero non-test call sites**. Do not rebuild it.

**That is why 2.1b's effort drops from `high` to `medium`.**

### 3. The empty state, precisely (D-101 / R2)

The current dashboard test pins `/No maps yet/` (`dashboard.test.tsx:92`) — the exact string
D-101/R2 forbids. The truthful form names the real number from Phase 0.4's baseline:
*"N worksheets exist; none are shared with you."* Never *"No maps yet"* while the estate is
populated.

### 4. Counts

Assert against **Phase 0.4's recorded baseline**, not a literal. The source documents disagree.
