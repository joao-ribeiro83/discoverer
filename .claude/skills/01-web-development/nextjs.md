<!--
Merged from:
- agents-main/plugins/frontend-mobile-development/skills/nextjs-app-router-patterns/SKILL.md
- agents-main (2)/agents-main/plugins/nextjs-expert/skills/nextjs-16/SKILL.md
- agents-main (2)/agents-main/plugins/nextjs-expert/skills/nextjs-i18n/SKILL.md
- agents-main (2)/agents-main/plugins/nextjs-expert/skills/nextjs-server-components/SKILL.md
- agents-main (2)/agents-main/plugins/nextjs-expert/skills/nextjs-tanstack-query/SKILL.md
- agents-main (2)/agents-main/plugins/nextjs-expert/skills/nextjs-shadcn/SKILL.md
- agent-skills-main (1)/agent-skills-main/nextjs-framer-motion-animations/SKILL.md
- ag-kit-main/.agents/skills/nextjs-react-expert/SKILL.md
- ECC-main/.agents/skills/nextjs-turbopack/SKILL.md
-->

# Next.js Comprehensive Guide

Production-ready React framework with Server Components, streaming, and Turbopack.

## When to Use This Skill

- Building new React applications with server-first architecture
- Need Server Components for optimal performance and SEO
- Implementing streaming and progressive rendering
- Migrating from Next.js 14/15 to version 16
- Using proxy.ts for route protection (replaces middleware)
- Leveraging Turbopack for faster development builds
- Implementing internationalization (i18n)
- Integrating TanStack Query for server state management
- Building UI with shadcn/ui components

---

## Next.js 16 Features

### What's New in Next.js 16

| Feature | Benefit |
|---------|---------|
| Turbopack default | 2-5x faster builds, 10x faster HMR, Webpack deprecated |
| Cache Components | Explicit caching with `use cache` directive |
| proxy.ts | Full Node.js runtime, replaces Edge middleware |
| React Compiler | Automatic memoization, no manual useMemo/useCallback |
| React 19 | View Transitions, useEffectEvent, Activity component |
| App Router | Nested layouts, parallel routes, intercepting routes |

### Breaking Changes from v15

1. **proxy.ts replaces middleware.ts** - Full Node.js runtime, not Edge
2. **Turbopack ONLY** - Webpack completely deprecated and removed
3. **`use cache` directive** - Replaces Partial Prerendering (PPR)
4. **React 19 required** - New hooks and View Transitions API
5. **Async params/searchParams** - Must await dynamic route params

---

## Core Concepts

### 1. Rendering Modes

| Mode | Where | When to Use |
|------|-------|-------------|
| **Server Components** | Server only | Data fetching, heavy computation, secrets |
| **Client Components** | Browser | Interactivity, hooks, browser APIs |
| **Static** | Build time | Content that rarely changes |
| **Dynamic** | Request time | Personalized or real-time data |
| **Streaming** | Progressive | Large pages, slow data sources |

### 2. Server Components (Default)

All components are Server Components by default. Use `'use client'` directive only when needed for interactivity, hooks, or browser APIs.

**Critical Rules:**
1. Server Components are default - No directive needed
2. `'use client'` only when needed - Hooks, events, browser APIs
3. Never import server-only into client - Use `server-only` package
4. Props must be serializable - No functions, classes, or Dates across boundary
5. Async components are server-only - Client Components cannot be async
6. Colocate data fetching - Fetch where the data is consumed

### 3. File Conventions

```
app/
├── layout.tsx       # Shared UI wrapper
├── page.tsx         # Route UI
├── loading.tsx      # Loading UI (Suspense)
├── error.tsx        # Error boundary
├── not-found.tsx    # 404 UI
├── route.ts         # API endpoint
├── template.tsx     # Re-mounted layout
├── default.tsx      # Parallel route fallback
└── opengraph-image.tsx  # OG image generation
```

---

## Quick Start

```typescript
// app/layout.tsx
import { Inter } from 'next/font/google'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: { default: 'My App', template: '%s | My App' },
  description: 'Built with Next.js App Router',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

// app/page.tsx - Server Component by default
async function getProducts() {
  const res = await fetch('https://api.example.com/products', {
    next: { revalidate: 3600 }, // ISR: revalidate every hour
  })
  return res.json()
}

export default async function HomePage() {
  const products = await getProducts()

  return (
    <main>
      <h1>Products</h1>
      <ProductGrid products={products} />
    </main>
  )
}
```

---

## App Router Patterns

### Routing Structure

```
app/
├── layout.tsx            # Root layout
├── page.tsx              # Home page
├── dashboard/
│   ├── layout.tsx        # Dashboard shared layout
│   ├── page.tsx          # /dashboard
│   └── analytics/
│       └── page.tsx      # /dashboard/analytics
├── users/
│   └── [userId]/
│       └── page.tsx      # Dynamic route: /users/123
└── api/
    └── route.ts          # API endpoint
```

### Parallel Routes

Parallel routes allow you to render multiple pages in the same layout:

```typescript
// app/dashboard/@users/page.tsx
export default function UsersSlot() {
  return <UsersList />
}

// app/dashboard/@stats/page.tsx  
export default function StatsSlot() {
  return <StatsChart />
}

// app/dashboard/layout.tsx
export default function DashboardLayout({
  users,
  stats,
  children
}: {
  users: React.ReactNode
  stats: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex">
      <aside>{stats}</aside>
      <main>{children}</main>
      <aside>{users}</aside>
    </div>
  )
}
```

### Intercepting Routes

Create overlays without navigation:

```typescript
// app/@modal/(.)photo/[id]/page.tsx - Intercepted photo modal
export default function PhotoModal({ params }: { params: { id: string } }) {
  return <PhotoLightbox id={params.id} />
}

// app/photo/[id]/page.tsx - Full page route
export default function PhotoPage({ params }: { params: { id: string } }) {
  return <PhotoDetail id={params.id} />
}
```

---

## Data Fetching

### Server Components Fetching

Server Components fetch data directly without separate API routes:

```typescript
// app/products/page.tsx (Server Component)
async function getProducts() {
  const res = await fetch('https://api.example.com/products', {
    next: { revalidate: 3600 }, // ISR
  })
  return res.json()
}

export default async function ProductsPage() {
  const products = await getProducts()
  return <ProductGrid products={products} />
}
```

### Caching with `use cache` Directive

```typescript
'use cache'
export async function getCachedData() {
  const data = await fetch('https://api.example.com/data')
  return data.json()
}
```

Cache control:
- `cacheTag()` - Tag cached data for targeted revalidation
- `cacheLife()` - Control cache duration (stale, revalidate, expire)
- `revalidateTag()` - Invalidate cached data on-demand

### TanStack Query Integration

For client-side data fetching with caching:

```typescript
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query'
import { HydrationBoundary } from '@tanstack/react-query'

// Server Component - prefetch data
async function ServerPage() {
  const queryClient = new QueryClient()
  
  await queryClient.prefetchQuery({
    queryKey: ['products'],
    queryFn: () => fetch('/api/products').then(r => r.json()),
    staleTime: 60000 // Prevent immediate refetch
  })

  return (
    <HydrationBoundary state={queryClient}>
      <ClientPage />
    </HydrationBoundary>
  )
}

// Client Component
'use client'
function ClientPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => fetch('/api/products').then(r => r.json())
  })
  
  if (isLoading) return <div>Loading...</div>
  return <ProductList products={data} />
}
```

---

## Internationalization (i18n)

### Locale-Based Routing

All routes prefixed with `[locale]` dynamic segment:

- `/en/about` → English about page
- `/fr/about` → French about page
- `/` → Redirects to default locale

### next-intl Setup

```bash
bun add next-intl
```

```typescript
// src/modules/cores/i18n/src/config/routing.ts
import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'fr', 'de'],
  defaultLocale: 'en'
})
```

```typescript
// app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'

export default async function LocaleLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <NextIntlClientProvider messages={messages}>
        {children}
      </NextIntlClientProvider>
    </html>
  )
}
```

### Message Formatting

ICU MessageFormat support:
- **Pluralization** - `{count, plural, one {# item} other {# items}}`
- **Select** - `{gender, select, male {He} female {She} other {They}}`
- **Rich text** - Support for bold, italic, links in messages

---

## shadcn/ui Integration

### Installation

```bash
bunx --bun shadcn@latest init
bunx --bun shadcn@latest add button input dialog card form
```

### Component Categories

| Category | Components |
|----------|------------|
| Forms | Button, Input, Field, Select, Checkbox, Switch, Slider |
| Overlay | Dialog, Sheet, Drawer, Popover, Tooltip, HoverCard |
| Feedback | Alert, Toast (Sonner), Progress, Skeleton, Spinner |
| Data Display | Table, Badge, Avatar, Calendar, Chart, Carousel |
| Navigation | Breadcrumb, DropdownMenu, Command, Sidebar, Tabs |
| Layout | Card, Accordion, Separator, ScrollArea, Resizable |

### Form Pattern with Field

```typescript
'use client'

import { Form, Field } from '@/modules/cores/shadcn/components/ui/form'
import { Input } from '@/modules/cores/shadcn/components/ui/input'

export function ProfileForm() {
  return (
    <Form>
      <Field name="email">
        <FieldLabel>Email</FieldLabel>
        <Input type="email" />
        <FieldError />
      </Field>
      <Field name="password">
        <FieldLabel>Password</FieldLabel>
        <Input type="password" />
        <FieldError />
      </Field>
    </Form>
  )
}
```

---

## Performance Optimization

### Build Optimization

- **Turbopack** - Incremental compilation, instant HMR
- **React Compiler** - Automatic memoization
- **Tree shaking** - Unused code elimination
- **Code splitting** - Automatic route-based splitting

### Runtime Optimization

- **Streaming** - Progressive HTML rendering
- **Partial hydration** - Only hydrate interactive components
- **Image optimization** - Automatic WebP/AVIF conversion
- **Font optimization** - Zero layout shift with next/font

---

## Best Practices

### Do's

- **Server Components first** - Add 'use client' only when necessary
- **Colocate data fetching** - Fetch data where it's used
- **Use Suspense boundaries** - Enable streaming for slow data
- **Leverage parallel routes** - Independent loading states
- **Use Server Actions** - For mutations with progressive enhancement

### Don'ts

- **Don't pass serializable data** - Server → Client boundary limitations
- **Don't use hooks in Server Components** - No useState, useEffect
- **Don't fetch in Client Components** - Use Server Components or React Query
- **Don't over-nest layouts** - Each layout adds to the component tree
- **Don't ignore loading states** - Always provide loading.tsx or Suspense

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using 'use client' unnecessarily | Keep components as Server Components by default |
| Not handling async params | Use `await params` for dynamic route parameters |
| Missing loading states | Add loading.tsx or Suspense boundaries |
| Large client bundles | Push client boundaries down, keep logic server-side |
| Forgetting hydration | Use HydrationBoundary for TanStack Query |
| Wrong cache strategy | Use `use cache` for server data, TanStack for client cache |

---

## Migration Guides

### Pages Router to App Router

| Pages Router | App Router |
|--------------|------------|
| pages/index.js | app/page.tsx |
| getServerSideProps | Server Component with direct fetch |
| getStaticProps | Server Component with fetch + revalidate |
| getStaticPaths | Dynamic segments with generateStaticParams |
| _app.js | app/layout.tsx |
| _document.js | app/layout.tsx |

---

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js 16 Release Notes](https://nextjs.org/blog/next-16)
- [TanStack Query v5](https://tanstack.com/query/latest)
- [shadcn/ui](https://ui.shadcn.com)
- [next-intl](https://next-intl-docs.vercel.app)