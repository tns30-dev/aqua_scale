/**
 * Shared mock data for MSW handlers and tests.
 * Mirrors the Part 3 shapes returned by the real backend API.
 */

import type {
  ActionControl,
  FeatureAccess,
  FeatureActionAssigned,
  MeResponse,
  Project,
  UserAccess,
  UserListItem,
  UserOnboardResponse,
} from "../../types";

// ---------------------------------------------------------------------------
// Access Definitions — Part 3 seed (6 features + 5 action_controls)
// ---------------------------------------------------------------------------

export const mockFeatures: FeatureAccess[] = [
  { featureAccessId: "feat-overview",          name: "Overview",             code: "overview",           isDefault: true  },
  { featureAccessId: "feat-digital_twin",      name: "Digital Twin",         code: "digital_twin",       isDefault: true  },
  { featureAccessId: "feat-realtime_forecast", name: "Real Time & Forecast", code: "realtime_forecast",  isDefault: true  },
  { featureAccessId: "feat-historical_data",   name: "Historical Data",      code: "historical_data",    isDefault: true  },
  { featureAccessId: "feat-pond_comparison",   name: "Pond Comparison",      code: "pond_comparison",    isDefault: true  },
  { featureAccessId: "feat-user_management",   name: "User Management",      code: "user_management",    isDefault: false },
];

export const mockActionControls: ActionControl[] = [
  { actionControlId: "act-onboard_user",      featureAccessId: "feat-user_management",   name: "Onboard User",      code: "onboard_user",      isDefault: false },
  { actionControlId: "act-manage_access",     featureAccessId: "feat-user_management",   name: "Manage Access",     code: "manage_access",     isDefault: false },
  { actionControlId: "act-export_data",       featureAccessId: "feat-historical_data",   name: "Export Data",       code: "export_data",       isDefault: true  },
  { actionControlId: "act-ai_forecast",       featureAccessId: "feat-realtime_forecast", name: "AI Forecast",       code: "ai_forecast",       isDefault: true  },
  { actionControlId: "act-schedule_forecast", featureAccessId: "feat-realtime_forecast", name: "Schedule Forecast", code: "schedule_forecast", isDefault: true  },
];

// Canonical default-onboarded array — what Phase 5's RBACService.get_default_access()
// returns and what the BE applies when onboard omits featureActionAssigned.
export const DEFAULT_ONBOARDED_ACCESS: FeatureActionAssigned = [
  { feature_access: "overview",          action_controls: [] },
  { feature_access: "digital_twin",      action_controls: [] },
  { feature_access: "realtime_forecast", action_controls: ["ai_forecast", "schedule_forecast"] },
  { feature_access: "historical_data",   action_controls: ["export_data"] },
  { feature_access: "pond_comparison",   action_controls: [] },
];

// Admin wildcard sentinel.
export const ADMIN_SENTINEL: FeatureActionAssigned = [
  { feature_access: "*", action_controls: ["*"] },
];

// ---------------------------------------------------------------------------
// Projects — full system list (returned by admin-only /api/projects/all/)
// ---------------------------------------------------------------------------

export const mockProjects: Project[] = [
  {
    projectId: "proj-1",
    name: "Shrimp Farm",
    profileTypeId: "pt-1",
    profileType: "shrimp",
  },
  {
    projectId: "proj-2",
    name: "Fish Pond",
    profileTypeId: "pt-2",
    profileType: "fish",
  },
];

// ---------------------------------------------------------------------------
// Users — list (Part 3: firstName + lastName + role text + mobileNumber)
// ---------------------------------------------------------------------------

export const mockUsers: UserListItem[] = [
  {
    userId: "user-1",
    email: "admin@aquaculture.com",
    firstName: "Admin",
    lastName: "User",
    role: "platform_admin",
    mobileNumber: null,
    createdAt: "2026-01-01T00:00:00Z",
  },
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

// ---------------------------------------------------------------------------
// User Access — Part 3 shape (role + featureActionAssigned array + projects)
// Used by GET /api/users/{id}/access
// ---------------------------------------------------------------------------

export const mockUserAccess: UserAccess = {
  userId: "user-2",
  email: "manager@aquaculture.com",
  firstName: "Farm",
  lastName: "Manager",
  role: "farm_manager",
  featureActionAssigned: DEFAULT_ONBOARDED_ACCESS,
  projects: [
    {
      projectId: "proj-1",
      name: "Shrimp Farm",
      profileTypeId: "pt-1",
      profileType: "shrimp",
    },
  ],
};

// ---------------------------------------------------------------------------
// Onboard Response — Part 3 shape (returns the created user's access)
// ---------------------------------------------------------------------------

export const mockOnboardResponse: UserOnboardResponse = {
  userId: "user-3",
  email: "new@aquaculture.com",
  firstName: "New",
  lastName: "User",
  role: "user",
  featureActionAssigned: DEFAULT_ONBOARDED_ACCESS,
  projectIds: ["proj-1"],
};

// ---------------------------------------------------------------------------
// /me + login response envelope (Part 3: `{ user, projects }`)
// ---------------------------------------------------------------------------

export const mockMeResponse: MeResponse = {
  user: {
    userId: "user-1",
    username: "Admin User",
    role: "platform_admin",
    featureActionAssigned: ADMIN_SENTINEL,
  },
  projects: mockProjects,
};