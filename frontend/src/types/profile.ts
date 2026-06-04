/**
 * Profile types — DTO shape returned by `GET /api/profile-types/` after the
 * snake→camel mapper in `api.service.getProfileTypes()` (Part 2 / Phase 2).
 *
 * Part 2 / Phase 1 changes (2026-05-22):
 *   - `ProfileType` widened from union literal to `string`. Adding a profile
 *     in Django admin no longer needs a TS code change.
 *   - `ProfileTheme` dropped `secondary` + `accent` — neither read by any
 *     component (BE Phase 1 design D2 dropped them from JSONB too).
 *   - `ProfileConfig` reshaped to the DTO. Dropped `icon`, `displayName`,
 *     `parameters[]`, `priorityParameters[]`, `overview.metrics[]` — all
 *     unused by consumers.
 *   - Dropped dead sub-interfaces: `ProfileParameter`, `ProfileMetric`,
 *     `ProfilePond` (zero non-self-references).
 */

/** Profile code as returned by /api/profile-types/. Free-text; validated at runtime. */
export type ProfileType = string;

export interface ProfileTheme {
  primary: string;                       // hex, e.g. "#0C9286"
  gradient: { from: string; to: string };
}

export interface ProfileConfig {
  profileTypeId: string;                 // UUID
  code: string;                          // machine identifier, same as ProfileType
  name: string;                          // display label
  description: string | null;
  stageConfig: unknown;                  // JSONB — opaque to FE for now
  keyParameterIndicators: string[];      // mapper coerces null → []
  keyGrowthIndicators: string[];         // mapper coerces null → []
  theme: ProfileTheme;
}
