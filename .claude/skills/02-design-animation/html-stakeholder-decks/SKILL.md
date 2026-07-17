---
name: html-stakeholder-decks
description: |-
  Builds self-contained HTML slide decks from Clarity exports, analytics analysis, or PRDs — light theme, tenant tokens (Pintemas default), large readable typography. Supports technical and non-technical stakeholder audiences. Use when the user asks for a presentation, presentación, slides, deck,...
allowed-tools: Read, Grep, Glob
model: fable
version: 1.0.0
category: 02-design-animation
tags: []
harness:
- claude-code
- opencode
---

# HTML slide decks (analytics & PRD)

Produce **one self-contained `.html` file** (CSS + JS inline). No React, no build step. Open in browser; export PDF via Ctrl+P.

## When to use

- Clarity CSV/export → weekly analytics deck
- PRD / epic plan → stakeholder action deck
- Post-grill PRD → executive summary deck

## Audience modes (pick one)

| Mode | Audiencia | Lenguaje | Plantilla base |
| --- | --- | --- | --- |
| **`technical`** | Producto, analytics, devs | Embudo BD, LCP/INP, eventos, issues | `docs/analytics/clarity-semana-30may-05jun-2026.html` |
| **`stakeholder`** | Dirección, marketing, ops | Negocio, metas %, analogías, sin jerga | `docs/analytics/clarity-prd-plan-stakeholder-pintemas.html` |

**Stakeholder:** evitar LCP, INP, tags, smart events, slices, packages. Usar «tiempo de carga», «medir bien», «coordinación con marketing».

## Workflow

```
1. Clarify audience (technical | stakeholder) and source (CSV, PRD, prior analysis)
2. Scaffold file (optional): npm run deck:new:technical | deck:new:stakeholder
   — or: scripts/new-analytics-deck.ps1 -Mode Technical|Stakeholder [-Topic slug] [-Open]
3. Read source data; extract 4–6 headline metrics + 3–5 insights + actions
4. Edit the new HTML (structure/CSS already from golden template)
5. Save under docs/analytics/ (script picks dated filename)
6. Open in browser; Ctrl+F5 after edits
7. If illegible: Legibility checklist in reference.md
```

## Output location & naming

Script `scripts/new-analytics-deck.ps1` copies the golden template and names the file:

| Mode | Pattern (sin `-Topic`) | Con `-Topic mi-reporte` |
| --- | --- | --- |
| Technical | `clarity-semana-{ddmon}-{yyyy}.html` | `clarity-mi-reporte-{ddmon}-{yyyy}.html` |
| Stakeholder | `clarity-prd-plan-stakeholder-{tenant}-{ddmon}-{yyyy}.html` | `clarity-mi-reporte-stakeholder-{tenant}.html` |

```powershell
npm run deck:new:technical
npm run deck:new:stakeholder
npm run deck:new -- -Mode Stakeholder -Topic epic-233 -Open
.\scripts\new-analytics-deck.ps1 -Mode Technical -Force -Open
```

Manual path also OK: `docs/analytics/{topic}-{audience}-{tenant}.html`

Link from PRD when applicable (`**Contexto:** … presentación en docs/analytics/…`).

## Slide structure (required)

Every slide:

```html
<section class="slide">
  <div class="slide-frame">
    <div class="slide-header">…</div>   <!-- optional -->
    <div class="content">…</div>
  </div>
</section>
```

Deck chrome (always include):

- `.progress` bar (tenant gradient)
- `.slide-counter` (`N / total`)
- `.nav-hint` (← → clic · F fullscreen)
- Keyboard nav script (ArrowLeft/Right, Space, Home, End, F)

## Design rules (non-negotiable)

1. **Light theme** — `--color-fog` background, dark text (never gray-on-dark body copy).
2. **Base font 18px** — titles `clamp(2rem, 4vw, 3.2rem)`; bullets ≥ `1.15rem`.
3. **Tenant tokens** — see [reference.md](reference.md); default **Pintemas** purple + yellow accent.
4. **DM Sans** via Google Fonts (same as storefront v2).
5. **Center vertically** — `.slide { justify-content: center }` + `.slide-frame` max-width 1520px.
6. **Labels outside bars** — funnel/table layout; never put long text inside narrow width bars.
7. **Spanish** copy unless user asks otherwise.

## Content guidelines

### Technical deck (~15 slides)

Portada → agenda → KPIs → tráfico → dispositivos → páginas → embudo → fricción UX → CWV → errores/bots → balance +/- → plan de acción → cierre.

### Stakeholder deck (~12–14 slides)

Portada → contexto → 4 números clave → 3 problemas → analogía medición → plan 3 fases → detalle por fase → metas tabla → cronograma → alcance sí/no → próximos pasos → cierre.

Reference issue numbers (#233) only if stakeholder already uses GitHub; otherwise «plan acordado».

## Legibility iteration

If user reports hard to read:

- Increase `--slide-pad` and card `min-height`
- Bump `.card-label` / `.bullet-list li` one step in clamp()
- Replace `--muted` body with `--text-soft` (#444)
- Use `bullet-list cols-2` for long lists
- Split overcrowded slides

## Do not

- Dark theme for projector/stakeholder rooms (unless explicitly requested)
- Overlap funnel bars with inline labels
- Create PowerPoint unless user asks for another format
- Commit unless user requests

## Additional resources

- Tokens, components, anti-patterns: [reference.md](reference.md)
- Slide outlines & sample copy: [examples.md](examples.md)
- Golden files: `docs/analytics/clarity-semana-30may-05jun-2026.html`, `docs/analytics/clarity-prd-plan-stakeholder-pintemas.html`
