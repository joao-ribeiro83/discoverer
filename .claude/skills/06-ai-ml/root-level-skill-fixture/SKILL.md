---
name: root-level-skill-fixture
description: Minimal fixture skill for regression coverage of root-level SKILL.md
  discovery.
allowed-tools: Read
model: opus
version: 1.0.0
category: 06-ai-ml
tags:
- test-fixture
harness:
- claude-code
- opencode
---

## Overview

Fixture skill used by `tests/test_root_level_skill_discovery.py`. It exists solely
to verify that the validator's batch walker (`find_skill_files`) picks up
plugins that follow the Anthropic-spec layout — SKILL.md at plugin root with no
`skills/<name>/` subdirectory.

## Prerequisites

None — this is a static fixture.

## Instructions

Do not invoke this skill. It is a test fixture only.

## Output

N/A.

## Error Handling

N/A.

## Examples

N/A.

## Resources

- `scripts/validate-skills-schema.py` — the function under test.
