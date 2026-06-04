/**
 * Zod validation schemas for the entire application.
 *
 * User-management forms (Part 3):
 * - onboardFormSchema             — POST /api/users
 * - profileUpdateSchema           — PUT  /api/auth/profile (self)
 * - updateUserAccessSchema        — PUT  /api/users/{id}/access (projects + access only)
 * - adminUpdateUserProfileSchema  — PUT  /api/users/{id}/profile (admin edits other)
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared — featureActionAssigned permission payload (Part 3)
//
// Array of { feature_access, action_controls } entries. Inner keys are
// snake_case to match the wire (see user_mgmt_reference/part_3/phase_7.md
// § Wire-Format Decision). Invariants mirror the BE validator
// `_validate_feature_action_assigned`.
// ---------------------------------------------------------------------------

export const featureActionEntrySchema = z.object({
  feature_access: z.string().min(1),
  action_controls: z.array(z.string()),
});

export type FeatureActionEntryValues = z.infer<typeof featureActionEntrySchema>;

export const featureActionAssignedSchema = z
  .array(featureActionEntrySchema)
  .superRefine((entries, ctx) => {
    // Duplicate feature_access codes are rejected.
    const seen = new Set<string>();
    for (const e of entries) {
      if (seen.has(e.feature_access)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [],
          message: `Duplicate feature_access code: ${e.feature_access}`,
        });
      }
      seen.add(e.feature_access);
    }

    for (const [i, e] of entries.entries()) {
      const hasStar = e.action_controls.includes("*");
      // Wildcard sentinel: action_controls must be [] or ["*"].
      if (
        e.feature_access === "*" &&
        !(e.action_controls.length === 0 ||
          (e.action_controls.length === 1 && hasStar))
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, "action_controls"],
          message: 'Wildcard sentinel entry must carry [] or ["*"].',
        });
      }
      // Within one entry, "*" cannot be mixed with concrete action codes.
      if (hasStar && e.action_controls.length > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, "action_controls"],
          message: '"*" cannot be mixed with specific action codes.',
        });
      }
    }
  });

export type FeatureActionAssignedValues = z.infer<
  typeof featureActionAssignedSchema
>;

// ---------------------------------------------------------------------------
// Onboard User — admin creates a new user
// Used by: Users.tsx onboard dialog → POST /api/users
//
// Phase 5: featureActionAssigned is optional. Omit (or send []) to have the
// server hydrate the default-onboarded array. Send a non-empty value to
// override the defaults entirely.
// ---------------------------------------------------------------------------

export const onboardFormSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters"),
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(255, "First name must be 255 characters or less"),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(255, "Last name must be 255 characters or less"),
  mobileNumber: z
    .string()
    .max(50, "Mobile number must be 50 characters or less")
    .optional()
    .or(z.literal("")),
  role: z
    .string()
    .min(1, "Role is required")
    .max(50, "Role must be 50 characters or less"),
  featureActionAssigned: featureActionAssignedSchema.optional(),
  projectIds: z.array(z.string()),
});

export type OnboardFormValues = z.infer<typeof onboardFormSchema>;

// ---------------------------------------------------------------------------
// Profile Update — user updates their own profile
// Used by: ProfilePage / ProfileDropdown → PUT /api/auth/profile
// All fields optional — backend supports partial updates.
// ---------------------------------------------------------------------------

export const profileUpdateSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(255, "First name must be 255 characters or less")
    .optional(),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(255, "Last name must be 255 characters or less")
    .optional(),
  mobileNumber: z
    .string()
    .max(50, "Mobile number must be 50 characters or less")
    .optional()
    .or(z.literal("")),
});

export type ProfileUpdateValues = z.infer<typeof profileUpdateSchema>;

// ---------------------------------------------------------------------------
// Update User Access — admin changes someone else's permissions/projects
// Used by: Users.tsx Access Management dialog → PUT /api/users/{id}/access
//
// Phase 4: role removed from this endpoint — see adminUpdateUserProfileSchema.
// ---------------------------------------------------------------------------

export const updateUserAccessSchema = z.object({
  featureActionAssigned: featureActionAssignedSchema.optional(),
  projectIds: z.array(z.string()).optional(),
});

export type UpdateUserAccessValues = z.infer<typeof updateUserAccessSchema>;

// ---------------------------------------------------------------------------
// Admin Update User Profile — admin edits another user's firstName/lastName/
// mobileNumber/role. Distinct from profileUpdateSchema (which is the self-
// update path). Phase 4 new endpoint: PUT /api/users/{id}/profile.
// ---------------------------------------------------------------------------

export const adminUpdateUserProfileSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(255, "First name must be 255 characters or less")
    .optional(),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(255, "Last name must be 255 characters or less")
    .optional(),
  mobileNumber: z
    .string()
    .max(50, "Mobile number must be 50 characters or less")
    .optional()
    .or(z.literal("")),
  role: z
    .string()
    .min(1, "Role is required")
    .max(50, "Role must be 50 characters or less")
    .optional(),
});

export type AdminUpdateUserProfileValues = z.infer<
  typeof adminUpdateUserProfileSchema
>;
