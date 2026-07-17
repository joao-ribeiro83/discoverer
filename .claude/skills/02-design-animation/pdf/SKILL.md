---
name: pdf
description: |-
  Handle PDF manipulation, form filling, text/table extraction, and high-fidelity generation. Use for professional PDF reports, merging documents, and automated form processing. Use proactively when visual quality and verification are critical.
allowed-tools: Read, Grep, Glob
model: fable
version: 1.0.0
category: 02-design-animation
tags: []
harness:
- claude-code
- opencode
---

<instructions>
<instructions>
# PDF Professional Suite

## 🛠 High-Fidelity Creation
When generating polished reports:
1. **Generate**: Use **Reportlab** (programmatic) or **Platypus** (templated) as the primary engine.
2. **Preview**: Convert every page to PNG for inspection:
   - `pdftoppm -png -r 150 document.pdf page`
3. **Inspect**: Verify that charts, tables, and typography are sharp and well-aligned.

## 📋 Common Operations

### 1. Form Filling
- Identify fillable fields using `scripts/extract_form_field_info.py`.
- **Reference**: See `references/forms.md` for detailed instructions on filling PDF forms.
- Populate fields programmatically and verify using the Render loop.

### 2. Manipulation (pypdf)
- **Merge**: Use `PdfWriter` to combine multiple documents.
- **Split**: Extract individual pages into new files.
- **Secure**: Add passwords or watermarks using `PdfWriter.encrypt()`.
- **Reference**: See `references/reference.md` for advanced features and JS library alternatives.

### 3. Extraction (pdfplumber)
- Extract text with layout preservation.
- Extract complex tables directly into Pandas DataFrames for analysis.

## 💎 Quality Expectations
- **Legibility**: Text must be readable at 100% zoom; avoid walls of dense text.
- **Polish**: Maintain intentional visual design—consistent margins and color palettes.
- **Verification**: Zero defects (black squares, clipped text) permitted in final output.
</instructions>
