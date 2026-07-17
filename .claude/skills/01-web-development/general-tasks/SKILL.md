---
name: general-tasks
description: Default process for handling open-ended tasks that touch files, the shell,
  or the web.
allowed-tools: Read, Grep, Glob
model: sonnet
version: 1.0.0
category: 01-web-development
tags: []
harness:
- claude-code
- opencode
---

# General task process

1. Restate the goal in one sentence.
2. List the concrete steps you intend to take before doing them.
3. Execute steps one at a time. After each step, briefly note the outcome.
4. Prefer reading existing files before writing new ones.
5. When you're done, summarize:
   - What changed (files created/edited).
   - What you verified.
   - What remains open.
