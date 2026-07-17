<!--
Merged from:
- antigravity-awesome-skills-main/plugins/antigravity-awesome-skills-claude/skills/javascript-typescript-typescript-scaffold/SKILL.md
- agents-main (2)/agents-main/plugins/tailwindcss/skills/tailwindcss-core/SKILL.md
-->

# JavaScript/TypeScript & Frontend Patterns

Modern JavaScript and TypeScript patterns for frontend development with Tailwind CSS.

## When to Use

- Setting up new JavaScript/TypeScript projects
- Building React, Vue, or vanilla JS applications
- Configuring TypeScript with strict type safety
- Using Tailwind CSS v4 with CSS-first configuration
- Creating production-ready frontend architecture

---

## TypeScript Project Scaffolding

### Project Types

- **Next.js**: Full-stack React applications, SSR/SSG, API routes
- **React + Vite**: SPA applications, component libraries
- **Node.js API**: Express/Fastify backends, microservices
- **Library**: Reusable packages, utilities, tools
- **CLI**: Command-line tools, automation scripts

### Next.js Project Structure

```bash
pnpm create next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"
```

```
nextjs-project/
├── package.json
├── tsconfig.json
├── next.config.js
├── .env.example
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── api/health/route.ts
│   ├── components/
│   │   ├── ui/Button.tsx
│   │   └── layout/Header.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   └── utils.ts
│   └── hooks/
│       └── useAuth.ts
└── tests/
```

### React + Vite Project Structure

```bash
pnpm create vite . --template react-ts
```

### Node.js API Project Structure

```
nodejs-api/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── app.ts
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   ├── models/
│   ├── middleware/
│   └── types/
└── tests/
```

---

## Tailwind CSS v4 Configuration

### CSS-First Setup

```css
/* app.css - The only required CSS file */
@import "tailwindcss";

@theme {
  /* Colors using modern oklch */
  --color-primary: oklch(0.6 0.2 250);
  --color-secondary: oklch(0.7 0.15 180);

  /* Typography */
  --font-sans: 'Inter Variable', system-ui, sans-serif;

  /* Custom spacing */
  --spacing-md: 1rem;
  --spacing-lg: 2rem;

  /* Custom breakpoints */
  --breakpoint-xs: 475px;
  --breakpoint-3xl: 1920px;
}

/* Custom utilities */
@utility truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@utility text-balance {
  text-wrap: balance;
}
```

### Vite Configuration

```javascript
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()]
})
```

---

## Best Practices

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "paths": { "@/*": ["./src/*"] }
  }
}
```

### Project Structure Guidelines

1. **src/** - All source code
2. **components/** - UI components
3. **lib/** - Utilities and helpers
4. **hooks/** - Custom React hooks
5. **types/** - TypeScript type definitions
6. **tests/** - Test files
7. **.env.example** - Environment template
8. **package.json** - Dependencies and scripts

### Testing Setup

```javascript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
})
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

## Responsive Design

```html
<!-- Default breakpoints -->
<div class="text-sm md:text-base lg:text-lg">
  <div class="p-4 md:p-6 lg:p-8">
    <div class="grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      <!-- Responsive content -->
    </div>
  </div>
</div>
```

---

## Performance Tips

1. Use `select_related` and `prefetch_related` for database queries
2. Cache expensive operations with Redis or memory cache
3. Implement pagination for large datasets
4. Use `React.memo` and `useMemo` judiciously
5. Lazy load heavy components
6. Virtualize long lists
7. Compress responses and use CDN