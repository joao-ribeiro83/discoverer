<!--
Merged from:
- ECC-main/docs/ja-JP/skills/angular-developer/SKILL.md
-->

# Angular Developer Guide

Comprehensive Angular development patterns and guidelines.

## When to Activate

- Any Angular project or codebase
- Creating new Angular projects, applications, or libraries
- Generating components, services, directives, pipes, guards, or resolvers
- Implementing signals, `linkedSignal`, or `resource` reactivity
- Working with Angular forms (signal forms, reactive forms, template-driven)
- Setting up dependency injection, routing, lazy loading, or route guards
- Adding accessibility (ARIA), animations, or component styling
- Creating or debugging Angular-specific tests (unit, component harness, E2E)
- Angular CLI tooling or Angular MCP server configuration

---

## New Project Creation

### Command Selection Rules

**Step 1: Check if user explicitly specified a version**
- IF user requested specific version (e.g., Angular 15):
  ```bash
  npx @angular/cli@<requested_version> new <project-name>
  ```

**Step 2: Check existing Angular installation**
- IF no specific version requested, run `ng version`:
  ```bash
  ng version
  ```
- IF command succeeds with existing install, use:
  ```bash
  ng new <project-name>
  ```

**Step 3: Fallback to latest**
- IF no version requested and `ng version` fails:
  ```bash
  npx @angular/cli@latest new <project-name>
  ```

---

## Components

### Core Concepts

- **Component Anatomy**: Templates, metadata, component lifecycle
- **Template Control Flow**: `@if`, `@for`, `@switch` directives
- **Inputs**: Signal-based inputs, transformations, model inputs
- **Outputs**: Signal-based outputs and custom event best practices
- **Host Elements**: Host binding and attribute injection

---

## Reactivity and Data Management

### Signals Overview

```typescript
// Core signal concepts
function signal<T>(initialValue: T): Signal<T>
function computed<T>(fn: () => T): Signal<T>

// Reactive context
function untracked<T>(fn: () => T): T

// Effects
function effect(fn: () => void): EffectRef
```

### Linked Signal

```typescript
// Creates writable state linked to source signal
function linkedSignal<T>(options: {
  source: () => T,
  computation: (value: T) => T
}): WritableSignal<T>
```

### Resource

```typescript
// Fetch async data directly into signal state
function resource<T, R>(options: {
  loader: (value: T) => Promise<R>,
  defaultValue: R
}): Resource<T, R>
```

---

## Forms

### Signal Forms (Preferred for New Projects)

```typescript
// Signal forms for state management
import { FormBuilder, FormGroup, Signal } from '@angular/forms'

@Injectable()
export class FormService {
  private fb = new FormBuilder()
  
  createForm<T>() {
    return this.fb.nonNullable.group<T>({})
  }
}
```

### Form Types Decision Matrix

| Scenario | Form Type |
|----------|-----------|
| New applications (signal support) | Signal Forms |
| Complex forms | Reactive Forms |
| Simple forms | Template-driven Forms |

---

## Dependency Injection

### Fundamentals

```typescript
// Service with root providers
@Injectable({ providedIn: 'root' })
export class AuthService {
  // ...
}

// Inject in component
@Component({ /* ... */ })
export class MyComponent {
  private auth = inject(AuthService)
}
```

### Provider Definitions

```typescript
// Injection tokens
export const API_TOKEN = new InjectionToken<string>('api.token')

// Provider options
const providers = [
  { provide: API_TOKEN, useValue: 'https://api.example.com' },
  { provide: SomeService, useClass: SomeServiceImpl },
  { provide: FactoryService, useFactory: () => new FactoryService() }
]
```

---

## Angular ARIA

Building accessible custom components (Accordion, Listbox, Combobox, Menu, Tabs, Toolbar, Tree, Grid):

```typescript
// Use Angular CDK for ARIA patterns
import { A11yModule } from '@angular/cdk/a11y'

// Apply proper ARIA attributes
<button
  role="tab"
  [aria-selected]="isSelected"
  [aria-controls]="panelId"
  tabindex="0">
</button>
```

---

## Routing

### Define Routes

```typescript
// app.routes.ts
export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'users/:id', component: UserComponent },
  { path: '**', component: NotFoundComponent }
]
```

### Lazy Loading

```typescript
// Lazy load feature modules
{
  path: 'admin',
  loadChildren: () => import('./admin/admin.routes').then(m => m.adminRoutes)
}
```

### Route Guards

```typescript
// CanActivate guard for protected routes
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    return this.auth.isAuthenticated()
  }
}
```

---

## Styling and Animation

### Tailwind CSS Integration

```css
/* styles.css */
@import "tailwindcss";

@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Component Styling

Angular uses component-scoped styles by default. Use `::ng-deep` sparingly.

---

## Testing

### Unit Testing

```typescript
// TestBed setup
describe('MyComponent', () => {
  let component: MyComponent
  let fixture: ComponentFixture<MyComponent>

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyComponent]
    }).compileComponents()

    fixture = TestBed.createComponent(MyComponent)
    component = fixture.componentInstance
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })
})
```

### E2E Testing

Use Cypress or Playwright for end-to-end testing with proper page object patterns.

---

## Angular CLI

```bash
# Create component
ng generate component user-profile

# Create service
ng generate service services/auth

# Create guard
ng generate guard auth

# Build
ng build

# Serve
ng serve

# Tests
ng test
ng e2e
```

---

## Anti-Patterns

- Don't use `null`/`undefined` as signal form field values — use `''`, `0`, or `[]`
- Don't access form field state without calling field — use `form.field().valid()`
- Don't start new forms with old API when signal forms are supported
- Don't set `min`, `max`, `value`, `disabled`, `readonly` on `[formField]` — use schema rules
- Don't call `inject()` outside injection context — use `runInInjectionContext`
- Don't use `effect()` for derived state — use `computed()`
- Don't reference `$parent.$index` in nested `@for` loops — use `let outerIdx = $index`

---

## Related Skills

- `tdd-workflow` — Test-driven development for Angular
- `security-review` — Security checklist for Angular apps
- `frontend-patterns` — General frontend patterns