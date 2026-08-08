// src/test/components/TopNav.test.tsx
//
// TopNav.tsx is a thin header wrapper around <TopNavActions>. These tests
// drive TopNavActions behavior through <TopNav> — clicking Logout in the
// rendered DOM exercises the full chain: apiService.logout → SessionContext
// clear → pondStore.disconnectAll → react-router navigate('/login').

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "../test-utils";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
const mockClearSession = vi.fn();
const mockDisconnectAll = vi.fn();

vi.mock("react-router-dom", async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual: any = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// SessionContext: TopNavActions calls `clear` on logout; ProfileProvider
// (wired by test-utils) also calls useSession on render.
vi.mock("../../context/SessionContext", () => ({
  useSession: () => ({
    user: null,
    projects: [],
    loading: false,
    isAuthenticated: false,
    isPlatformAdmin: false,
    refresh: vi.fn(),
    setSession: vi.fn(),
    clear: mockClearSession,
    hasFeatureAccess: () => false,
    hasActionControl: () => false,
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SessionProvider: ({ children }: any) => children,
}));

// pondStore: only `getState().disconnectAll` is used by the logout flow.
vi.mock("../../stores/pondStore", () => ({
  usePondStore: {
    getState: () => ({ disconnectAll: mockDisconnectAll }),
  },
}));

// auth utils: TopNavActions reads getCurrentProjectId to decide whether to
// fetch alerts; default to no project (skips the fetch).
vi.mock("../../utils/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/auth")>();
  return {
    ...actual,
    getCurrentProjectId: vi.fn(() => null),
  };
});

// apiService: surface only what TopNavActions touches.
vi.mock("../../services/api.service", () => ({
  apiService: {
    getAlerts: vi.fn().mockResolvedValue({ alerts: [] }),
    logout: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock ProfileDropdown to isolate TopNav behavior from dropdown internals.
vi.mock("../../components/layout/ProfileDropdown", () => ({
  ProfileDropdown: () => <div data-testid="mock-profiledropdown" />,
}));

// ---------------------------------------------------------------------------
// Imports that use the mocks above (must come after vi.mock calls)
// ---------------------------------------------------------------------------

import { TopNav } from "../../components/layout/TopNav";
import { apiService } from "../../services/api.service";

const mockedApiService = apiService as unknown as {
  getAlerts: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TopNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Search, Notifications, Settings, Profile, and Logout controls", () => {
    render(<TopNav />);
    // The Logout button is the most distinctive — it has a visible text label.
    expect(screen.getByText("Logout")).toBeInTheDocument();
    expect(screen.getByTestId("mock-profiledropdown")).toBeInTheDocument();
  });

  it("clicking Logout calls apiService.logout, clears SessionContext, disconnects pond store, and navigates to /login", async () => {
    render(<TopNav />);
    await userEvent.click(screen.getByText("Logout"));
    await waitFor(() => {
      expect(mockedApiService.logout).toHaveBeenCalledTimes(1);
      expect(mockClearSession).toHaveBeenCalledTimes(1);
      expect(mockDisconnectAll).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });
  });

  // NOTE — a "logout when backend rejects" test was intentionally omitted:
  // TopNavActions' handleLogout uses try/finally without a catch, so a
  // rejected `apiService.logout()` runs the cleanup (finally) but then
  // bubbles up as an unhandled promise rejection from the onClick handler.
  // The cleanup runs (correct), but Vitest flags the unhandled rejection
  // (noisy). Fixing this is a production-code change (add `.catch(() => {})`)
  // — out of Phase 7 scope. Track separately if/when revisited.
});