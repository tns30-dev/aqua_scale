# AquaShield Frontend — Unit Testing Guide

**Tech Stack:** React · TypeScript · Vite · Vitest · React Testing Library · MSW (Mock Service Worker)

This document explains how unit testing is wired up in the AquaShield
frontend after the Part 2 / Phase 7 rewrite. Use it as a reference when
adding new tests or maintaining existing ones.

------------------------------------------------------------------------

## 1. Folder Structure

```
src/
  pages/
  hooks/
  components/
  context/
  services/
  test/
    setup.ts            # global vitest setup (mocks, MSW lifecycle)
    test-utils.tsx      # custom render() wrapped in MemoryRouter + ProfileProvider
    mocks.ts            # reusable hook + data mock factories
    msw/
      server.ts         # MSW server (setupServer) used by setup.ts
      handlers.ts       # default request handlers (Part 2 endpoints)
      data.ts           # fixture data — Part 2 shapes
    components/
      Sidebar.test.tsx
      TopNav.test.tsx
      Users.test.tsx
    pages/
      LoginPage.test.tsx
    services/
      api.service.test.ts
    utils/
      schema.test.ts
    documents/
      README_TESTING.md
```

All tests + supporting infrastructure live under `src/test/`. Production
code is never imported by tests except via the modules under test.

------------------------------------------------------------------------

## 2. Installation

```bash
npm install -D \
  vitest @vitejs/plugin-react \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom \
  jsdom msw
```

`msw` lets tests intercept HTTP requests at the network layer — the
component under test runs the real `apiService` (real axios) without ever
touching the backend.

------------------------------------------------------------------------

## 3. Vitest Configuration (`vitest.config.ts`)

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

------------------------------------------------------------------------

## 4. Global Setup (`src/test/setup.ts`)

Runs once per test file. Responsibilities:

- Starts the **MSW server** before all tests, resets handlers between
  tests, closes the server at the end.
- Polyfills `ResizeObserver` (jsdom doesn't ship it — shadcn/Radix
  `Dialog`, `Select`, etc. construct one internally).
- Mocks `window.matchMedia` (jsdom doesn't ship it).
- Mocks `window.localStorage` so each test starts with a clean store and
  `setItem` / `getItem` are spy-able.
- Adds `@testing-library/jest-dom` matchers.

If you see a test crash with `ReferenceError: ResizeObserver is not
defined` or `matchMedia is not a function`, check that `setup.ts` is
being loaded (vitest `setupFiles`).

------------------------------------------------------------------------

## 5. MSW (Mock Service Worker)

The frontend's `apiService` (axios) makes real HTTP requests. MSW
intercepts them at the network layer so tests get deterministic
responses without spinning up a backend.

### `src/test/msw/server.ts`

Creates the shared `setupServer(...handlers)`. Started/stopped in
`setup.ts`.

### `src/test/msw/handlers.ts`

Default handlers for every Part 2 endpoint the frontend calls:

```
GET  *  /api/csrf                     → { ok: true }
GET  *  /api/auth/me                  → mockMeResponse
GET  *  /api/access/modules           → mockModules
GET  *  /api/access/features          → mockFeatures
GET  *  /api/projects/all/            → mockProjects
GET  *  /api/users                    → mockUsers
POST *  /api/users                    → mockOnboardResponse (201)
GET  *  /api/users/:userId/access     → mockUserAccess (id-agnostic)
PUT  *  /api/users/:userId/access     → echoes the partial PUT body
```

Handlers use `*` wildcard hosts so they match any axios `baseURL`
configuration (dev-proxy → relative paths; direct → absolute).

### Overriding a handler in a single test

```ts
import { server } from '../msw/server'
import { http, HttpResponse } from 'msw'

server.use(
  http.post('*/api/users', () =>
    HttpResponse.json({ email: ['Already exists'] }, { status: 400 }),
  ),
)
```

The override is reset between tests (`server.resetHandlers()` in
`setup.ts`'s `afterEach`).

### `src/test/msw/data.ts`

Centralized Part 2 fixture data — `mockModules`, `mockFeatures`,
`mockProjects`, `mockUsers`, `mockUserAccess`, `mockOnboardResponse`,
`mockMeResponse`. Keep all mock data here so the same shape is reused
across handlers, hook mocks, and test assertions.

------------------------------------------------------------------------

## 6. Mock Factories (`src/test/mocks.ts`)

Reusable hook return-value factories with Part 2 shapes:

- `createMockUseAuth({ login, isLoading, error })`
- `createMockUseTheme({ setTheme, theme })`
- `createMockUseLocation({ search, pathname })`
- `createMockUseNavigate()`

Plus typed test data: `mockProjects` (Part 2 `Project` shape) and
`mockUser` (Part 2 `User` shape).

------------------------------------------------------------------------

## 7. Custom Render (`src/test/test-utils.tsx`)

Wraps every test in `<MemoryRouter>` + `<ProfileProvider>`. Use it
instead of RTL's `render` directly:

```ts
import { render, screen } from '../test-utils'
```

### Important — `ProfileProvider` requires `SessionContext`

`ProfileProvider` calls `useSession()` internally (it derives the user's
available profiles from `session.projects`). If you don't mock
`SessionContext`, every test crashes with "useSession must be used
within a SessionProvider".

**Per-test pattern** (top of test file, before importing the component
under test):

```ts
import { vi } from 'vitest'

vi.mock('../../context/SessionContext', () => ({
  useSession: () => ({
    user: null,
    projects: [],
    loading: false,
    isAuthenticated: false,
    isPlatformAdmin: false,
    refresh: vi.fn(),
    setSession: vi.fn(),
    clear: vi.fn(),
    hasFeature: () => false,
    hasModule: () => false,
  }),
  SessionProvider: ({ children }: any) => children,
}))
```

For tests that need a logged-in admin session (e.g. `Users.test.tsx`),
flip `isPlatformAdmin: true` and `user: mockUser`.

------------------------------------------------------------------------

## 8. Example Test Patterns

### Hook-mock + form (LoginPage)

Mock `useAuth`, drive the form with `userEvent`, assert on navigation:

```ts
vi.mock('../../hooks/useAuth')
vi.mocked(useAuth).mockReturnValue(
  createMockUseAuth({ login: mockLogin }) as unknown as UseAuthReturn,
)
mockLogin.mockResolvedValue({ user: mockUser, projects: mockProjects })

render(<LoginPage />)
await userEvent.type(screen.getByPlaceholderText('demo@…'), 'a@b.com')
await userEvent.type(screen.getByPlaceholderText('Enter your password'), 'pwd')
await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/overview'))
```

### MSW + integration flow (Users + dialogs)

Let `apiService` run for real; MSW returns the mock data:

```ts
render(<Users />)
await waitFor(() => expect(screen.getByText('Users (2)')).toBeInTheDocument())
await userEvent.click(screen.getByText('+ Onboard User'))
expect(screen.getByText('Onboard New User')).toBeInTheDocument()
```

### Override MSW for a single test (error case)

```ts
server.use(
  http.get('*/api/users/:id/access', () =>
    HttpResponse.json({ detail: 'Server error' }, { status: 500 }),
  ),
)
await userEvent.click(screen.getAllByRole('button', { name: /manage/i })[0])
await waitFor(() =>
  expect(within(screen.getByRole('dialog'))
    .getByText('Failed to load user access')).toBeInTheDocument(),
)
```

### Asserting on text split across nodes (DialogDescription quirk)

When React renders `{a} {b} — {c}`, those become multiple text nodes
and `getByText` can't match across them. Use `textContent`:

```ts
const dialogText = screen.getByRole('dialog').textContent ?? ''
expect(dialogText).toContain('Farm Manager')
expect(dialogText).toContain('manager@aquaculture.com')
```

### Authenticated-request CSRF

Set the `csrftoken` cookie in `beforeEach` so the apiService interceptor
attaches `X-CSRFToken` on unsafe methods:

```ts
beforeEach(() => {
  document.cookie = 'csrftoken=test-csrf-token; path=/'
})
```

------------------------------------------------------------------------

## 9. Running Tests

```bash
# All tests
npm run test
# or
npx vitest run src/test/

# A single file
npx vitest run src/test/pages/LoginPage.test.tsx

# Watch mode (re-runs on save)
npm run test -- --watch
# or
npx vitest

# Coverage report (text + html)
npm run test -- --coverage
```

From the repo root, combine backend + frontend test runs:

```bash
(cd backend && source ../.venv/bin/activate && python -m pytest module_user/tests/) \
  && (cd frontend && npx vitest run src/test/)
```

Expected (both green): **Backend 68 passed · Frontend 69 passed (6 files)**.

------------------------------------------------------------------------

## 10. Adding a New Test

Drop it under the matching folder:

```
src/test/pages/        # one file per page
src/test/components/   # one file per component
src/test/services/     # one file per service
src/test/hooks/        # one file per hook
src/test/utils/        # one file per util module
```

Minimal skeleton:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../test-utils'

// Required if your component subtree calls useSession (most do — see §7)
vi.mock('../../context/SessionContext', () => ({
  useSession: () => ({ /* logged-out stub */ }),
  SessionProvider: ({ children }: any) => children,
}))

import { MyComponent } from '../../components/MyComponent'

describe('MyComponent', () => {
  it('renders the heading', () => {
    render(<MyComponent />)
    expect(screen.getByRole('heading', { name: /my/i })).toBeInTheDocument()
  })
})
```

------------------------------------------------------------------------

## 11. Conventions

- Always use the custom `render` from `test-utils.tsx` — never RTL's
  directly. You need the MemoryRouter wrapper.
- Always mock `SessionContext` per test (see §7). Even if the component
  under test doesn't read it, `ProfileProvider` does.
- Centralize fixture data in `msw/data.ts` and `mocks.ts`. Don't inline
  shape literals across multiple test files — when the type changes,
  one update should cover everything.
- Use `getAllByText` / `getAllByRole` when the rendered tree includes
  both mobile and desktop layouts (e.g. `Sidebar`, `Users` list).
- Prefer `await userEvent.click(...)` over `fireEvent.click(...)` — it
  models real user interaction (focus, key events) more faithfully.
- Prefer `waitFor()` over arbitrary `setTimeout` for async UI.
- Override MSW handlers in tests via `server.use(...)` — don't edit the
  default handlers in `handlers.ts` for one-off cases.

------------------------------------------------------------------------

## Final Notes

- All tests live under `src/test`.
- MSW handles HTTP — don't mock `apiService` directly unless the test is
  about apiService's own behavior.
- `SessionContext` must be mocked per test (Phase 6.5 dependency).
- If a test crashes with `ResizeObserver is not defined`, verify
  `setup.ts` is being loaded.