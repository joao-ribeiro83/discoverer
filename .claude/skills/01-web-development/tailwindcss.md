<!--
Merged from:
- agents-main (2)/agents-main/plugins/tailwindcss/skills/tailwindcss-core/SKILL.md
- agents-main (2)/agents-main/plugins/tailwindcss/skills/tailwindcss-responsive/SKILL.md
- agents-main (2)/agents-main/plugins/tailwindcss/skills/tailwindcss-layout/SKILL.md
- claude-plugin-marketplace-main/plugins/tailwindcss-master/skills/tailwindcss-fundamentals-v4/SKILL.md
-->

# Tailwind CSS v4 Comprehensive Guide

Tailwind CSS v4.0 was released January 22, 2025, featuring a complete rewrite with a Rust-based engine, CSS-first configuration, and significant performance improvements.

## Installation

### Vite Projects (Recommended)

```bash
npm install -D tailwindcss @tailwindcss/vite
```

```javascript
// vite.config.js
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tailwindcss()]
})
```

### PostCSS Projects

```bash
npm install -D tailwindcss @tailwindcss/postcss
```

```javascript
// postcss.config.mjs
export default {
  plugins: {
    '@tailwindcss/postcss': {}
  }
}
```

### CSS Entry Point

```css
/* app.css - The only required CSS file */
@import "tailwindcss";
```

---

## CSS-First Configuration

### The @theme Directive

Replace `tailwind.config.js` with CSS-based configuration:

```css
@import "tailwindcss";

@theme {
  /* Colors using modern oklch */
  --color-primary: oklch(0.6 0.2 250);
  --color-secondary: oklch(0.7 0.15 180);
  --color-accent: oklch(0.8 0.2 30);
  --color-success: oklch(0.6 0.15 145);
  --color-warning: oklch(0.75 0.15 65);
  --color-error: oklch(0.55 0.2 25);

  /* Typography */
  --font-sans: 'Inter Variable', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  /* Custom spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 2rem;
  --spacing-xl: 4rem;

  /* Custom breakpoints */
  --breakpoint-xs: 475px;
  --breakpoint-3xl: 1920px;

  /* Border radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;

  /* Shadows */
  --shadow-sm: 0 1px 2px oklch(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px oklch(0 0 0 / 0.07);

  /* Easing */
  --ease-fluid: cubic-bezier(0.3, 0, 0, 1);
  --ease-snappy: cubic-bezier(0.2, 0, 0, 1);
}
```

### Theme Variables Reference

| Category | Variable Pattern | Example |
|----------|-----------------|---------|
| Colors | `--color-*` | `--color-brand-500` |
| Fonts | `--font-*` | `--font-heading` |
| Spacing | `--spacing-*` | `--spacing-4` |
| Breakpoints | `--breakpoint-*` | `--breakpoint-3xl` |
| Radius | `--radius-*` | `--radius-lg` |
| Shadows | `--shadow-*` | `--shadow-xl` |

---

## Key Directives

### @import "tailwindcss"

Entry point to load Tailwind CSS. Place at the beginning of your main CSS file.

### @source

Directive to include additional source files with glob patterns:

```css
@source "./routes/**/*.{ts,tsx}";
@source "./components/**/*.{tsx,jsx}";
@source "../packages/ui/src/**/*.{ts,tsx}";
```

### @utility

Create custom utilities:

```css
@utility truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@utility text-balance {
  text-wrap: balance;
}

@utility content-auto {
  content-visibility: auto;
  contain-intrinsic-size: auto 500px;
}
```

### @custom-variant

Create custom variants:

```css
@custom-variant dark (&:where(.dark, .dark *));
@custom-variant hocus (&:hover, &:focus);
@custom-variant group-hocus (:merge(.group):hover &, :merge(.group):focus &);
@custom-variant data-loading (&[data-loading="true"]);
@custom-variant children (& > *);
```

### @plugin

Load Tailwind plugins:

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
@plugin "@tailwindcss/forms";
@plugin "@tailwindcss/container-queries";
```

---

## Responsive Design

### Default Breakpoints

| Variant | Size | CSS |
|---------|------|-----|
| `sm:` | 40rem (640px) | `@media (width >= 40rem)` |
| `md:` | 48rem (768px) | `@media (width >= 48rem)` |
| `lg:` | 64rem (1024px) | `@media (width >= 64rem)` |
| `xl:` | 80rem (1280px) | `@media (width >= 80rem)` |
| `2xl:` | 96rem (1536px) | `@media (width >= 96rem)` |

### Custom Breakpoints

```css
@theme {
  --breakpoint-3xl: 120rem;
}
/* Usage: 3xl:grid-cols-6 */
```

### Container Queries

```html
<div class="@container">
  <div class="@md:grid-cols-2 @lg:grid-cols-3">
    <!-- Responsive to container -->
  </div>
</div>
```

### Mobile-first Class Ordering

```html
<div class="
  text-sm md:text-base lg:text-lg
  p-4 md:p-6 lg:p-8
  grid-cols-1 md:grid-cols-2 lg:grid-cols-3
">
  Content
</div>
```

---

## Layout Utilities

### Flexbox

```html
<div class="flex flex-col md:flex-row items-center justify-between gap-4">
  <!-- Flex container -->
</div>
```

### Grid

```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <!-- Grid layout -->
</div>
```

### Container

```html
<div class="container mx-auto px-4">
  <!-- Centered container -->
</div>
```

---

## Best Practices (2025/2026)

### 1. Use OKLCH Colors for Design Systems

OKLCH provides perceptually uniform colors, better gradients, and wide gamut support:

```css
@theme {
  --color-primary-50: oklch(0.97 0.02 250);
  --color-primary-100: oklch(0.93 0.04 250);
  --color-primary-500: oklch(0.55 0.2 250);  /* Base */
  --color-primary-600: oklch(0.48 0.2 250);
  --color-primary-900: oklch(0.27 0.12 250);
}
```

### 2. Implement Fluid Typography

```css
@theme {
  --text-fluid-xs: clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem);
  --text-fluid-sm: clamp(0.875rem, 0.8rem + 0.375vw, 1rem);
  --text-fluid-base: clamp(1rem, 0.9rem + 0.5vw, 1.125rem);
  --text-fluid-lg: clamp(1.125rem, 1rem + 0.625vw, 1.25rem);
  --text-fluid-xl: clamp(1.25rem, 1rem + 1.25vw, 1.5rem);
  --text-fluid-2xl: clamp(1.5rem, 1.1rem + 2vw, 2rem);
  --text-fluid-3xl: clamp(1.875rem, 1.2rem + 3.375vw, 2.5rem);
  --text-fluid-4xl: clamp(2.25rem, 1rem + 6.25vw, 3.5rem);
}
```

### 3. Fluid Spacing System

```css
@theme {
  --spacing-fluid-sm: clamp(0.5rem, 0.4rem + 0.5vw, 1rem);
  --spacing-fluid-md: clamp(1rem, 0.75rem + 1.25vw, 2rem);
  --spacing-fluid-lg: clamp(2rem, 1rem + 3vw, 4rem);
  --spacing-fluid-section: clamp(4rem, 2rem + 8vw, 8rem);
}
```

### 4. Accessible Interactive Elements

```html
<button class="
  min-h-11 min-w-11 px-4 py-2.5
  bg-primary-600 hover:bg-primary-700 text-white
  rounded-lg font-medium
  focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
  transition-colors motion-reduce:transition-none
">
  Button Text
</button>
```

---

## Migration from v3

### Border Color Default

```css
/* v3: border used gray-200 by default */
/* v4: border uses currentColor */

@theme {
  --default-border-color: var(--color-gray-200);
}
```

### Ring Default

```css
/* v3: ring was 3px blue-500 */
/* v4: ring is 1px currentColor */

@theme {
  --default-ring-width: 3px;
  --default-ring-color: var(--color-blue-500);
}
```

### Button Cursor

```css
/* v4: buttons use cursor: default */
button {
  cursor: pointer;
}
```

---

## Core Utility Categories

### Layout

```html
<div class="flex flex-col md:flex-row items-center justify-between gap-4">
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
<div class="container mx-auto px-4">
```

### Spacing

```html
<div class="p-4 px-6 py-2">
<div class="m-4 mx-auto my-8">
<div class="gap-4 gap-x-6 gap-y-2">
```

### Typography

```html
<p class="text-sm md:text-base lg:text-lg">
<h1 class="font-bold">
<p class="text-gray-600 dark:text-gray-300">
<p class="leading-relaxed">
```

### Colors

```html
<div class="bg-white dark:bg-gray-900">
<p class="text-blue-600">
<div class="border border-gray-200">
<button class="focus:ring-2 focus:ring-blue-500">
```

### Sizing

```html
<div class="w-full md:w-1/2 lg:w-1/3">
<div class="h-screen min-h-[500px]">
<div class="max-w-xl mx-auto">
```

---

## Built-in Features (No Config Needed)

| Feature | v3 Requirement | v4 |
|---------|---------------|-----|
| @import handling | postcss-import | Built-in |
| Vendor prefixing | autoprefixer | Built-in |
| CSS nesting | postcss-nested | Built-in |
| Content detection | content config | Automatic |

---

## References

- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
- [Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide)