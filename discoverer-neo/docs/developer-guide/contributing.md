# Contributing Guide

How to contribute to Discoverer Neo.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork locally
3. **Create** a feature branch: `git checkout -b feature/your-feature`
4. **Make** your changes
5. **Test** locally
6. **Push** to your fork
7. **Create** a Pull Request

## Development Workflow

### 1. Set Up Environment

```bash
git clone https://github.com/your-username/discoverer-neo.git
cd discoverer-neo
npm install
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
npm run dev
```

### 2. Create Feature Branch

```bash
# From main branch
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/add-user-groups
# or
git checkout -b bugfix/fix-map-export-error
```

**Naming convention:**
- `feature/` for new features
- `bugfix/` for bug fixes
- `refactor/` for code improvements
- `docs/` for documentation

### 3. Make Changes

**Backend changes:**

```bash
npm run dev --workspace=backend
# Make changes to backend/src/
# Tests run: npm run test --workspace=backend
```

**Frontend changes:**

```bash
npm run dev --workspace=frontend
# Make changes to frontend/src/
# Tests run: npm run test --workspace=frontend
```

### 4. Code Quality

Before committing, check:

```bash
# Lint
npm run lint

# Type-check
npm run typecheck

# Format (auto-fix)
npm run format
```

**Pre-commit Hooks (Recommended):**

```bash
# Install Husky
npm install husky --save-dev
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run lint && npm run typecheck"
```

### 5. Write Tests

Add tests for your changes:

**Backend (Jest):**
```typescript
// backend/src/__tests__/my-feature.test.ts
describe('My Feature', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

**Frontend (Vitest):**
```typescript
// frontend/src/__tests__/MyComponent.test.tsx
describe('MyComponent', () => {
  it('should render', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected')).toBeInTheDocument();
  });
});
```

**Run tests:**
```bash
npm run test --workspace=backend
npm run test --workspace=frontend
npm run e2e --workspace=frontend
```

**Target:** > 80% code coverage

### 6. Commit Changes

Use clear, descriptive commit messages:

```bash
git add .
git commit -m "feature: add user group management

- Add UserGroup model to schema
- Create /api/user-groups endpoints
- Add group membership UI
- Add tests for new endpoints"
```

**Format:**
- Start with type: `feature:`, `bugfix:`, `refactor:`, `docs:`, `test:`
- Keep first line under 50 characters
- Add blank line, then detailed description
- Reference issues: `Fixes #123`

### 7. Verify Before Push

```bash
# Run full test suite locally
npm run lint
npm run typecheck
npm run test --workspace=backend
npm run test --workspace=frontend

# Make sure services are running
docker compose ps

# Verify builds
npm run build
```

### 8. Push to Your Fork

```bash
git push origin feature/add-user-groups
```

### 9. Create Pull Request

On GitHub:

1. Click **Compare & pull request**
2. Fill in PR title and description:
   ```
   # Add User Group Management
   
   ## Description
   Implements user groups for role-based access control.
   
   ## Changes
   - Add `user_groups` and `user_group_members` tables
   - Create admin panel for group management
   - Update permission checks to include group membership
   - Add comprehensive tests
   
   ## Closes
   Fixes #123
   
   ## Testing
   - [ ] Manual testing in UI
   - [ ] All tests pass
   - [ ] E2E tests pass
   ```

3. Request reviews
4. Address feedback
5. Maintainers merge

## Code Style

### TypeScript/JavaScript

**Naming:**
- camelCase for variables/functions: `getUserById`, `isActive`
- PascalCase for classes/types: `User`, `ApiError`
- UPPER_CASE for constants: `DEFAULT_TIMEOUT = 5000`

**Organization:**
- 1 class/interface per file
- Group related functions in modules
- Import order: built-ins, externals, locals

**Comments:**
- Explain *why*, not *what*
- Use JSDoc for public APIs
- Keep comments up-to-date

**Examples:**

```typescript
// Good
/** Get user by ID, throws if not found */
export async function getUserById(id: string): Promise<User> {
  const user = await db.select().from(users).where(eq(users.id, id));
  if (!user) throw new NotFoundError(`User ${id} not found`);
  return user;
}

// Bad
// Get the user
function getUser(u: string) {
  return db.query('SELECT * FROM users WHERE id = $1', [u]);
}
```

## Common Contribution Types

### Adding an API Endpoint

1. Create route in `backend/src/routes/`
2. Add service method in `backend/src/services/`
3. Add schema (Drizzle) if new entity
4. Add tests
5. Update `backend/src/app.ts` to register route

### Fixing a Bug

1. Add test that reproduces bug
2. Fix implementation
3. Verify test passes
4. Update documentation if needed

### Improving Performance

1. Profile/benchmark current state
2. Make changes
3. Re-benchmark to show improvement
4. Add performance tests

### Adding Documentation

1. Update relevant `.md` file
2. Update `docs/index.md` if adding new section
3. Update root `README.md` if documentation structure changes

## Review Process

Reviewers look for:

1. **Correctness** — Does it work? Are edge cases handled?
2. **Tests** — Is there test coverage? Do tests pass?
3. **Code Quality** — Does it follow style guide? Is it performant?
4. **Documentation** — Are changes documented? Are breaking changes noted?
5. **Breaking Changes** — Will this break existing users' setup?

**Responding to feedback:**

1. Read comments carefully
2. Make requested changes
3. Push updates to the same branch
4. Reply to comments explaining changes
5. Request re-review

## Release Process

When maintainers are ready to release:

1. Update `version` in `package.json`
2. Update `CHANGELOG.md`
3. Create Git tag: `git tag v0.2.0`
4. Push tag: `git push origin v0.2.0`
5. GitHub Actions builds and releases

## Reporting Issues

**Bug Report:**
```
## Description
Clear description of the bug.

## Steps to Reproduce
1. Step 1
2. Step 2
3. ...

## Expected
What should happen.

## Actual
What actually happens.

## Environment
- OS: macOS 14.0
- Node: 22.0.0
- Browser: Chrome 120
```

**Feature Request:**
```
## Description
What feature and why.

## Use Case
Who needs this and why.

## Proposed Solution
How it should work.

## Alternatives
Other approaches considered.
```

## Community Guidelines

- Be respectful
- Provide constructive feedback
- Help others when possible
- Follow code of conduct

## Questions?

- Open a discussion on GitHub
- Check existing issues/PRs
- Ask in PR comments

---

**See Also:** [Testing](testing.md), [Development Setup](development.md), [Architecture](architecture.md)
