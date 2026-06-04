# Part 2 — Phase 3 — ProfileContext Refactor

---

## Goal

Rewrite `frontend/src/context/ProfileContext.tsx` to drive `profileConfig` from the API instead of the hardcoded registry. The public `useProfile()` shape stays the same — every consumer (Sidebar, PondDetailsPanel, PondVisualization, ProfileDropdown) sees what it already saw.

After Phase 3:
- `ProfileContext` fetches `/api/profile-types/` (once, when authenticated) and caches in state.
- The hardcoded imports (`getProfileConfig`, `getDefaultProfile`, `isValidProfile`) are gone.
- Loading-state stub keeps consumers crash-free during the fetch window (per D6).
- Dead CSS-var writes for `--profile-secondary` and `--profile-accent` are removed.
- The 5 tsc errors Phase 1 introduced in this file drop to 0.

---

## Design

### Fetch trigger — `isAuthenticated` from `SessionContext`

Profiles only make sense for an authenticated user. Trigger the fetch when `useSession().isAuthenticated` flips to `true`:

```ts
const { isAuthenticated, projects } = useSession();
useEffect(() => {
  if (isAuthenticated && profiles === null) {
    apiService.getProfileTypes()
      .then(setProfiles)
      .catch(() => setProfiles([]));   // fail-soft — empty registry, stub stays
  }
}, [isAuthenticated, profiles]);
```

Why this trigger:
- Pre-login: `isAuthenticated=false` → no 401 from the API; stub keeps app rendering.
- Post-login: `isAuthenticated=true` → one fetch; profiles populated.
- Logout: `isAuthenticated=false` again, but `profiles` stays cached (no need to refetch on next login).
- Fetch error: set `profiles = []` so we stop trying. App still renders via the stub.

### Loading-state stub (per D6)

Module-scope constant. Consumers see a placeholder theme until the real value arrives:

```ts
const STUB_PROFILE: ProfileConfig = {
  profileTypeId: '',
  code: '',
  name: '',
  description: null,
  stageConfig: null,
  keyParameterIndicators: [],
  keyGrowthIndicators: [],
  theme: { primary: '#888888', gradient: { from: '#888888', to: '#cccccc' } },
};
```

`profileConfig` always returns a `ProfileConfig` — never `null`, never `undefined`. Consumers don't need null-checks. Brief grey flash on initial paint is the price.

### `profileConfig` resolution

```ts
const profileConfig = useMemo<ProfileConfig>(() => {
  if (!profiles || profiles.length === 0) return STUB_PROFILE;
  const found = profiles.find((p) => p.code === currentProfile);
  return found ?? profiles[0];
}, [profiles, currentProfile]);
```

Fallback chain: `profiles[currentProfile.code]` → first profile → stub.

### `userProfiles` (intersection)

```ts
const userProfiles = useMemo<ProfileType[]>(() => {
  if (!profiles) return [];
  const sessionCodes = new Set(projects.map((p) => p.profileType));
  return profiles.filter((p) => sessionCodes.has(p.code)).map((p) => p.code);
}, [profiles, projects]);
```

Returns codes the user has projects for AND that exist in the catalogue. Empty during loading or for users with no projects.

### `currentProfile` initial + realignment

Initial:
```ts
const [currentProfile, setCurrentProfile] = useState<ProfileType>(() => {
  return localStorage.getItem(PROFILE_STORAGE_KEY) ?? defaultProfile ?? '';
});
```

Empty string is fine because (a) it'll never match any profile so `profileConfig` resolves to stub or first profile, and (b) the realignment effect picks the right code once data arrives.

Realignment effect — once `profiles` AND `userProfiles` are known:
```ts
useEffect(() => {
  if (!profiles || profiles.length === 0) return;
  const validCodes = new Set(profiles.map((p) => p.code));
  if (validCodes.has(currentProfile)) return;            // current is valid — leave alone
  // Prefer a code from the user's assigned profiles; else first catalogue entry.
  const next = userProfiles[0] ?? profiles[0].code;
  setCurrentProfile(next);
}, [profiles, userProfiles, currentProfile]);
```

This subsumes the old `isValidProfile` check + the `userProfiles[0]` fallback.

### CSS-var writes — drop dead ones

Old code wrote 5 CSS vars; only 3 have consumers:

```diff
- root.style.setProperty('--profile-secondary', theme.secondary);
- root.style.setProperty('--profile-accent', theme.accent);
```

Keep `--profile-primary`, `--profile-gradient-from`, `--profile-gradient-to`. Phase 1 grep confirmed no component reads the dropped ones.

### `switchProfile` — unchanged behaviour, simpler body

The 150ms `setTimeout` simulating a "loading transition" is kept verbatim (preserves the existing UX).

---

## Public surface — DO NOT change

These exports stay byte-identical in shape so Phase 4 (ProfileDropdown) and other consumers don't see compile errors:

```ts
useProfile(): {
  currentProfile: ProfileType,
  profileConfig: ProfileConfig,
  switchProfile: (profileType: ProfileType) => void,
  isSwitching: boolean,
  userProfiles: ProfileType[],
}
useCurrentProfile(): ProfileType
useProfileConfig(): ProfileConfig
useProfileTheme(): ProfileTheme
```

Tested in Phase 1 grep: no consumer reads `useProfileTheme().secondary` or `.accent`. The shape narrowing is transparent.

---

## Checklist Tracking

| No. | Done | Area | Step | Verification |
|---|---|---|---|---|
| 1 | [x] | Imports | Drop `getProfileConfig/getDefaultProfile/isValidProfile`. Add `apiService`. | done |
| 2 | [x] | Module-scope — `STUB_PROFILE` | Added grey-theme placeholder. | done |
| 3 | [x] | State — `profiles` | Added `useState<ProfileConfig[] \| null>(null)`. | done |
| 4 | [x] | Effect — fetch on `isAuthenticated` | Added fetch useEffect; fail-soft to `[]` on error. | done |
| 5 | [x] | Rewrite — `getInitialProfile` | Inlined into `useState` initialiser — `localStorage ?? defaultProfile ?? ''`. | done |
| 6 | [x] | Rewrite — `profileConfig` memo | find → first → stub resolution chain. | done |
| 7 | [x] | Rewrite — `userProfiles` memo | Set-intersection of session codes and catalogue codes. | done |
| 8 | [x] | Rewrite — realignment effect | Catalogue-aware; falls back to `userProfiles[0]` then `profiles[0].code`. | done |
| 9 | [x] | CSS-var effect — drop secondary + accent writes | Two lines removed; primary + gradient writes preserved. | done |
| 10 | [x] | Verification — tsc | `ProfileContext.tsx` → 0 errors (was 5 post Phase 1). Cascade fixes: see items 11-12 below. | tsc output ✅ |
| 11 | [x] | Cascade — widen `Theme` in `types/index.ts` | Set-membership comparison required `Project.profileType` to be `string`. Widened the central `Theme = "shrimp" \| ...` alias to `Theme = string`. Three lines of doc comment explain the change. Same architectural call as Phase 1's `ProfileType` widening. | tsc clean |
| 12 | [x] | Cascade — widen design-system local `Theme` | `LoginPage` passes `response.projects[0].profileType` (now `string`) to `setTheme()` from `../design-system`. The design-system `ThemeProvider` had its own narrow `Theme` union. Widened to `string` for consistency. | tsc clean |

---

## Verification Block — to run after item 9

```bash
cd frontend
npx tsc --noEmit -p tsconfig.app.json 2>&1 | tee /tmp/tsc.out > /dev/null

echo "=== ProfileContext.tsx errors (must be ZERO) ==="
grep -E "^src/context/ProfileContext\.tsx" /tmp/tsc.out

echo
echo "=== unique files with errors (should drop ProfileContext) ==="
grep -oE '^[^(]+' /tmp/tsc.out | sort -u
```

Expected `unique files with errors`:
- `src/components/historical/HistoricalTrendsAnalysis_original.tsx`  (pre-existing)
- `src/components/user-management/OnboardUserDialog.tsx`              (pre-existing)
- `src/config/profiles/fishProfile.ts`                                (Phase 5 deletes)
- `src/config/profiles/index.ts`                                      (Phase 5 deletes)
- `src/config/profiles/shrimpProfile.ts`                              (Phase 5 deletes)
- `src/main.tsx`                                                      (pre-existing)
- `src/pages/ForecastPage.tsx`                                        (pre-existing)
- `src/test/components/PondCircle.test.tsx`                           (pre-existing)
- `src/test/components/PondGrid.test.tsx`                             (pre-existing)
- `src/test/components/PondVisualization.test.tsx`                    (pre-existing)

**`src/context/ProfileContext.tsx` MUST be absent from this list.**

---

## Risks / Edge Cases

| Risk | Mitigation |
|---|---|
| `apiService.getProfileTypes()` fires while `isAuthenticated` flickers (e.g., refresh race) | Effect guards with `profiles === null`. Single fetch per session lifetime. |
| `setProfiles([])` on error means the dropdown is empty after the user logs in | Fail-soft is intentional — app shouldn't crash. Future Phase 6 smoke surfaces the empty case; can add a Retry button in Part 3 if needed. |
| `currentProfile` is the empty string on first paint (localStorage empty + no defaultProfile prop) | Realignment effect picks `userProfiles[0]` or `profiles[0].code` as soon as data lands. One render with stub theme. |
| Consumer reads `profileConfig.code` and gets `''` during loading | Acceptable per D6. Any consumer that needs to gate on "real profile loaded" can check `code !== ''`. |
| The `switchProfile` `setTimeout(150)` becomes pointless once the data is in-memory | Keeping it for UX consistency — a brief loader on profile switch is intentional flair. |
| `useProfileTheme()` consumers reading `.secondary` or `.accent` | Phase 1 grep confirmed zero such reads. tsc would catch any survivor. |

---

## Out of scope

| Item | Why |
|---|---|
| ProfileDropdown changes | Phase 4 |
| Deleting `config/profiles/` | Phase 5 |
| Browser smoke | Phase 6 |
| Retry button after fetch failure | Part 3 polish |
| Refetch on profile-mutation events (admin edits a profile) | Out of scope for this arc; would require a websocket or admin-trigger; users will see new values on next login |

---

## Completion Criteria

| Done | Criteria |
|---|---|
| [x] | `ProfileContext.tsx` no longer imports from `../config/profiles` |
| [x] | `apiService.getProfileTypes()` called on `isAuthenticated` trigger |
| [x] | `STUB_PROFILE` constant present + used during loading |
| [x] | `useProfile()` return shape unchanged (same 5 fields) |
| [x] | CSS-var writes for `secondary` and `accent` removed |
| [x] | tsc clean for `ProfileContext.tsx` (drops from 5 errors → 0) |
| [x] | Unique tsc error-files list = Phase 2's list minus `ProfileContext.tsx` (+ the 2 cascade widenings landed clean — no new files) |

---

## Files Touched in Phase 3

| File | What changed |
|---|---|
| `frontend/src/context/ProfileContext.tsx` | Dropped `config/profiles` imports. Added `apiService` + `STUB_PROFILE`. State now holds `profiles: ProfileConfig[] \| null`. Fetch effect on `isAuthenticated`. `profileConfig` resolves find → first → stub. `userProfiles` is the session-catalogue intersection. Realignment effect catalogue-aware. CSS-var effect drops secondary + accent writes. |
| `frontend/src/types/index.ts` | Widened `export type Theme = "shrimp" \| ... \| "treatment"` to `export type Theme = string`. Doc comment explains the rationale (matches Phase 1 widening of `ProfileType`). |
| `frontend/src/design-system/theme/ThemeProvider.tsx` | Widened the local `type Theme` from union literal to `string` so `LoginPage` could pass `response.projects[0].profileType` (now `string`) into `setTheme()`. |

---

*Last updated: 2026-05-22*
