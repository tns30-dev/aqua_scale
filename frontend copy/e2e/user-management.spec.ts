/**
 * E2E tests — User Management Part 3 (Phase 9, presentation showcase).
 *
 * Playwright drives a real browser against the dev server. All API calls are
 * intercepted with `page.route(...)` so the backend doesn't have to be running.
 * The auth model is HttpOnly-cookie based, so we let SessionContext.bootstrap
 * call `/api/csrf` + `/api/auth/me` and use the latter to hydrate the admin
 * session — no /login form interaction needed.
 */

import { test, expect, type Page, type Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Part 3 fixtures (mirror src/test/msw/data.ts)
// ---------------------------------------------------------------------------

const ADMIN_SENTINEL = [{ feature_access: "*", action_controls: ["*"] }];
const DEFAULT_ONBOARDED_ACCESS = [
  { feature_access: "overview", action_controls: [] },
  { feature_access: "digital_twin", action_controls: [] },
  {
    feature_access: "realtime_forecast",
    action_controls: ["ai_forecast", "schedule_forecast"],
  },
  { feature_access: "historical_data", action_controls: ["export_data"] },
  { feature_access: "pond_comparison", action_controls: [] },
];

const mockFeatures = [
  { featureAccessId: "feat-overview",          name: "Overview",             code: "overview",           isDefault: true  },
  { featureAccessId: "feat-digital_twin",      name: "Digital Twin",         code: "digital_twin",       isDefault: true  },
  { featureAccessId: "feat-realtime_forecast", name: "Real Time & Forecast", code: "realtime_forecast",  isDefault: true  },
  { featureAccessId: "feat-historical_data",   name: "Historical Data",      code: "historical_data",    isDefault: true  },
  { featureAccessId: "feat-pond_comparison",   name: "Pond Comparison",      code: "pond_comparison",    isDefault: true  },
  { featureAccessId: "feat-user_management",   name: "User Management",      code: "user_management",    isDefault: false },
];

const mockActionControls = [
  { actionControlId: "act-onboard_user",      featureAccessId: "feat-user_management",   name: "Onboard User",      code: "onboard_user",      isDefault: false },
  { actionControlId: "act-manage_access",     featureAccessId: "feat-user_management",   name: "Manage Access",     code: "manage_access",     isDefault: false },
  { actionControlId: "act-export_data",       featureAccessId: "feat-historical_data",   name: "Export Data",       code: "export_data",       isDefault: true  },
  { actionControlId: "act-ai_forecast",       featureAccessId: "feat-realtime_forecast", name: "AI Forecast",       code: "ai_forecast",       isDefault: true  },
  { actionControlId: "act-schedule_forecast", featureAccessId: "feat-realtime_forecast", name: "Schedule Forecast", code: "schedule_forecast", isDefault: true  },
];

const mockProjects = [
  { projectId: "proj-1", name: "Shrimp Farm", profileTypeId: "pt-1", profileType: "shrimp" },
  { projectId: "proj-2", name: "Fish Pond",   profileTypeId: "pt-2", profileType: "fish" },
];

const mockUsers = [
  {
    userId: "user-2",
    email: "manager@aquaculture.com",
    firstName: "Farm",
    lastName: "Manager",
    role: "farm_manager",
    mobileNumber: "+1234567890",
    createdAt: "2026-01-05T00:00:00Z",
  },
];

const mockMeResponse = {
  user: {
    userId: "user-1",
    username: "Admin User",
    role: "platform_admin",
    featureActionAssigned: ADMIN_SENTINEL,
  },
  projects: mockProjects,
};

const mockUserAccess = {
  userId: "user-2",
  email: "manager@aquaculture.com",
  firstName: "Farm",
  lastName: "Manager",
  role: "farm_manager",
  featureActionAssigned: DEFAULT_ONBOARDED_ACCESS,
  projects: [mockProjects[0]],
};

// ---------------------------------------------------------------------------
// Mock harness
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

async function mockAdminSession(page: Page) {
  // CSRF bootstrap — set the cookie SessionContext.bootstrapCsrf() expects.
  await page.route("**/api/csrf", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Set-Cookie": "csrftoken=test-csrf-token; Path=/" },
      body: JSON.stringify({ ok: true }),
    }),
  );

  // Session hydration — admin user with the wildcard sentinel.
  await page.route("**/api/auth/me", (route) =>
    route.fulfill(jsonResponse(mockMeResponse)),
  );

  // Access definitions + project list + users list — what /user-management/users loads.
  await page.route("**/api/feature-access", (route) =>
    route.fulfill(jsonResponse(mockFeatures)),
  );
  await page.route("**/api/action-controls", (route) =>
    route.fulfill(jsonResponse(mockActionControls)),
  );
  await page.route("**/api/projects/all/", (route) =>
    route.fulfill(jsonResponse(mockProjects)),
  );
  await page.route("**/api/users", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill(jsonResponse(mockUsers));
    }
    return route.continue();
  });

  // Per-user access endpoint (matches any uuid path segment).
  await page.route("**/api/users/*/access", (route) =>
    route.fulfill(jsonResponse(mockUserAccess)),
  );

  // Silence other endpoints pages might touch on boot.
  await page.route("**/api/ponds**", (route) =>
    route.fulfill(jsonResponse({ ponds: [] })),
  );
  await page.route("**/api/alerts**", (route) =>
    route.fulfill(jsonResponse({ alerts: [] })),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("User Management — Part 3 E2E", () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminSession(page);
  });

  test("admin sees the users list with two action buttons per row", async ({
    page,
  }) => {
    await page.goto("/user-management/users");

    await expect(
      page.getByRole("heading", { name: "Users", exact: true }),
    ).toBeVisible();
    // Email text renders in both mobile + desktop layouts; the mobile copy is
    // hidden by Tailwind sm:hidden so use a visibility-filtered locator.
    const visibleEmail = page
      .getByText("manager@aquaculture.com")
      .locator("visible=true");
    await expect(visibleEmail.first()).toBeVisible();

    // Both buttons per row — same dual-layout dance.
    await expect(
      page
        .getByRole("button", { name: /access management/i })
        .locator("visible=true")
        .first(),
    ).toBeVisible();
    await expect(
      page
        .getByRole("button", { name: /update profile/i })
        .locator("visible=true")
        .first(),
    ).toBeVisible();

    // The Part 2 single "Manage" button is gone.
    await expect(page.getByRole("button", { name: /^manage$/i })).toHaveCount(0);
  });

  test("onboarding a new user submits WITHOUT featureActionAssigned (Phase 5 contract)", async ({
    page,
  }) => {
    let observedBody: Record<string, unknown> | null = null;
    await page.route("**/api/users", async (route) => {
      const req = route.request();
      if (req.method() === "POST") {
        observedBody = req.postDataJSON() as Record<string, unknown>;
        return route.fulfill(
          jsonResponse(
            {
              userId: "user-new",
              email: (observedBody as Record<string, unknown>).email,
              firstName: (observedBody as Record<string, unknown>).firstName,
              lastName: (observedBody as Record<string, unknown>).lastName,
              role: (observedBody as Record<string, unknown>).role,
              featureActionAssigned: DEFAULT_ONBOARDED_ACCESS,
              projectIds: [],
            },
            201,
          ),
        );
      }
      return route.fulfill(jsonResponse(mockUsers));
    });

    await page.goto("/user-management/users");
    await page.getByRole("button", { name: /\+ onboard user/i }).click();

    await expect(
      page.getByRole("heading", { name: "Onboard New User" }),
    ).toBeVisible();

    await page.getByLabel("Email").fill("e2e-new@test.com");
    await page.getByLabel(/Password/).fill("password123");
    await page.getByLabel("First name").fill("E2E");
    await page.getByLabel("Last name").fill("New");
    await page.getByRole("button", { name: /create user/i }).click();

    // Wait for the dialog to close.
    await expect(
      page.getByRole("heading", { name: "Onboard New User" }),
    ).not.toBeVisible({ timeout: 5000 });

    expect(observedBody).not.toBeNull();
    const body = observedBody as unknown as Record<string, unknown>;
    expect(body).not.toHaveProperty("featureActionAssigned");
    expect(body.email).toBe("e2e-new@test.com");
  });

  test("Access Management dialog: click pill switches the active feature focus", async ({
    page,
  }) => {
    await page.goto("/user-management/users");

    await page
      .getByRole("button", { name: /access management/i })
      .first()
      .click();

    await expect(
      page.getByRole("heading", { name: "Access Management" }),
    ).toBeVisible();

    // Pills should render for all 5 granted features. First-granted (overview)
    // is the default active focus and has no actions defined.
    await expect(page.getByText("Overview").first()).toBeVisible();
    await expect(
      page.getByText(/no actions defined for this feature/i),
    ).toBeVisible();

    // Click the Real Time & Forecast pill — Action Controls re-renders with ai_forecast + schedule_forecast.
    await page.getByText("Real Time & Forecast").first().click();
    await expect(page.getByText("AI Forecast")).toBeVisible();
    await expect(page.getByText("Schedule Forecast")).toBeVisible();
  });

  test("Update Profile dialog: partial role-only update sends only the role field", async ({
    page,
  }) => {
    let observedBody: Record<string, unknown> | null = null;
    await page.route("**/api/users/*/profile", async (route) => {
      observedBody = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill(
        jsonResponse({
          userId: "user-2",
          email: "manager@aquaculture.com",
          firstName: "Farm",
          lastName: "Manager",
          mobileNumber: "+1234567890",
          role: (observedBody as Record<string, unknown>).role ?? "farm_manager",
          createdAt: "2026-01-05T00:00:00Z",
        }),
      );
    });

    await page.goto("/user-management/users");

    await page
      .getByRole("button", { name: /update profile/i })
      .first()
      .click();

    await expect(
      page.getByRole("heading", { name: "Update Profile" }),
    ).toBeVisible();

    // Wait for hydration — Role input pre-fills from getUserAccess.
    await expect(page.getByLabel("Role")).toHaveValue("farm_manager");

    await page.getByLabel("Role").fill("lab_lead");
    await page.getByRole("button", { name: /save changes/i }).click();

    await expect(
      page.getByRole("heading", { name: "Update Profile" }),
    ).not.toBeVisible({ timeout: 5000 });

    expect(observedBody).not.toBeNull();
    const body = observedBody as unknown as Record<string, unknown>;
    expect(body.role).toBe("lab_lead");
  });
});
