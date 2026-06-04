import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "../test-utils";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "../../components/layout/Sidebar";

// ----------------------
// Router & Context Mocks
// ----------------------

const mockNavigate = vi.fn();
let mockPathname = "/overview";
let mockIsPlatformAdmin = false;

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: mockPathname }),
  };
});

// Sidebar uses isPlatformAdmin from useSession to decide whether the User
// Management section is visible. ProfileProvider (via test-utils) also calls
// useSession, so we stub it here.
vi.mock("../../context/SessionContext", () => ({
  useSession: () => ({
    user: null,
    projects: [],
    loading: false,
    isAuthenticated: false,
    isPlatformAdmin: mockIsPlatformAdmin,
    refresh: vi.fn(),
    setSession: vi.fn(),
    clear: vi.fn(),
    hasFeatureAccess: () => false,
    hasActionControl: () => false,
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SessionProvider: ({ children }: any) => children,
}));

// Stub TopNavActions + ProfileDropdown — they pull in apiService and
// other concerns we don't want to load in a Sidebar unit test.
vi.mock("../../components/layout/TopNavActions", () => ({
  TopNavActions: () => <div data-testid="mock-topnavactions" />,
}));
vi.mock("../../components/layout/ProfileDropdown", () => ({
  ProfileDropdown: () => <div data-testid="mock-profiledropdown" />,
}));

vi.mock("lucide-react", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  LayoutGrid: (p: any) => <div data-testid="icon-overview" {...p} />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Box: (p: any) => <div data-testid="icon-digital-twin" {...p} />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TrendingUp: (p: any) => <div data-testid="icon-rt-forecast" {...p} />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  History: (p: any) => <div data-testid="icon-historical" {...p} />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  GitCompare: (p: any) => <div data-testid="icon-pond-comparison" {...p} />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Droplets: (p: any) => <div data-testid="icon-logo" {...p} />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  X: (p: any) => <div data-testid="icon-close" {...p} />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Users: (p: any) => <div data-testid="icon-users" {...p} />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ChevronDown: (p: any) => <div data-testid="icon-chevron" {...p} />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  UsersRound: (p: any) => <div data-testid="icon-users-round" {...p} />,
}));

describe("Sidebar", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockPathname = "/overview";
    mockIsPlatformAdmin = false;
  });

  describe("Always-visible navigation", () => {
    it("renders the logo, app name, and version (rendered for both desktop aside and mobile drawer)", () => {
      render(<Sidebar />);
      // Sidebar mounts both desktop and mobile-drawer copies in the DOM, so
      // each text appears more than once — `getAllByText` confirms presence.
      expect(screen.getAllByText("AquaShield").length).toBeGreaterThan(0);
      expect(screen.getAllByText("v1.0.0").length).toBeGreaterThan(0);
      expect(screen.getAllByTestId("icon-logo").length).toBeGreaterThan(0);
    });

    it("renders the four base navigation items (Overview, Digital Twin, Real-time & Forecast, Historical Data)", () => {
      render(<Sidebar />);
      expect(
        screen.getAllByRole("button", { name: /overview/i }).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByRole("button", { name: /digital twin/i }).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByRole("button", { name: /real-time & forecast/i })
          .length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByRole("button", { name: /historical data/i }).length,
      ).toBeGreaterThan(0);
    });
  });

  describe("User Management section — isPlatformAdmin gate", () => {
    it("does NOT render User Management when isPlatformAdmin is false", () => {
      mockIsPlatformAdmin = false;
      render(<Sidebar />);
      expect(
        screen.queryByRole("button", { name: /user management/i }),
      ).not.toBeInTheDocument();
    });

    it("renders User Management when isPlatformAdmin is true", () => {
      mockIsPlatformAdmin = true;
      render(<Sidebar />);
      expect(
        screen.getAllByRole("button", { name: /user management/i }).length,
      ).toBeGreaterThan(0);
    });

    it("does NOT render a legacy 'Roles' sub-link (Part 2 dropped role CRUD UI)", () => {
      mockIsPlatformAdmin = true;
      render(<Sidebar />);
      expect(
        screen.queryByRole("button", { name: /^roles$/i }),
      ).not.toBeInTheDocument();
    });

    it("renders the Users sub-link under User Management when admin is on a /user-management/* route (auto-expands)", () => {
      mockIsPlatformAdmin = true;
      mockPathname = "/user-management/users";
      render(<Sidebar />);
      expect(
        screen.getAllByRole("button", { name: /^users$/i }).length,
      ).toBeGreaterThan(0);
    });
  });

  describe("Navigation behavior", () => {
    it("calls navigate with the item's path when a leaf nav item is clicked", async () => {
      render(<Sidebar />);
      const historicalButtons = screen.getAllByRole("button", {
        name: /historical data/i,
      });
      await userEvent.click(historicalButtons[0]);
      expect(mockNavigate).toHaveBeenCalledWith("/historical");
    });

    it("clicking User Management (parent with children) navigates to the first child path", async () => {
      mockIsPlatformAdmin = true;
      mockPathname = "/overview"; // not under /user-management → triggers nav
      render(<Sidebar />);
      const umButtons = screen.getAllByRole("button", {
        name: /user management/i,
      });
      await userEvent.click(umButtons[0]);
      expect(mockNavigate).toHaveBeenCalledWith("/user-management/users");
    });
  });
});