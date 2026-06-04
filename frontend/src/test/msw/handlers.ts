/**
 * MSW request handlers for Part 3 backend endpoints.
 * Wildcard host (`*`) so handlers match regardless of axios baseURL —
 * dev-proxy (empty baseURL → same origin) and absolute (`http://localhost:8000`)
 * both work in tests.
 */

import { http, HttpResponse } from "msw";
import type { FeatureActionAssigned } from "../../types";
import {
  ADMIN_SENTINEL,
  DEFAULT_ONBOARDED_ACCESS,
  mockActionControls,
  mockFeatures,
  mockMeResponse,
  mockOnboardResponse,
  mockProjects,
  mockUserAccess,
  mockUsers,
} from "./data";

export const handlers = [
  // --- Auth / Session ---
  http.get("*/api/csrf", () => HttpResponse.json({ ok: true })),

  http.post("*/api/auth/login", () =>
    HttpResponse.json({
      token: "test-access-token",
      refreshToken: "test-refresh-token",
      ...mockMeResponse,
    }),
  ),

  http.post("*/api/auth/refresh", () =>
    HttpResponse.json({
      token: "test-access-token-refreshed",
      refreshToken: "test-refresh-token-refreshed",
    }),
  ),

  http.get("*/api/auth/me", () => HttpResponse.json(mockMeResponse)),

  // --- Access Definitions (Phase 4 endpoint renames) ---
  http.get("*/api/feature-access", () => HttpResponse.json(mockFeatures)),
  http.get("*/api/action-controls", () => HttpResponse.json(mockActionControls)),

  // --- Projects (admin-only — full system list) ---
  http.get("*/api/projects/all", () => HttpResponse.json(mockProjects)),
  http.get("*/api/projects/all/", () => HttpResponse.json(mockProjects)),

  // --- Users ---
  http.get("*/api/users", () => HttpResponse.json(mockUsers)),

  // POST onboard — Phase 5 default-on-onboarding simulation:
  // if request omits `featureActionAssigned` (or sends []), respond with the
  // canonical default-onboarded array. Otherwise echo the explicit value.
  http.post("*/api/users", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const explicit = body.featureActionAssigned as
      | FeatureActionAssigned
      | undefined;
    const featureActionAssigned: FeatureActionAssigned =
      explicit && explicit.length > 0 ? explicit : DEFAULT_ONBOARDED_ACCESS;
    return HttpResponse.json(
      {
        ...mockOnboardResponse,
        email: (body.email as string) ?? mockOnboardResponse.email,
        firstName: (body.firstName as string) ?? mockOnboardResponse.firstName,
        lastName: (body.lastName as string) ?? mockOnboardResponse.lastName,
        mobileNumber:
          typeof body.mobileNumber === "string"
            ? body.mobileNumber
            : mockOnboardResponse.mobileNumber,
        role: (body.role as string) ?? mockOnboardResponse.role,
        featureActionAssigned,
        projectIds: Array.isArray(body.projectIds)
          ? (body.projectIds as string[])
          : mockOnboardResponse.projectIds,
      },
      { status: 201 },
    );
  }),

  // --- User Access (Phase 4: role removed from this endpoint) ---
  http.get("*/api/users/:userId/access", ({ params }) =>
    HttpResponse.json({
      role: mockUserAccess.role,
      featureActionAssigned: mockUserAccess.featureActionAssigned,
      projectIds: mockUserAccess.projects.map((project) => project.projectId),
      userId: params.userId as string,
    }),
  ),

  // PUT carries projectIds + featureActionAssigned only. Role is silently
  // ignored to match the BE Phase 4 behaviour.
  http.put("*/api/users/:userId/access", async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      role: mockUserAccess.role,
      featureActionAssigned: mockUserAccess.featureActionAssigned,
      projectIds: mockUserAccess.projects.map((project) => project.projectId),
      userId: params.userId as string,
      ...(body.featureActionAssigned
        ? { featureActionAssigned: body.featureActionAssigned }
        : {}),
      ...(Array.isArray(body.projectIds)
        ? { projectIds: body.projectIds }
        : {}),
    });
  }),

  // --- Admin Profile ---
  // partial=True on the BE. Returns the updated UserListItem shape.
  http.patch("*/api/users/:userId", async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const target =
      mockUsers.find((u) => u.userId === params.userId) ?? mockUsers[0];
    return HttpResponse.json({
      ...target,
      userId: params.userId as string,
      firstName:
        typeof body.firstName === "string" ? body.firstName : target.firstName,
      lastName:
        typeof body.lastName === "string" ? body.lastName : target.lastName,
      mobileNumber:
        typeof body.mobileNumber === "string"
          ? body.mobileNumber
          : target.mobileNumber,
      role: typeof body.role === "string" ? body.role : target.role,
    });
  }),

  // --- Self-profile (unchanged from Part 2) ---
  http.get("*/api/auth/profile", () =>
    HttpResponse.json({
      userId: mockUsers[0].userId,
      email: mockUsers[0].email,
      firstName: mockUsers[0].firstName,
      lastName: mockUsers[0].lastName,
      mobileNumber: mockUsers[0].mobileNumber,
      role: mockUsers[0].role,
    }),
  ),
  http.put("*/api/auth/profile", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      userId: mockUsers[0].userId,
      email: mockUsers[0].email,
      firstName:
        typeof body.firstName === "string"
          ? body.firstName
          : mockUsers[0].firstName,
      lastName:
        typeof body.lastName === "string"
          ? body.lastName
          : mockUsers[0].lastName,
      mobileNumber:
        typeof body.mobileNumber === "string"
          ? body.mobileNumber
          : mockUsers[0].mobileNumber,
      role: mockUsers[0].role,
    });
  }),

  // Reference: admin sentinel is exported separately so tests can opt into it.
  // (Not a handler — re-exported for convenience via the data module.)
];

export { ADMIN_SENTINEL };
