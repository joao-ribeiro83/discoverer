---
name: branding
description: |-
  Apply official brand colors and typography to professional artifacts. Use for presentations, reports, and documents to ensure corporate visual identity. Use proactively when a 'client-ready' look-and-feel is requested.
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
The agent MUST apply official corporate visual standards to all professional artifacts. However, these standards MUST NOT be assumed if they are not explicitly defined in the `<visual_standards>` section.

If the placeholders in `<visual_standards>` have not been replaced with actual values, the agent MUST:
1. Notify the user that branding guidelines are not yet configured.
2. Request the specific Hex codes and Font families from the user.
3. Suggest that the user updates this `SKILL.md` file or provides a `BRANDING.md` in the vault for long-term persistence.
</instructions>

<visual_standards>
## 🎨 Corporate Identity Placeholders
The following values are currently UNDEFINED. The agent MUST NOT invent these values.

### 1. Primary Colors
- **Primary (Dark)**: [INSERT_HEX_CODE] (Recommended for primary text)
- **Secondary (Light)**: [INSERT_HEX_CODE] (Recommended for backgrounds)
- **Neutral**: [INSERT_HEX_CODE] (Recommended for secondary elements)

### 2. Accent Colors
- **Accent 1**: [INSERT_HEX_CODE]
- **Accent 2**: [INSERT_HEX_CODE]
- **Accent 3**: [INSERT_HEX_CODE]

### 3. Typography
- **Headings Font**: [FONT_FAMILY_NAME] (e.g., Poppins, Helvetica)
- **Body Font**: [FONT_FAMILY_NAME] (e.g., Lora, Georgia)
</visual_standards>

<workflow>
1. **Validation**: Check `<visual_standards>` for active placeholders. If found, the agent MUST pause and request details from the user.
2. **Analysis**: Once defined, identify headings vs. body text in the target artifact.
3. **Mapping**: Assign primary colors to text and accent colors to shapes/charts/highlights.
4. **Execution**: Update the font and color properties in the target file (DOCX/PPTX XML, CSS, or HTML).
5. **Verification**: The agent SHOULD verify accessibility (color contrast) and visual hierarchy after applying the brand.
</workflow>
