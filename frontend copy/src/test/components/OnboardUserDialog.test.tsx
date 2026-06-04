/**
 * Tests for OnboardUserDialog — Part 3 (Phase 8).
 *
 * The dialog dropped the two checkbox grids (modules + features) from Part 2;
 * final field set is email / password / firstName / lastName / mobileNumber /
 * role / projectIds. Submit deliberately OMITS `featureActionAssigned` so the
 * BE Phase 5 default-onboarding logic hydrates the curated default scope.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../msw/server";
import { render, screen, waitFor } from "../test-utils";

import { OnboardUserDialog } from "../../components/user-management/OnboardUserDialog";
import { mockProjects } from "../msw/data";

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

function openDialog() {
  return render(
    <OnboardUserDialog projects={mockProjects} onSuccess={vi.fn()} />,
  );
}

describe("OnboardUserDialog — initial render", () => {
  it("shows the trigger button without opening the dialog", () => {
    openDialog();
    expect(screen.getByText("+ Onboard User")).toBeInTheDocument();
    expect(screen.queryByText("Onboard New User")).not.toBeInTheDocument();
  });

  it("opens the dialog with the 7 expected fields when the trigger is clicked", async () => {
    const u = userEvent.setup();
    openDialog();
    await u.click(screen.getByText("+ Onboard User"));

    expect(
      screen.getByRole("heading", { name: "Onboard New User" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/)).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toBeInTheDocument();
    expect(screen.getByLabelText("Last name")).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Mobile number/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Role")).toBeInTheDocument();
    // The CheckboxGroup labelled "Projects" represents the projectIds field.
    expect(screen.getByText("Projects")).toBeInTheDocument();
  });

  it("does NOT render the deleted Part 2 access checkbox groups", async () => {
    const u = userEvent.setup();
    openDialog();
    await u.click(screen.getByText("+ Onboard User"));
    expect(screen.queryByText(/module access/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/feature access/i)).not.toBeInTheDocument();
  });
});

describe("OnboardUserDialog — validation", () => {
  it("shows zod validation errors when submitted empty", async () => {
    const u = userEvent.setup();
    openDialog();
    await u.click(screen.getByText("+ Onboard User"));
    await u.click(screen.getByText("Create User"));
    await waitFor(() => {
      expect(screen.getByText("Email is required")).toBeInTheDocument();
      expect(screen.getByText("First name is required")).toBeInTheDocument();
      expect(screen.getByText("Last name is required")).toBeInTheDocument();
    });
  });
});

describe("OnboardUserDialog — submit", () => {
  it("submits WITHOUT featureActionAssigned (server applies Phase 5 defaults)", async () => {
    let observedBody: Record<string, unknown> | null = null;
    server.use(
      http.post("*/api/users", async ({ request }) => {
        observedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            userId: "user-new",
            email: observedBody.email,
            firstName: observedBody.firstName,
            lastName: observedBody.lastName,
            role: observedBody.role,
            featureActionAssigned: [],
            projectIds: observedBody.projectIds ?? [],
          },
          { status: 201 },
        );
      }),
    );

    const onSuccess = vi.fn();
    const u = userEvent.setup();
    render(
      <OnboardUserDialog projects={mockProjects} onSuccess={onSuccess} />,
    );
    await u.click(screen.getByText("+ Onboard User"));

    await u.type(screen.getByLabelText("Email"), "newuser@test.com");
    await u.type(screen.getByLabelText(/Password/), "password123");
    await u.type(screen.getByLabelText("First name"), "New");
    await u.type(screen.getByLabelText("Last name"), "User");
    await u.click(screen.getByText("Create User"));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    // Phase 5 contract: payload omits featureActionAssigned.
    expect(observedBody).not.toBeNull();
    expect(observedBody!).not.toHaveProperty("featureActionAssigned");
    expect(observedBody!.email).toBe("newuser@test.com");
  });

  it("surfaces a duplicate-email error from the API inline", async () => {
    server.use(
      http.post("*/api/users", () =>
        HttpResponse.json(
          { email: ["A user with this email already exists."] },
          { status: 400 },
        ),
      ),
    );
    const u = userEvent.setup();
    openDialog();
    await u.click(screen.getByText("+ Onboard User"));

    await u.type(screen.getByLabelText("Email"), "existing@test.com");
    await u.type(screen.getByLabelText(/Password/), "password123");
    await u.type(screen.getByLabelText("First name"), "Test");
    await u.type(screen.getByLabelText("Last name"), "User");
    await u.click(screen.getByText("Create User"));

    await waitFor(() => {
      expect(
        screen.getByText("A user with this email already exists."),
      ).toBeInTheDocument();
    });
  });
});
