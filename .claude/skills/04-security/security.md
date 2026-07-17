<!--
Merged from:
- Opencode-Workflows-master/agents/security-reviewer/.opencode/skill/security-express/SKILL.md
- Opencode-Workflows-master/agents/security-reviewer/.opencode/skill/security-nextjs/SKILL.md
- Opencode-Workflows-master/agents/security-reviewer/.opencode/skill/security-django/SKILL.md
- Opencode-Workflows-master/agents/security-reviewer/.opencode/skill/security-fastapi/SKILL.md
-->

# Security Audit Guide

Comprehensive security audit patterns for web applications across Express.js, Next.js, Django, and FastAPI frameworks. Use this skill proactively when reviewing any web application for security vulnerabilities.

## Quick Reference

| Issue | Framework | Where to Look | Severity |
|-------|-----------|---------------|----------|
| NEXT_PUBLIC_ secrets exposed | Next.js | `.env*` files | CRITICAL |
| Unauth'd Server Actions | Next.js | `app/**/actions.ts` | HIGH |
| Unauth'd API routes | Next.js | `app/api/**/route.ts`, `pages/api/**` | HIGH |
| Middleware matcher gaps | Next.js | `middleware.ts` | HIGH |
| Missing input validation | Next.js | Server Actions, API routes | HIGH |
| IDOR in dynamic routes | Next.js/Django | `[id]` params, views | HIGH |
| Missing security headers | Express.js | `next.config.js` | LOW |
| No Helmet.js | Express.js | Main app file | HIGH |
| CORS too permissive | Express.js/FastAPI | CORS config | HIGH |
| Disabled CSRF | Django | Settings | HIGH |
| Hardcoded SECRET_KEY | Django | settings.py | CRITICAL |
| DEBUG in production | Django | settings.py | CRITICAL |
| Missing TrustedHost | FastAPI | Middleware config | HIGH |

---

## Express.js Security

### Essential Security Middleware

**Helmet.js (Security Headers)**
```javascript
// ✓ Use Helmet
const helmet = require('helmet');
app.use(helmet());
```
Sets: Content-Security-Policy, X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Strict-Transport-Security

**Disable X-Powered-By**
```javascript
app.disable('x-powered-by');
```

**CORS Configuration**
```javascript
// ✓ Explicit allowlist
app.use(cors({
  origin: ['https://app.example.com', 'https://admin.example.com'],
  credentials: true,
}));

// ✓ Function for dynamic validation
app.use(cors({
  origin: (origin, callback) => {
    const allowed = ['https://app.example.com'];
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
```

### Body Parser Limits
```javascript
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
```

### Auth Middleware Patterns

**Missing Auth on Routes**
```javascript
// ✓ Auth middleware applied
app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  res.json(await User.find());
});
```

**Middleware Order Matters**
```javascript
app.use('/public', express.static('public')); // Intentionally public
app.use(requireAuth);
app.use('/uploads', express.static('uploads')); // Now protected
```

### Rate Limiting
```javascript
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts',
});
app.post('/api/login', authLimiter, loginHandler);
app.post('/api/register', authLimiter, registerHandler);
app.post('/api/forgot-password', authLimiter, forgotPasswordHandler);
```

---

## Next.js Security

### Environment Variable Exposure

**The NEXT_PUBLIC_ Footgun**
```
NEXT_PUBLIC_* → Bundled into client JavaScript → Visible to everyone
No prefix     → Server-only → Safe for secrets
```

**Audit steps:**
1. `grep -r "NEXT_PUBLIC_" . -g "*.env*"`
2. For each var, ask: "Would I be OK if this was in view-source?"

**Safe pattern:**
```typescript
// Server-only
const apiKey = process.env.API_KEY; // No NEXT_PUBLIC_

// Client-safe (truly public)
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
```

### next.config.js `env` Warning

Values set in `next.config.js` under `env` are inlined into the client bundle, even without `NEXT_PUBLIC_`. Treat them as public.

```javascript
// ❌ Sensitive values here are exposed to the browser
module.exports = {
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
};
```

### Server Actions Security

```typescript
// ✓ SECURE: Auth + authorization
"use server"
export async function deleteUser(userId: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Unauthorized");
  if (session.user.id !== userId && !session.user.isAdmin) {
    throw new Error("Forbidden");
  }
  await db.user.delete({ where: { id: userId } });
}

// ✓ Validates with Zod
"use server"
import { z } from "zod";
const schema = z.object({ name: z.string().max(100) });
export async function updateProfile(formData: FormData) {
  const data = schema.parse(Object.fromEntries(formData));
  await db.user.update({ data });
}
```

### Middleware Security
```typescript
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("session");
  // Verify token (use next-auth or verify JWT)
}

// CRITICAL: Check matcher covers all protected routes
export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/api/admin/:path*"],
};
```

---

## Django Security

### Critical Settings (settings.py)

**SECRET_KEY**
```python
# ✓ From environment
import os
SECRET_KEY = os.environ['DJANGO_SECRET_KEY']
```

**DEBUG**
```python
DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'
```

**ALLOWED_HOSTS**
```python
ALLOWED_HOSTS = ['example.com', 'www.example.com']
```

### Security Middleware

**Required Middleware**
```python
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
```

**Security Settings**
```python
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
```

### CSRF Protection
```python
# ✓ Explicit
CSRF_TRUSTED_ORIGINS = ['https://example.com', 'https://admin.example.com']

# Audit: Search for @csrf_exempt - each needs justification.
```

### Common Vulnerabilities

**SQL Injection**
```python
# ✓ ORM (safe by default)
User.objects.filter(id=user_id)
```

**Command Injection**
```python
# ✓ Use arrays, avoid shell=True
subprocess.run(["convert", user_filename, "output.png"])
```

**IDOR Protection**
```python
# ✓ Check ownership
class DocumentView(LoginRequiredMixin, View):
    def get(self, request, doc_id):
        doc = Document.objects.get(id=doc_id, owner=request.user)
```

---

## FastAPI Security

### Missing Auth on Routes
```python
@app.get("/private")
async def private_route(user=Depends(get_current_user)):
    return {"ok": True}

@app.get("/scoped")
async def scoped_route(user=Security(get_current_user, scopes=["items"])):
    return {"ok": True}
```

### CORS Configuration
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://app.example.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Host Header and HTTPS
```python
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware

app.add_middleware(TrustedHostMiddleware, allowed_hosts=["example.com", "*.example.com"])
app.add_middleware(HTTPSRedirectMiddleware)
```

---

## Security Hardening Checklist

### Express.js
- [ ] Helmet.js installed and used
- [ ] CORS restricted to specific origins
- [ ] Body parser has size limits
- [ ] Auth middleware on all protected routes
- [ ] Rate limiting on auth endpoints
- [ ] Session cookies: secure, httpOnly, sameSite

### Next.js
- [ ] No NEXT_PUBLIC_ secrets in .env
- [ ] Unauth'd Server Actions checked
- [ ] Unauth'd API routes checked
- [ ] Middleware matcher covers all protected routes
- [ ] Input validation on all user input
- [ ] dangerouslySetInnerHTML audited

### Django
- [ ] SECRET_KEY from environment, not hardcoded
- [ ] DEBUG = False in production
- [ ] ALLOWED_HOSTS explicitly set
- [ ] SecurityMiddleware enabled
- [ ] CSRF middleware enabled
- [ ] All views have appropriate auth decorators
- [ ] No raw SQL with string formatting
- [ ] DRF has IsAuthenticated as default permission

### FastAPI
- [ ] All sensitive routes require `Depends()` or `Security()` auth
- [ ] API key schemes use headers (`APIKeyHeader`)
- [ ] `allow_origins` explicit when `allow_credentials=True`
- [ ] `TrustedHostMiddleware` configured
- [ ] `HTTPSRedirectMiddleware` enabled in production