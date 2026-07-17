---
name: supabase-database-ops
description: |-
  Critical guardrail for Supabase database operations ensuring multi-tenant isolation with publication_id filtering, proper use of supabaseAdmin, avoiding SELECT *, error handling patterns, and secure server-side database access. Use when writing database queries, working with supabase, accessing...
allowed-tools: Read, Grep, Glob
model: fable
version: 1.0.0
category: 02-design-animation
tags: []
harness:
- claude-code
- opencode
---

# Supabase Database Operations - Critical Guardrail

## Purpose

**CRITICAL GUARDRAIL** to prevent multi-tenant data leakage and enforce database best practices in the AIProDaily platform.

## When to Use

This skill **BLOCKS** database operations until verified when:
- Writing Supabase queries (`supabaseAdmin.from()`)
- Accessing tenant-scoped tables
- Creating API routes with database access
- Working with campaign, article, or RSS data

---

## 🚨 CRITICAL RULES 🚨

### Rule #1: ALWAYS Filter by publication_id

**EVERY query on tenant-scoped tables MUST include `publication_id` filter.**

```typescript
// ✅ CORRECT - publication_id filter present
const { data, error } = await supabaseAdmin
  .from('newsletter_campaigns')
  .select('id, status, date')
  .eq('publication_id', newsletterId)  // ✅ REQUIRED
  .eq('id', campaignId)
  .single()

// ❌ WRONG - Missing publication_id filter (DATA LEAKAGE!)
const { data, error } = await supabaseAdmin
  .from('newsletter_campaigns')
  .select('id, status, date')
  .eq('id', campaignId)  // ❌ Can access other tenants' data!
  .single()
```

### Tenant-Scoped Tables (MUST filter by publication_id):
- `newsletter_campaigns`
- `articles`
- `secondary_articles`
- `rss_posts`
- `post_ratings`
- `rss_feeds`
- `app_settings`
- `advertisements`
- `campaign_advertisements`
- `archived_articles`
- `archived_rss_posts`

### Non-Scoped Tables (publication_id not needed):
- `newsletters` (top-level tenant table)
- System-wide configuration tables

---

### Rule #2: Use supabaseAdmin for Server-Side Operations

**NEVER expose service role key client-side.**

```typescript
// ✅ CORRECT - Server-side API route or Server Action
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const { data } = await supabaseAdmin
    .from('newsletter_campaigns')
    .select('*')
    .eq('publication_id', newsletterId)

  return NextResponse.json({ data })
}

// ❌ WRONG - Never in client components
'use client'
import { supabaseAdmin } from '@/lib/supabase'  // ❌ Security risk!

export default function ClientComponent() {
  // This exposes service role key to browser
  const { data } = await supabaseAdmin.from('...').select()
}
```

**Where to use supabaseAdmin**:
- ✅ API routes (`app/api/**/*.ts`)
- ✅ Server Actions (`'use server'` functions)
- ✅ Server Components (without `'use client'`)
- ✅ Background jobs/cron
- ✅ Workflow steps

**Where NOT to use**:
- ❌ Client Components (`'use client'`)
- ❌ Browser-executed code
- ❌ Public-facing pages

---

### Rule #3: Avoid SELECT *

**Only select the fields you need.**

```typescript
// ✅ CORRECT - Specific fields
const { data } = await supabaseAdmin
  .from('articles')
  .select('id, headline, article_text, is_active')
  .eq('publication_id', newsletterId)
  .eq('campaign_id', campaignId)

// ❌ WRONG - Fetches all columns (performance impact)
const { data } = await supabaseAdmin
  .from('articles')
  .select('*')
  .eq('publication_id', newsletterId)
  .eq('campaign_id', campaignId)
```

**Exception**: When you genuinely need all columns for data operations.

---

### Rule #4: Always Check for Errors

**Never assume database operations succeed.**

```typescript
// ✅ CORRECT - Check for errors
const { data, error } = await supabaseAdmin
  .from('newsletter_campaigns')
  .select('id, status')
  .eq('publication_id', newsletterId)
  .eq('id', campaignId)
  .single()

if (error) {
  console.error('[DB] Query failed:', error.message)
  throw new Error('Failed to fetch campaign')
}

if (!data) {
  console.log('[DB] No campaign found')
  return null
}

// Now safe to use data
return data

// ❌ WRONG - No error handling
const { data } = await supabaseAdmin
  .from('newsletter_campaigns')
  .select('id, status')
  .eq('id', campaignId)
  .single()

return data.status  // ❌ Crashes if error or data is null
```

---

## Database Query Patterns

### Standard Query Pattern

```typescript
const { data, error } = await supabaseAdmin
  .from('table_name')
  .select('field1, field2, field3')
  .eq('publication_id', newsletterId)  // ✅ ALWAYS for tenant tables
  .eq('other_field', value)
  .single()  // or .maybeSingle() if record might not exist

if (error) {
  console.error('[DB] Query error:', error.message)
  throw new Error(`Database query failed: ${error.message}`)
}

if (!data) {
  console.log('[DB] No record found')
  return null
}

return data
```

### Insert Pattern

```typescript
const { data, error } = await supabaseAdmin
  .from('articles')
  .insert({
    publication_id: newsletterId,  // ✅ REQUIRED
    campaign_id: campaignId,
    headline: 'Article headline',
    article_text: 'Content here',
    is_active: false
  })
  .select()
  .single()

if (error) {
  console.error('[DB] Insert failed:', error.message)
  throw new Error('Failed to create article')
}

return data
```

### Update Pattern

```typescript
const { data, error } = await supabaseAdmin
  .from('articles')
  .update({
    is_active: true,
    updated_at: new Date().toISOString()
  })
  .eq('id', articleId)
  .eq('publication_id', newsletterId)  // ✅ REQUIRED - prevents updating other tenants
  .select()
  .single()

if (error) {
  console.error('[DB] Update failed:', error.message)
  throw new Error('Failed to update article')
}

return data
```

### Delete Pattern

```typescript
const { error } = await supabaseAdmin
  .from('rss_posts')
  .delete()
  .eq('id', postId)
  .eq('publication_id', newsletterId)  // ✅ REQUIRED - prevents deleting other tenants' data

if (error) {
  console.error('[DB] Delete failed:', error.message)
  throw new Error('Failed to delete post')
}
```

### Join Pattern (Relationships)

```typescript
const { data, error } = await supabaseAdmin
  .from('newsletter_campaigns')
  .select(`
    id,
    status,
    date,
    articles (
      id,
      headline,
      is_active
    ),
    secondary_articles (
      id,
      headline,
      is_active
    )
  `)
  .eq('publication_id', newsletterId)  // ✅ REQUIRED on parent table
  .eq('id', campaignId)
  .single()
```

---

## Common Mistakes

### ❌ Forgetting publication_id Filter

```typescript
// This query can access ANY campaign from ANY tenant!
const { data } = await supabaseAdmin
  .from('newsletter_campaigns')
  .select('*')
  .eq('id', campaignId)  // ❌ Missing publication_id
```

### ❌ Using supabaseAdmin Client-Side

```typescript
'use client'

// ❌ Exposes service role key to browser
export default function MyComponent() {
  const { data } = await supabaseAdmin.from('...').select()
}
```

### ❌ No Error Handling

```typescript
// ❌ No error check - will crash on failure
const { data } = await supabaseAdmin.from('...').select().single()
const status = data.status  // Crashes if data is null
```

### ❌ Using SELECT *

```typescript
// ❌ Fetches unnecessary data, impacts performance
const { data } = await supabaseAdmin
  .from('articles')
  .select('*')
```

---

## Quick Reference

✅ **DO**:
- Always filter by `publication_id` on tenant-scoped tables
- Use `supabaseAdmin` only server-side
- Select specific fields
- Check for errors
- Use `.single()` for single records
- Use `.maybeSingle()` if record might not exist
- Log errors with `[DB]` prefix

❌ **DON'T**:
- Skip `publication_id` filter
- Use `supabaseAdmin` in client components
- Use `SELECT *` without reason
- Ignore errors
- Assume data exists
- Expose service keys client-side

---

## Error Recovery

If you see "Row level security policy violated":
1. Check if you're filtering by `publication_id`
2. Verify you're using `supabaseAdmin` (not client)
3. Confirm you're on server-side (API route/Server Action)

If you see "column does not exist":
1. Verify column name spelling
2. Check if field exists in database schema
3. Ensure you're querying the correct table

---

**Skill Status**: ACTIVE GUARDRAIL ✅
**Enforcement Level**: BLOCK (Critical)
**Line Count**: < 500 ✅
**Purpose**: Prevent multi-tenant data leakage ✅
