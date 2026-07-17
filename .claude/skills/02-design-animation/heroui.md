<!--
Merged from:
- heroui-3/skills/heroui-react/SKILL.md
- heroui-3/skills/heroui-migration/SKILL.md
- heroui-3/skills/heroui-native/SKILL.md
-->

# HeroUI v3 Development Guide

HeroUI v3 is a React component library built with **Tailwind CSS v4** and optionally **React Aria Components**, providing accessible, customizable UI components.

## Installation

```bash
curl -fsSL https://heroui.com/install | bash -s heroui-react
```

**Dependencies:**
```bash
npm i @heroui/styles @heroui/react tailwind-variants
```

## CRITICAL: v3 Only - Ignore v2 Knowledge

This guide is for HeroUI v3 ONLY. Do NOT apply v2 patterns:

| Feature       | v2 (DO NOT USE)               | v3 (USE THIS)                               |
| ------------- | ----------------------------- | ------------------------------------------- |
| Provider      | `<HeroUIProvider>` required   | **No Provider needed**                      |
| Component API | Flat props: `<Card title="x">` | Compound: `<Card><Card.Header>`             |
| Event handlers | `onClick`                    | `onPress`                              |
| Styling       | `classNames` prop            | `className` prop                       |
| Hooks         | `useSwitch`, `useDisclosure`  | Compound components, `useOverlayState` |
| Packages      | `@heroui/system`, `@heroui/theme` | `@heroui/react`, `@heroui/styles` |

### CORRECT (v3 patterns)
```tsx
import { Card } from "@heroui/react";

<Card>
  <Card.Header>
    <Card.Title>Product</Card.Title>
    <Card.Description>A great product</Card.Description>
  </Card.Header>
</Card>;
```

---

## Core Principles

- **Semantic variants** (`primary`, `secondary`, `tertiary`) over visual descriptions
- **Composition over configuration** (compound components)
- **CSS variable-based theming** with `oklch` color space
- **BEM naming convention** for predictable styling

---

## Setup

### Next.js App Router (Recommended)

1. **Install dependencies:**
```bash
npm i @heroui/styles @heroui/react tailwind-variants tailwindcss @tailwindcss/postcss postcss
```

2. **Create/update `app/globals.css`:**
```css
/* Tailwind CSS v4 - Must be first */
@import "tailwindcss";

/* HeroUI v3 styles - Must be after Tailwind */
@import "@heroui/styles";
```

3. **Import in `app/layout.tsx`:**
```tsx
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* No Provider needed in HeroUI v3! */}
        {children}
      </body>
    </html>
  );
}
```

4. **Configure PostCSS (`postcss.config.mjs`):**
```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

**Critical Requirements:**
1. Tailwind CSS v4 is MANDATORY
2. Use Compound Components (`Card.Header`, `Button` with children)
3. Use `onPress`, not `onClick`
4. Import order matters: Tailwind before HeroUI styles

---

## Component Patterns

All components use the **compound pattern**:
- `Card` → `Card.Header`, `Card.Content`, `Card.Footer`
- Check `@heroui/react` package for specific component anatomy
- Use `tv()` from `tailwind-variants` for styling

---

## Semantic Variants

| Variant     | Purpose                           | Usage          |
| ----------- | --------------------------------- | -------------- |
| `primary`   | Main action to move forward       | 1 per context  |
| `secondary` | Alternative actions               | Multiple       |
| `tertiary`  | Dismissive actions (cancel, skip) | Sparingly      |
| `danger`    | Destructive actions               | When needed    |
| `ghost`     | Low-emphasis actions              | Minimal weight |
| `outline`   | Secondary actions                 | Bordered style |

---

## Theming

HeroUI v3 uses CSS variables with `oklch` color space:

```css
:root {
  --accent: oklch(0.6204 0.195 253.83);
  --accent-foreground: var(--snow);
  --background: oklch(0.9702 0 0);
  --foreground: var(--eclipse);
}
```

**Theme switching:**
```html
<html class="dark" data-theme="dark"></html>
```

---

## Migration from v2 to v3

### Key Changes

1. **No Provider** - Remove `HeroUIProvider` when migrating
2. **Compound Components** - v3 uses nested structure, not flat props
3. **onPress not onClick** - All interactive components use `onPress`
4. **Tailwind CSS v4** - Mandatory upgrade from v3
5. **Package Changes** - Use `@heroui/react` and `@heroui/styles`

### Migration Strategies

**Full Migration:**
- Best for: Projects that can dedicate focused time
- Migrate all component code first
- Switch dependencies to v3
- Complete styling migration

**Incremental Migration:**
- Best for: Projects that must stay functional
- Set up coexistence (pnpm aliases)
- Migrate components one-by-one
- Both v2 and v3 coexist during migration

### Migration Workflow

1. Create migration branch
2. Analyze project (HeroUI imports, component usage)
3. Fetch main guide: `node scripts/get_migration_guide.mjs full` or `incremental`
4. Migrate components in batches
5. Switch dependencies to v3
6. Apply styling updates

---

## HeroUI Native (Mobile)

For React Native / Expo mobile applications:

```bash
# Expo
npx expo install react-native-auth0

# React Native CLI
npm install react-native-auth0
npx pod-install  # iOS only
```

**Native Platform Setup:**
- iOS: Info.plist URL schemes
- Android: AndroidManifest.xml intent-filters
- Use `react-native-auth0` SDK

---

## Available Components

- `accordion` - Collapsible content sections
- `alert` - Alert messages
- `avatar` - User avatars
- `button` - Interactive buttons
- `checkbox` - Checkboxes
- `chip` - Informational badges
- `description` - Form field descriptions
- `field-error` - Error messages
- `fieldset` - Form field grouping
- `label` - Form labels
- `link` - Anchor links
- `menu` - Dropdown menus
- `popover` - Overlays
- `spinner` - Loading indicators
- `tabs` - Tab navigation
- `textfield` - Input fields
- `tooltip` - Hover tooltips

---

## Performance Notes

- **Session caching**: 60-second TTL, automatic JWT expiration handling
- **Request deduplication**: Concurrent calls share single network request
- **Cross-tab sync**: <50ms via BroadcastChannel