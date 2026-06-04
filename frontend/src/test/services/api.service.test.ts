import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";

import { apiService } from "../../services/api.service";
import { setAuthTokens } from "../../utils/auth";
import { server } from "../msw/server";
import {
  ADMIN_SENTINEL,
  mockActionControls,
  mockFeatures,
  mockMeResponse,
  mockOnboardResponse,
  mockProjects,
  mockUserAccess,
  mockUsers,
} from "../msw/data";

beforeEach(() => {
  sessionStorage.clear();
});

describe("apiService — session bootstrap", () => {
  it("bootstrapCsrf calls GET /api/csrf and resolves without throwing", async () => {
    await expect(apiService.bootstrapCsrf()).resolves.toBeUndefined();
  });

  it("getMe returns the Part 3 {user, projects} envelope with featureActionAssigned array", async () => {
    const result = await apiService.getMe();
    expect(result).toEqual(mockMeResponse);
    expect(result.user.role).toBe("platform_admin");
    expect(result.user.featureActionAssigned).toEqual(ADMIN_SENTINEL);
    expect(result.projects).toHaveLength(2);
  });
});

describe("apiService — access definitions (Phase 4 endpoint renames)", () => {
  it("getFeatureAccess hits /api/feature-access and returns top-level capability rows", async () => {
    const result = await apiService.getFeatureAccess();
    expect(result).toEqual(mockFeatures);
    expect(result).toHaveLength(6);
    expect(result.every((f) => typeof f.isDefault === "boolean")).toBe(true);
  });

  it("getActionControls hits /api/action-controls and returns parent-FK action rows", async () => {
    const result = await apiService.getActionControls();
    expect(result).toEqual(mockActionControls);
    expect(result).toHaveLength(5);
    expect(result.every((a) => typeof a.featureAccessId === "string")).toBe(
      true,
    );
  });
});

describe("apiService — projects (admin)", () => {
  it("getAllProjects returns the system-wide project list", async () => {
    const result = await apiService.getAllProjects();
    expect(result).toEqual(mockProjects);
    expect(result).toHaveLength(2);
  });
});

describe("apiService — users (admin)", () => {
  it("getUsers returns the users list with Part 3 fields", async () => {
    const result = await apiService.getUsers();
    expect(result).toEqual(mockUsers);
    expect(result[0].firstName).toBe("Admin");
    expect(result[0].role).toBe("platform_admin");
  });

  it("onboardUser POSTs without featureActionAssigned → MSW simulates Phase 5 default-onboarded array", async () => {
    const result = await apiService.onboardUser({
      email: "new@aquaculture.com",
      password: "password123",
      firstName: "New",
      lastName: "User",
      role: "user",
      projectIds: ["proj-1"],
    });
    expect(result.role).toBe("user");
    expect(result.firstName).toBe("New");
    // Phase 5: server hydrates defaults.
    expect(result.featureActionAssigned.map((e) => e.feature_access)).toEqual([
      "overview",
      "digital_twin",
      "realtime_forecast",
      "historical_data",
      "pond_comparison",
    ]);
  });

  it("onboardUser POSTs with explicit featureActionAssigned → server keeps it verbatim", async () => {
    const explicit = [
      { feature_access: "overview", action_controls: [] },
    ];
    const result = await apiService.onboardUser({
      email: "explicit@test.com",
      password: "password123",
      firstName: "Ex",
      lastName: "Plicit",
      role: "user",
      featureActionAssigned: explicit,
      projectIds: [],
    });
    expect(result.featureActionAssigned).toEqual(explicit);
  });
});

describe("apiService — user access (admin, Phase 4 split)", () => {
  it("getUserAccess returns Part 3 shape (role + featureActionAssigned array + projects)", async () => {
    const result = await apiService.getUserAccess("user-2");
    expect(result.userId).toBe("user-2");
    expect(result.role).toBe("farm_manager");
    expect(Array.isArray(result.featureActionAssigned)).toBe(true);
    expect(result.featureActionAssigned.length).toBeGreaterThan(0);
    expect(result.projects).toHaveLength(1);
  });

  it("getUserAccess returns 404 for an unknown user id", async () => {
    server.use(
      http.get("*/api/users/:userId/access", () =>
        HttpResponse.json({ detail: "Not found" }, { status: 404 }),
      ),
    );
    await expect(apiService.getUserAccess("does-not-exist")).rejects.toThrow();
  });

  it("updateUserAccess sends featureActionAssigned-only and returns updated access", async () => {
    const result = await apiService.updateUserAccess("user-2", {
      featureActionAssigned: [
        { feature_access: "*", action_controls: ["*"] },
      ],
    });
    expect(result.featureActionAssigned).toEqual([
      { feature_access: "*", action_controls: ["*"] },
    ]);
    expect(result.projects).toHaveLength(1);
  });

  it("updateUserAccess sends projectIds-only and returns updated projects", async () => {
    const result = await apiService.updateUserAccess("user-2", {
      projectIds: ["proj-2"],
    });
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].projectId).toBe("proj-2");
  });
});

describe("apiService — admin profile endpoint", () => {
  it("updateUserProfile hits PATCH /api/users/<id> and returns the updated user", async () => {
    const result = await apiService.updateUserProfile("user-2", {
      firstName: "Renamed",
      role: "lab_lead",
    });
    expect(result.firstName).toBe("Renamed");
    expect(result.role).toBe("lab_lead");
  });

  it("updateUserProfile accepts a partial body (firstName only)", async () => {
    const result = await apiService.updateUserProfile("user-2", {
      firstName: "OnlyFirst",
    });
    expect(result.firstName).toBe("OnlyFirst");
  });
});

describe("apiService — notification and realtime endpoints", () => {
  it("getAlerts hits the Java Notification Service slashless endpoint", async () => {
    let observedUrl = "";
    server.use(
      http.get("*/api/alerts", ({ request }) => {
        observedUrl = request.url;
        return HttpResponse.json({ alerts: [] });
      }),
    );

    const result = await apiService.getAlerts("proj-1");

    expect(result).toEqual({ alerts: [] });
    expect(observedUrl).toContain("/api/alerts?projectId=proj-1");
  });

  it("acknowledgeAlert hits POST /api/alerts/<id>/acknowledge without Django trailing slash", async () => {
    let observedPath = "";
    server.use(
      http.post("*/api/alerts/:alertId/acknowledge", ({ request }) => {
        observedPath = new URL(request.url).pathname;
        return HttpResponse.json({ message: "Alert acknowledged" });
      }),
    );

    await apiService.acknowledgeAlert("alert-1", "user-1");

    expect(observedPath).toBe("/api/alerts/alert-1/acknowledge");
  });

  it("mintRealtimeToken calls the Realtime Gateway token mint endpoint", async () => {
    const result = await apiService.mintRealtimeToken();

    expect(result.token).toBe("test-ws-token");
  });
});

describe("apiService — bearer auth interceptor", () => {
  it("attaches Authorization header on POST when an access token exists", async () => {
    setAuthTokens("test-access-token", "test-refresh-token");
    let captured: string | null = null;
    server.use(
      http.post("*/api/users", ({ request }) => {
        captured = request.headers.get("Authorization");
        return HttpResponse.json(mockOnboardResponse, { status: 201 });
      }),
    );
    await apiService.onboardUser({
      email: "x@y.com",
      password: "password123",
      firstName: "X",
      lastName: "Y",
      role: "user",
      projectIds: [],
    });
    expect(captured).toBe("Bearer test-access-token");
  });

  it("attaches Authorization header on PUT when an access token exists", async () => {
    setAuthTokens("test-access-token", "test-refresh-token");
    let captured: string | null = null;
    server.use(
      http.put("*/api/users/:userId/access", ({ request }) => {
        captured = request.headers.get("Authorization");
        return HttpResponse.json(mockUserAccess);
      }),
    );
    await apiService.updateUserAccess("user-2", {
      featureActionAssigned: [],
    });
    expect(captured).toBe("Bearer test-access-token");
  });

  it("does not attach Authorization when no access token exists", async () => {
    let captured: string | null = "sentinel";
    server.use(
      http.get("*/api/users", ({ request }) => {
        captured = request.headers.get("Authorization");
        return HttpResponse.json(mockUsers);
      }),
    );
    await apiService.getUsers();
    expect(captured).toBeNull();
  });
});

describe("apiService — error handling", () => {
  it("rejects when the server returns 5xx", async () => {
    server.use(
      http.get("*/api/feature-access", () =>
        HttpResponse.json({ detail: "Server error" }, { status: 500 }),
      ),
    );
    await expect(apiService.getFeatureAccess()).rejects.toThrow();
  });
});
