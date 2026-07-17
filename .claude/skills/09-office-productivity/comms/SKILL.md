---
name: comms
description: |-
  Apply standardized formats for internal business communications. Use for status reports, company newsletters, FAQs, and leadership updates. Use proactively when consistency in corporate communication is required.
allowed-tools: Read, Grep, Glob
model: haiku
version: 1.0.0
category: 09-office-productivity
tags: []
harness:
- claude-code
- opencode
---

<instructions>
# Internal Communications Suite

## 📋 Communication Types
- **3P updates**: Progress, Plans, Problems.
- **Newsletters**: Company-wide announcements.
- **FAQ responses**: Standardized project Q&A.
- **Leadership updates**: High-altitude status reports.

## 🔄 Workflow
1. **Identify**: Determine the communication type from the request.
2. **Load**: Reference the guideline files in `assets/examples/`.
3. **Draft**: Follow the specific tone and formatting instructions in the example.
4. **Refine**: Ensure the content is concise and stakeholder-aligned.

## 📁 Resource Map
- `assets/examples/3p-updates.md`
- `assets/examples/company-newsletter.md`
- `assets/examples/faq-answers.md`
- `assets/examples/general-comms.md`
</instructions>
