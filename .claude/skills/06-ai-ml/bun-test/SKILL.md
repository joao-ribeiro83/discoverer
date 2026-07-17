---
name: bun-test
description: |-
  Bun test runner with compact agent-friendly output. Use when running bun tests, targeting a pattern, collecting --coverage, watching, or emitting JUnit XML for CI.
allowed-tools: Bash, BashOutput, Read
model: opus
version: 1.0.0
category: 06-ai-ml
tags: []
harness:
- claude-code
- opencode
---

# /bun:test

Run tests using Bun's built-in test runner with optimized output.

## When to Use This Skill

| Scenario | Use this skill | Alternative |
|----------|---------------|-------------|
| Quickly running tests with compact output | Yes | N/A |
| Running a specific test file or pattern | Yes | N/A |
| Running tests with coverage | Yes | N/A |
| Configuring test runner options in detail | No - use `bun-development` | Full test configuration guidance |
| Debugging failing tests interactively | No - use `typescript-debugging` | Inspector-based debugging |

## Parameters

- `pattern` (optional): Test file or name pattern
- `--coverage`: Enable code coverage reporting
- `--bail`: Stop on first failure
- `--watch`: Watch mode for development

## Execution

**Quick feedback (default for agentic use):**
```bash
bun test --dots --bail=1 $PATTERN
```

**With coverage:**
```bash
bun test --dots --coverage $PATTERN
```

**Watch mode:**
```bash
bun test --watch $PATTERN
```

**CI mode (JUnit output):**
```bash
bun test --reporter=junit --reporter-outfile=junit.xml $PATTERN
```

## Output Interpretation

| Symbol | Meaning |
|--------|---------|
| `.` | Test passed |
| `F` | Test failed |
| `S` | Test skipped |

## Agentic Optimizations

| Context | Command |
|---------|---------|
| Quick test | `bun test --dots --bail=1` |
| Filtered test | `bun test --dots --bail=1 -t "pattern"` |
| With coverage | `bun test --dots --coverage` |
| CI output | `bun test --reporter=junit --reporter-outfile=junit.xml` |
| Watch mode | `bun test --watch` |

## Post-test

1. Report pass/fail summary
2. If failures: show first failure details
3. If coverage enabled: report coverage percentage
