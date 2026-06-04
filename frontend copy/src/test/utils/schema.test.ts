import { describe, it, expect } from "vitest";
import {
  adminUpdateUserProfileSchema,
  featureActionAssignedSchema,
  onboardFormSchema,
  profileUpdateSchema,
  updateUserAccessSchema,
} from "../../utils/schema";

// Reusable valid onboard payload — tests override one field at a time.
function validOnboardPayload(overrides: Record<string, unknown> = {}) {
  return {
    email: "user@test.com",
    password: "password123",
    firstName: "Test",
    lastName: "User",
    role: "user",
    projectIds: ["proj-1"],
    ...overrides,
  };
}

describe("onboardFormSchema (Part 3)", () => {
  it("accepts a complete payload with featureActionAssigned omitted (Phase 5 defaults branch)", () => {
    const result = onboardFormSchema.safeParse(validOnboardPayload());
    expect(result.success).toBe(true);
  });

  it("accepts a payload with explicit featureActionAssigned array", () => {
    const result = onboardFormSchema.safeParse(
      validOnboardPayload({
        featureActionAssigned: [
          { feature_access: "overview", action_controls: [] },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("accepts a payload with empty featureActionAssigned (server hydrates defaults)", () => {
    const result = onboardFormSchema.safeParse(
      validOnboardPayload({ featureActionAssigned: [] }),
    );
    expect(result.success).toBe(true);
  });

  it("accepts a payload with optional mobileNumber", () => {
    const result = onboardFormSchema.safeParse(
      validOnboardPayload({ mobileNumber: "0123456789" }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = onboardFormSchema.safeParse(
      validOnboardPayload({ email: "not-an-email" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = onboardFormSchema.safeParse(
      validOnboardPayload({ password: "short" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an empty firstName / lastName / role", () => {
    expect(
      onboardFormSchema.safeParse(validOnboardPayload({ firstName: "" }))
        .success,
    ).toBe(false);
    expect(
      onboardFormSchema.safeParse(validOnboardPayload({ lastName: "" }))
        .success,
    ).toBe(false);
    expect(
      onboardFormSchema.safeParse(validOnboardPayload({ role: "" })).success,
    ).toBe(false);
  });
});

describe("featureActionAssignedSchema — accept paths", () => {
  it("accepts an empty array", () => {
    expect(featureActionAssignedSchema.safeParse([]).success).toBe(true);
  });

  it("accepts the default-onboarded shape", () => {
    const value = [
      { feature_access: "overview", action_controls: [] },
      {
        feature_access: "realtime_forecast",
        action_controls: ["ai_forecast", "schedule_forecast"],
      },
      { feature_access: "historical_data", action_controls: ["export_data"] },
    ];
    expect(featureActionAssignedSchema.safeParse(value).success).toBe(true);
  });

  it("accepts the admin wildcard sentinel", () => {
    const value = [{ feature_access: "*", action_controls: ["*"] }];
    expect(featureActionAssignedSchema.safeParse(value).success).toBe(true);
  });
});

describe("featureActionAssignedSchema — reject paths (mirror BE invariants)", () => {
  it("rejects a Part 2 dict shape", () => {
    expect(
      featureActionAssignedSchema.safeParse({
        modules_access: [],
        features_access: [],
      }).success,
    ).toBe(false);
  });

  it("rejects a string root", () => {
    expect(featureActionAssignedSchema.safeParse("not an array").success).toBe(
      false,
    );
  });

  it("rejects an entry missing action_controls", () => {
    expect(
      featureActionAssignedSchema.safeParse([{ feature_access: "overview" }])
        .success,
    ).toBe(false);
  });

  it("rejects an entry missing feature_access", () => {
    expect(
      featureActionAssignedSchema.safeParse([{ action_controls: [] }]).success,
    ).toBe(false);
  });

  it("rejects a non-string feature code", () => {
    expect(
      featureActionAssignedSchema.safeParse([
        { feature_access: 1, action_controls: [] },
      ]).success,
    ).toBe(false);
  });

  it("rejects non-array action_controls", () => {
    expect(
      featureActionAssignedSchema.safeParse([
        { feature_access: "overview", action_controls: "x" },
      ]).success,
    ).toBe(false);
  });

  it("rejects non-string action entries", () => {
    expect(
      featureActionAssignedSchema.safeParse([
        { feature_access: "overview", action_controls: [1, 2] },
      ]).success,
    ).toBe(false);
  });

  it("rejects duplicate feature_access codes", () => {
    expect(
      featureActionAssignedSchema.safeParse([
        { feature_access: "overview", action_controls: [] },
        { feature_access: "overview", action_controls: [] },
      ]).success,
    ).toBe(false);
  });

  it("rejects wildcard sentinel with concrete action codes", () => {
    expect(
      featureActionAssignedSchema.safeParse([
        { feature_access: "*", action_controls: ["ai_forecast"] },
      ]).success,
    ).toBe(false);
  });

  it("rejects '*' mixed with concrete codes inside one action_controls", () => {
    expect(
      featureActionAssignedSchema.safeParse([
        {
          feature_access: "realtime_forecast",
          action_controls: ["*", "ai_forecast"],
        },
      ]).success,
    ).toBe(false);
  });
});

describe("updateUserAccessSchema (Phase 4 — role removed from this endpoint)", () => {
  it("accepts an empty object (admin may update any subset)", () => {
    expect(updateUserAccessSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a featureActionAssigned-only update", () => {
    const result = updateUserAccessSchema.safeParse({
      featureActionAssigned: [{ feature_access: "*", action_controls: ["*"] }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a projectIds-only update", () => {
    expect(
      updateUserAccessSchema.safeParse({ projectIds: ["proj-1"] }).success,
    ).toBe(true);
  });

  it("accepts both fields together", () => {
    const result = updateUserAccessSchema.safeParse({
      featureActionAssigned: [
        { feature_access: "overview", action_controls: [] },
      ],
      projectIds: ["proj-1", "proj-2"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a duplicate-code featureActionAssigned via the shared schema invariant", () => {
    const result = updateUserAccessSchema.safeParse({
      featureActionAssigned: [
        { feature_access: "overview", action_controls: [] },
        { feature_access: "overview", action_controls: [] },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("profileUpdateSchema (self-update)", () => {
  it("accepts an empty object — partial PUT", () => {
    expect(profileUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("accepts firstName + lastName + mobileNumber together", () => {
    const result = profileUpdateSchema.safeParse({
      firstName: "Updated",
      lastName: "Person",
      mobileNumber: "+1-555-0100",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty mobileNumber string (user clearing their phone)", () => {
    expect(profileUpdateSchema.safeParse({ mobileNumber: "" }).success).toBe(
      true,
    );
  });

  it("rejects an empty firstName when the field is provided", () => {
    expect(profileUpdateSchema.safeParse({ firstName: "" }).success).toBe(
      false,
    );
  });
});

describe("adminUpdateUserProfileSchema (Phase 4 — admin edits other user)", () => {
  it("accepts an empty object (partial PUT)", () => {
    expect(adminUpdateUserProfileSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a role-only update", () => {
    expect(
      adminUpdateUserProfileSchema.safeParse({ role: "lab_lead" }).success,
    ).toBe(true);
  });

  it("accepts all four fields together", () => {
    const result = adminUpdateUserProfileSchema.safeParse({
      firstName: "Alex",
      lastName: "River",
      mobileNumber: "0123456789",
      role: "scientist",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty role when provided", () => {
    expect(adminUpdateUserProfileSchema.safeParse({ role: "" }).success).toBe(
      false,
    );
  });
});
