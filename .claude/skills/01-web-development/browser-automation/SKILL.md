---
name: browser-automation
description: |-
  Programmatic web automation using Playwright Python — data extraction, form filling, multi-step workflows, auth session management, screenshot/PDF capture, and anti-detection patterns. Use for scripted automation tasks, not interactive MCP-based browser control.
allowed-tools: Read, Grep, Glob
model: sonnet
version: 1.0.0
category: 01-web-development
tags:
- playwright
- browser
- automation
- scraping
- data-extraction
- forms
- screenshots
- pdf
- auth
harness:
- claude-code
- opencode
---

# Browser Automation Skill

## Setup

```bash
pip install playwright && playwright install chromium
pip install playwright-stealth  # optional, for anti-detection
```

## Skill Comparison

| Skill                | Use Case                                       |
| -------------------- | ---------------------------------------------- |
| `browser-automation` | Scripted automation, data pipelines, form bots |
| `webapp-testing`     | QA assertions, visual regression, test suites  |
| `chrome-browser`     | Interactive MCP DevTools control               |

## Iron Law

```
NEVER USE time.sleep() — use page.wait_for_selector() or wait_for_load_state()
```

## Core Patterns

### Navigation and Extraction

```python
with sync_playwright() as p:
    context = p.chromium.launch(headless=True).new_context(
        user_agent="Mozilla/5.0 ...", viewport={"width": 1280, "height": 720})
    page = context.new_page()
    page.goto(url); page.wait_for_load_state("networkidle")
    items = [i.inner_text() for i in page.get_by_role("listitem").all()]
```

### Form Filling

```python
page.get_by_label("Email").fill("user@example.com")
page.get_by_label("Password").fill("secret")
with page.expect_navigation():
    page.get_by_role("button", name="Submit").click()
```

### Screenshot and PDF

```python
page.screenshot(path="full.png", full_page=True)
page.pdf(path="page.pdf", format="A4", print_background=True)
```

### Auth Session Management

```python
# Save session
context.storage_state(path="auth-state.json")
# Reuse session
context = browser.new_context(storage_state="auth-state.json")
```

### Anti-Detection

```python
browser = p.chromium.launch(args=["--disable-blink-features=AutomationControlled"])
context = browser.new_context(user_agent="...", locale="en-US", timezone_id="America/New_York")
page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
```

## Agent Usage

- Save extracted data to `.claude/context/tmp/` as structured JSON
- Save screenshots/PDFs to `.claude/context/artifacts/`
- Never commit `auth-state.json` — add to `.gitignore`

## Anti-Patterns

| Anti-Pattern             | Correct Approach                                     |
| ------------------------ | ---------------------------------------------------- |
| `time.sleep()` for waits | `page.wait_for_selector()` / `wait_for_load_state()` |
| CSS selectors for forms  | `get_by_label()`, `get_by_role()`                    |
| Re-login each run        | `context.storage_state()` persistence                |
| Committing auth state    | Add `auth-state.json` to `.gitignore`                |

## Memory Protocol (MANDATORY)

**Before starting:** Read `.claude/context/memory/learnings.md`

**After completing:**

- New extraction pattern -> `.claude/context/memory/learnings.md`
- Bot detection encountered -> `.claude/context/memory/issues.md`

> ASSUME INTERRUPTION: If it's not in memory, it didn't happen.
