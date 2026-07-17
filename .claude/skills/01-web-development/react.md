<!--
Merged from:
- CoWork-OS-main/resources/skills/react-best-practices/SKILL.md
- ECC-main/.kiro/skills/react-patterns/SKILL.md
-->

# React Patterns & Best Practices

Comprehensive React patterns and performance optimization guide for building robust, accessible, performant component trees.

## When to Apply

Reference these guidelines when:
- Writing new React components or Next.js pages
- Implementing data fetching (client or server-side)
- Reviewing code for performance issues
- Refactoring existing React/Next.js code
- Optimizing bundle size or load times

---

## Core Principles

### 1. Render is a Pure Function of Props and State

```tsx
// Good: derive during render
function Cart({ items }: { items: CartItem[] }) {
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  return <span>{formatMoney(total)}</span>;
}

// Bad: derived state stored separately
function Cart({ items }: { items: CartItem[] }) {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    setTotal(items.reduce((sum, i) => sum + i.price * i.qty, 0));
  }, [items]);
  return <span>{formatMoney(total)}</span>;
}
```

### 2. Side Effects Outside Render

Effects, mutations, network calls, and subscriptions live in event handlers or `useEffect` — never in the render body.

### 3. Composition Over Inheritance

React has no inheritance model for components. Compose with `children`, render props, or component props.

---

## Hooks Discipline

### Rules

- Top-level only, never conditional
- Cleanup every subscription, interval, listener
- Functional updater (`setX(prev => prev + 1)`) when new state depends on old
- Default position: do not memoize — add `useMemo`/`useCallback` only when a profiler proves it matters
- Extract a custom hook only when the same hook sequence appears in 2+ components

---

## State Location Decision Tree

```
Used by one component?
  -> useState inside it

Used by parent + a few descendants?
  -> lift to nearest common ancestor

Used across distant branches AND low-frequency reads (theme, auth, locale)?
  -> React Context

High-frequency updates shared across the tree?
  -> external store (Zustand, Jotai, Redux Toolkit)

Derived from a server?
  -> server-state library (TanStack Query, SWR, RSC fetch)
```

---

## Server / Client Components (RSC)

```tsx
// Server Component - default, async, never ships JS for itself
export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await db.product.findUnique({ where: { id: params.id } });
  if (!product) notFound();
  return <ProductView product={product} />;
}

// Client Component - opt in with "use client"
"use client";
export function AddToCartButton({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => addToCart(productId))}
    >
      {pending ? "Adding..." : "Add to cart"}
    </button>
  );
}
```

### Boundaries

- Server → Client: pass serializable props or `children`
- Client → Server: invoke Server Actions via `<form action={...}>` or imperatively from event handlers
- Never `import` a Server Component from a Client Component file — compose them via `children` instead

---

## Performance Optimization Rules

Prioritized by impact:

### 1. Eliminating Waterfalls (CRITICAL)

- **async-defer-await** - Move await into branches where actually used
- **async-parallel** - Use `Promise.all()` for independent operations
- **async-dependencies** - Use better-all for partial dependencies
- **async-api-routes** - Start promises early, await late in API routes
- **async-suspense-boundaries** - Use Suspense to stream content

### 2. Bundle Size Optimization (CRITICAL)

- **bundle-barrel-imports** - Import directly, avoid barrel files
- **bundle-dynamic-imports** - Use `next/dynamic` for heavy components
- **bundle-defer-third-party** - Load analytics/logging after hydration
- **bundle-conditional** - Load modules only when feature is activated
- **bundle-preload** - Preload on hover/focus for perceived speed

### 3. Server-Side Performance (HIGH)

- **server-auth-actions** - Authenticate server actions like API routes
- **server-cache-react** - Use `React.cache()` for per-request deduplication
- **server-cache-lru** - Use LRU cache for cross-request caching
- **server-dedup-props** - Avoid duplicate serialization in RSC props
- **server-hoist-static-io** - Hoist static I/O (fonts, logos) to module level
- **server-serialization** - Minimize data passed to client components
- **server-parallel-fetching** - Restructure components to parallelize fetches
- **server-after-nonblocking** - Use `after()` for non-blocking operations

### 4. Re-render Optimization (MEDIUM)

- **rerender-defer-reads** - Don't subscribe to state only used in callbacks
- **rerender-memo** - Extract expensive work into memoized components
- **rerender-memo-with-default-value** - Hoist default non-primitive props
- **rerender-dependencies** - Use primitive dependencies in effects
- **rerender-derived-state** - Subscribe to derived booleans, not raw values
- **rerender-derived-state-no-effect** - Derive state during render, not effects
- **rerender-functional-setstate** - Use functional setState for stable callbacks
- **rerender-lazy-state-init** - Pass function to useState for expensive values
- **rerender-simple-expression-in-memo** - Avoid memo for simple primitives
- **rerender-split-combined-hooks** - Split hooks with independent dependencies
- **rerender-move-effect-to-event** - Put interaction logic in event handlers
- **rerender-transitions** - Use `startTransition` for non-urgent updates

---

## Data Fetching Decision Matrix

| Need | Tool |
|---|---|
| Per-request data in Next.js App Router | RSC `await fetch()` |
| Client-side cache + mutations + invalidation | TanStack Query |
| Lightweight client cache + revalidation | SWR |
| Real-time subscriptions | Server-Sent Events, WebSockets, or the lib's subscription API |
| One-off fire-and-forget | `fetch()` in an event handler |

**Avoid `useEffect` + `fetch` for application data** — race conditions, no cache, no retry, no Suspense integration.

---

## Suspense + Error Boundaries

```tsx
<ErrorBoundary fallback={<ErrorView />}>
  <Suspense fallback={<UserSkeleton />}>
    <UserDetail id={id} />
  </Suspense>
</ErrorBoundary>
```

- Place Suspense boundaries close to the data, not at the route root
- Error Boundary remains a class API; use `react-error-boundary` for hook-friendly wrapper
- A boundary catches errors during render, lifecycle, and constructors

---

## Forms

### React 19 Form Actions (Preferred)

```tsx
"use client";
import { useActionState } from "react";

const initial = { error: null as string | null };

async function updateUserAction(_prev: typeof initial, formData: FormData) {
  "use server";
  const parsed = UserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid input" };
  await db.user.update({ where: { id: parsed.data.id }, data: parsed.data });
  return { error: null };
}

export function UserForm() {
  const [state, formAction, pending] = useActionState(updateUserAction, initial);
  return (
    <form action={formAction}>
      <input name="name" required />
      <button type="submit" disabled={pending}>Save</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
```

### Controlled Inputs

Use controlled when the value drives other UI, formats on every keystroke, or implements real-time validation.

---

## Composition Recipes

### Slot via `children`

```tsx
<Layout>
  <Header />
  <Main>{content}</Main>
</Layout>
```

### Named slots

```tsx
<Page header={<Nav />} sidebar={<Filters />}>
  <Results />
</Page>
```

### Compound components

```tsx
<Tabs defaultValue="profile">
  <Tabs.List>
    <Tabs.Trigger value="profile">Profile</Tabs.Trigger>
    <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Panel value="profile"><Profile /></Tabs.Panel>
  <Tabs.Panel value="settings"><Settings /></Tabs.Panel>
</Tabs>
```

---

## Performance

### When `React.memo` Actually Helps

Wrap a component in `React.memo` only when:
1. It re-renders frequently
2. Its props are usually the same between renders
3. Its render is measurably expensive

### Avoiding Render Cascades

- Lift state down rather than up where possible
- Split context: one context per concern
- Use `useSyncExternalStore` for external state libraries

### Lists

- Provide stable `key` props (database id, not array index)
- Virtualize long lists with `@tanstack/react-virtual` or `react-window` once visible item count exceeds ~50

---

## Accessibility-First Composition

- Always render semantic HTML (`<button>`, `<a>`, `<nav>`, `<main>`) before reaching for `role` attributes
- Every interactive element must be reachable by keyboard
- Form inputs need labels — `<label htmlFor>` or `aria-label` if visually labeled by an icon
- Manage focus on route changes and modal open/close
- Run `axe` in component tests

### Accessible Interactive Elements

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

## Examples

### Custom Hook for Debounced Search

```tsx
function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function SearchBox() {
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 300);
  const { data } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => searchApi(debounced),
    enabled: debounced.length > 0,
  });
  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <Results items={data ?? []} />
    </>
  );
}
```

### Optimistic UI with React 19 `useOptimistic`

```tsx
"use client";
import { useOptimistic } from "react";

export function MessageList({ messages }: { messages: Message[] }) {
  const [optimistic, addOptimistic] = useOptimistic(
    messages,
    (state, newMessage: Message) => [...state, newMessage],
  );

  async function send(formData: FormData) {
    const text = String(formData.get("text"));
    addOptimistic({ id: "pending", text, sender: "me" });
    await saveMessage(text);
  }

  return (
    <>
      <ul>{optimistic.map((m) => <li key={m.id}>{m.text}</li>)}</ul>
      <form action={send}>
        <input name="text" />
        <button type="submit">Send</button>
      </form>
    </>
  );
}
```

---

## Related Skills

- `react-performance` - For detailed performance rules
- `frontend-patterns` - Cross-framework UI concerns
- `accessibility` - WCAG criteria and pattern libraries