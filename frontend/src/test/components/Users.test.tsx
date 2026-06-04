/**
 * Tests for the Users admin panel — Part 3 (Phase 8).
 *
 * The panel is now four files:
 *   Users.tsx                       — list + page-level notifications + two
 *                                     dialog-open states (access + profile)
 *   OnboardUserDialog.tsx           — trigger button + onboard form
 *   AccessManagementDialog.tsx      — controlled dialog (userId prop);
 *                                     pills-as-tabs + popup multi-select
 *   UpdateUserProfileDialog.tsx     — controlled dialog (userId prop);
 *                                     admin-edits-other profile
 *
 * These tests drive the parent <Users /> and exercise the page-level flows
 * (list rendering, dialog routing). Per-dialog interaction tests live in
 * each dialog's own test file.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../msw/server";
import { render, screen, waitFor } from "../test-utils";

import { Users } from "../../components/user-management/Users";

vi.mock("../../context/SessionContext", () => ({
  useSession: () => ({
    user: null,
    projects: [],
    loading: false,
    isAuthenticated: true,
    isPlatformAdmin: true,
    refresh: vi.fn(),
    setSession: vi.fn(),
    clear: vi.fn(),
    hasFeatureAccess: () => false,
    hasActionControl: () => false,
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SessionProvider: ({ children }: any) => children,
}));

describe("Users — list", () => {
  beforeEach(() => {
    document.cookie = "csrftoken=test-csrf-token; path=/";
  });

  it("shows the loading state on initial render", () => {
    render(<Users />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders the user list after the four parallel fetches resolve (users + features + actionControls + allProjects)", async () => {
    render(<Users />);
    await waitFor(() => {
      expect(screen.getByText("Users (2)")).toBeInTheDocument();
    });
    expect(screen.getAllByText("admin@aquaculture.com").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getAllByText("manager@aquaculture.com").length,
    ).toBeGreaterThan(0);
  });

  it("renders Part 3 role text directly in the row", async () => {
    render(<Users />);
    await waitFor(() => {
      expect(screen.getByText("Users (2)")).toBeInTheDocument();
    });
    expect(screen.getAllByText("platform_admin").length).toBeGreaterThan(0);
    expect(screen.getAllByText("farm_manager").length).toBeGreaterThan(0);
  });

  it("renders two action buttons per row (Access Management + Update Profile)", async () => {
    render(<Users />);
    await waitFor(() => {
      expect(screen.getByText("Users (2)")).toBeInTheDocument();
    });
    // Both layouts (mobile cards + desktop grid) render each row's buttons,
    // so we expect at least one button per kind. Number is at least N users.
    const accessBtns = screen.getAllByRole("button", {
      name: /access management/i,
    });
    const profileBtns = screen.getAllByRole("button", {
      name: /update profile/i,
    });
    expect(accessBtns.length).toBeGreaterThanOrEqual(2);
    expect(profileBtns.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Users — OnboardUserDialog routing", () => {
  beforeEach(() => {
    document.cookie = "csrftoken=test-csrf-token; path=/";
  });

  it("clicking '+ Onboard User' opens the Onboard dialog", async () => {
    const u = userEvent.setup();
    render(<Users />);
    await waitFor(() => {
      expect(screen.getByText("+ Onboard User")).toBeInTheDocument();
    });
    await u.click(screen.getByText("+ Onboard User"));
    expect(screen.getByText("Onboard New User")).toBeInTheDocument();
  });
});

describe("Users — Access Management dialog routing", () => {
  beforeEach(() => {
    document.cookie = "csrftoken=test-csrf-token; path=/";
  });

  it("clicking Access Management on a row opens the dialog and fetches that user's access", async () => {
    const u = userEvent.setup();
    render(<Users />);
    await waitFor(() => {
      expect(screen.getByText("Users (2)")).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole("button", { name: /access management/i });
    // Mobile and desktop layouts both exist in the test DOM. The second
    // access button belongs to the manager row in the mobile layout.
    await u.click(buttons[1]);

    // The dialog title is an <h2>; buttons share the same text so disambiguate by role.
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Access Management" }),
      ).toBeInTheDocument();
    });

    // Description shows the user's name and email (across multiple text nodes).
    await waitFor(() => {
      const dialogText = screen.getByRole("dialog").textContent ?? "";
      expect(dialogText).toContain("Farm Manager");
      expect(dialogText).toContain("manager@aquaculture.com");
    });
  });

  it("shows a load-error inside the dialog when the access fetch fails", async () => {
    server.use(
      http.get("*/api/users/:userId/access", () =>
        HttpResponse.json({ detail: "Server error" }, { status: 500 }),
      ),
    );
    const u = userEvent.setup();
    render(<Users />);
    await waitFor(() => {
      expect(screen.getByText("Users (2)")).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole("button", { name: /access management/i });
    await u.click(buttons[0]);

    await waitFor(() => {
      expect(screen.getByText("Failed to load user access")).toBeInTheDocument();
    });
  });
});

describe("Users — Update Profile dialog routing", () => {
  beforeEach(() => {
    document.cookie = "csrftoken=test-csrf-token; path=/";
  });

  it("clicking Update Profile on a row opens that dialog (separate from Access Management)", async () => {
    const u = userEvent.setup();
    render(<Users />);
    await waitFor(() => {
      expect(screen.getByText("Users (2)")).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole("button", { name: /update profile/i });
    await u.click(buttons[0]);

    // Disambiguate the dialog title from the row buttons via role.
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Update Profile" }),
      ).toBeInTheDocument();
    });
    // Access Management dialog title should NOT be on screen at the same time.
    expect(
      screen.queryByRole("heading", { name: "Access Management" }),
    ).not.toBeInTheDocument();
  });
});
