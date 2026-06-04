/**
 * Tests for UpdateUserProfileDialog — Part 3 (Phase 8).
 *
 * Phase 4 endpoint: PUT /api/users/<id>/profile (admin edits another user).
 * Fields: firstName, lastName, mobileNumber, role. Email + password are
 * intentionally absent. partial=True on the BE — any subset of fields valid.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../msw/server";
import { render, screen, waitFor } from "../test-utils";

import { UpdateUserProfileDialog } from "../../components/user-management/UpdateUserProfileDialog";

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

beforeEach(() => {
  document.cookie = "csrftoken=test-csrf-token; path=/";
});

async function waitForDialog() {
  await waitFor(() => {
    expect(
      screen.getByRole("heading", { name: "Update Profile" }),
    ).toBeInTheDocument();
  });
}

describe("UpdateUserProfileDialog — initial render", () => {
  it("does not render anything when userId is null", () => {
    render(
      <UpdateUserProfileDialog
        userId={null}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("heading", { name: "Update Profile" }),
    ).not.toBeInTheDocument();
  });

  it("opens with hydrated firstName/lastName/role from the access record", async () => {
    render(
      <UpdateUserProfileDialog
        userId="user-2"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    await waitForDialog();
    await waitFor(() => {
      expect(
        (screen.getByLabelText("First name") as HTMLInputElement).value,
      ).toBe("Farm");
    });
    expect((screen.getByLabelText("Last name") as HTMLInputElement).value).toBe(
      "Manager",
    );
    expect((screen.getByLabelText("Role") as HTMLInputElement).value).toBe(
      "farm_manager",
    );
  });

  it("does NOT render email or password fields (admin doesn't reset other users' credentials here)", async () => {
    render(
      <UpdateUserProfileDialog
        userId="user-2"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    await waitForDialog();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^password/i)).not.toBeInTheDocument();
  });
});

describe("UpdateUserProfileDialog — submit", () => {
  it("submits a partial body (firstName only) to PUT /users/<id>/profile", async () => {
    let observedBody: Record<string, unknown> | null = null;
    server.use(
      http.put("*/api/users/:userId/profile", async ({ request, params }) => {
        observedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          userId: params.userId as string,
          email: "manager@aquaculture.com",
          firstName: "Renamed",
          lastName: "Manager",
          mobileNumber: null,
          role: "farm_manager",
          createdAt: "2026-01-05T00:00:00Z",
        });
      }),
    );

    const onSuccess = vi.fn();
    const u = userEvent.setup();
    render(
      <UpdateUserProfileDialog
        userId="user-2"
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    );
    await waitForDialog();
    await waitFor(() => {
      expect(
        (screen.getByLabelText("First name") as HTMLInputElement).value,
      ).toBe("Farm");
    });

    const firstNameInput = screen.getByLabelText("First name");
    await u.clear(firstNameInput);
    await u.type(firstNameInput, "Renamed");

    await u.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    expect(observedBody).not.toBeNull();
    expect(observedBody!.firstName).toBe("Renamed");
  });

  it("Cancel button closes the dialog without firing onSuccess", async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    const u = userEvent.setup();
    render(
      <UpdateUserProfileDialog
        userId="user-2"
        onClose={onClose}
        onSuccess={onSuccess}
      />,
    );
    await waitForDialog();
    await u.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onClose).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("shows a load-error inside the dialog when the access fetch fails", async () => {
    server.use(
      http.get("*/api/users/:userId/access", () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    render(
      <UpdateUserProfileDialog
        userId="user-2"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Failed to load user profile")).toBeInTheDocument();
    });
  });
});
