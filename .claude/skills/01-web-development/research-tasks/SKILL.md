---
name: research-tasks
description: Process for answering research questions using the web and saving findings
  into the workspace.
allowed-tools: Read, Grep, Glob
model: sonnet
version: 1.0.0
category: 01-web-development
tags: []
harness:
- claude-code
- opencode
---

# Research task process

1. Use `web_search` first for broad queries; use the browser tools when you need to read a specific page.
2. Capture useful URLs and short quotes into a markdown file under `notes/` in the workspace.
3. Never invent sources. If a claim isn't supported by something you actually fetched, drop it.
4. Final answer format:
   - **Answer:** one paragraph.
   - **Sources:** bulleted list of URLs.
   - **Notes file:** path to the saved markdown notes.
