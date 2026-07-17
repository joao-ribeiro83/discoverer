---
name: issue-slice-prompts
description: |-
  Generate two copy-paste agent prompts (zoom-out map + TDD vertical slices) from a GitHub issue slice. Use when the user asks for implementation prompts for an issue, 'prompts para #N', 'issue-slice-prompts', or before AFK work on ready-for-agent slices. Chains with zoom-out and tdd skills — does...
allowed-tools: Read, Grep, Glob
model: opus
version: 1.0.0
category: 06-ai-ml
tags: []
harness:
- claude-code
- opencode
---

# Issue slice prompts

Produce **two prompts** the user can paste into agent sessions. **Does not implement code.**

## Invoke (no slash required)

The user may say:

- `Generá issue-slice-prompts para #67`
- `Prompts zoom-out + tdd del issue #62`
- Attach this skill manually: **@issue-slice-prompts** or Skills picker → **issue-slice-prompts**

There is **no** guaranteed `/issue-slice-prompts` command unless you register it in **Cursor Settings → Rules, Skills**.

## Process

### 1. Load the slice

```bash
gh issue view <N> --repo SantiagoXOR/pintureria-digital --json number,title,body,labels,url
```

If body has `## Parent`, fetch parent for PRD context. Respect **Blocked by**.

### 2. Light codebase exploration

Grep/read real modules, routes, tests. Use tenant / embudo / Resumen vocabulary.

### 3. Prompt A — zoom-out

```markdown
/zoom-out

Contexto: Issue #<N> — <title> (parent #<P>). <1 línea>

Tarea zoom-out:
1. Mapea capas y callers (<entrada> → UI/API/DB>) con rutas reales del repo
2. Bugs/deuda del PRD si aplica
3. Módulos a crear vs modificar
4. Diagrama + tabla módulo → responsabilidad → callers

No implementes. Interfaces públicas + 3–5 comportamientos testeables prioritarios.
```

### 4. Prompt B — TDD

```markdown
/tdd

Implementa issue #<N> con TDD vertical (un test → cambio mínimo → GREEN).

Antes de codear, confirma interfaz pública y orden de tracer bullets.

Reglas (desde AC): <bullets>

Tracer bullets:
1. RED→GREEN: <behavior> — <test + prior art>
...

Out of scope: <...>
Prior art: <src/__tests__/...>
```

One behavior per bullet. Split TRACK A/B when issue allows parallel work. No horizontal "all tests then all code".

### 5. Footer

- Attach: `zoom-out`, `tdd`, domain skill if needed
- Branch: `feat/issue-<N>-<slug>`

## Output

1. Links (issue, parent, blockers)
2. Prompt A (fenced)
3. Prompt B (fenced)
4. Session order if multiple issues

## Chain

`to-prd` → `to-issues` → **issue-slice-prompts** → `zoom-out` → `tdd`

See [examples.md](./examples.md).
