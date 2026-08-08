# Frontend Test + Lint Fix (2026-08-09)

Follow-up to Phase 1, where the frontend showed 10 failing tests + 1 lint error.
Root cause in every case was **test/lint drift from the current implementation**,
not an application bug. All fixed; nothing in app runtime behavior changed.

## Fixes

| File | Problem | Fix |
|---|---|---|
| `src/test/pages/LoginPage.test.tsx` | 8 fails: `getByPlaceholderText("demo@aquaculture.com")` — the login email placeholder was rebranded to `admin@aquashield.local` | Updated the 8 placeholder *selectors* to `admin@aquashield.local` (typed values / expected login args left unchanged) |
| `src/test/components/TopNav.test.tsx` | 2 fails: `No "getCurrentProfileType" export on the "../../utils/auth" mock` — `ProfileContext` statically imports it, but the mock only defined `getCurrentProjectId` | Switched the mock to the vitest `importOriginal` pattern — preserves all real exports, overrides only `getCurrentProjectId` (future-proof against new exports) |
| `src/components/feeding/treatmentMarksPlugin.ts` | 1 eslint error: unused type param `TType` | `TType` must keep its exact name to merge with Chart.js's `PluginOptionsByType` (renaming → TS2428). Kept the name; added a scoped `eslint-disable-next-line` with a comment explaining why |

## Verification

```text
npx vitest run          → 11 files, 106 passed | 8 skipped (was 96 passed | 10 failed)
npm run lint            → 0 errors (19 pre-existing non-blocking react-refresh warnings)
npm run build (tsc+vite)→ PASS
```

This clears the one FAIL from the Phase 1 build lane; the frontend CI lane
(`frontend-ci-cd.yml`: lint → vitest → build) is now fully green.
