/**
 * Tests for AccessManagementDialog — Part 3 (Phase 8, revised UX).
 *
 * UX under test:
 *   - Projects (multi-select) — top section
 *   - Features pills (each = a granted feature; click = active focus; × = remove)
 *   - "+ add feature" opens a popup overlay multi-select; Done commits
 *   - Action Controls renders for the ACTIVE feature only; per-feature ticks
 *     survive focus switches.
 *   - Submit assembles `featureActionAssigned` as the canonical Part 3 array.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "../msw/server";
import { render, screen, waitFor } from "../test-utils";

import { AccessManagementDialog } from "../../components/user-management/AccessManagementDialog";
import {
  mockActionControls,
  mockFeatures,
  mockProjects,
} from "../msw/data";

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

function open(userId: string = "user-2") {
  return render(
    <AccessManagementDialog
      userId={userId}
      features={mockFeatures}
      actionControls={mockActionControls}
      projects={mockProjects}
      onClose={vi.fn()}
      onSuccess={vi.fn()}
    />,
  );
}

async function waitForDialog() {
  await waitFor(() => {
    expect(
      screen.getByRole("heading", { name: "Access Management" }),
    ).toBeInTheDocument();
  });
}

describe("AccessManagementDialog — hydration", () => {
  // skipped: feature/action access hidden — see control_hide.md §B
  it.skip("renders pills for every granted feature from the access record", async () => {
    open();
    await waitForDialog();
    // mockUserAccess.featureActionAssigned == DEFAULT_ONBOARDED_ACCESS (5 features).
    // Each feature name may appear in BOTH the pill row AND the active-feature
    // tag (when it's the active focus), so use getAllByText and assert presence.
    await waitFor(() => {
      expect(screen.getAllByText("Overview").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("Digital Twin").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Real Time & Forecast").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Historical Data").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pond Comparison").length).toBeGreaterThan(0);
  });

  // skipped: feature/action access hidden — see control_hide.md §B
  it.skip("renders Action Controls for the active feature (first granted by default)", async () => {
    open();
    await waitForDialog();
    // First granted feature is `overview` — no actions defined.
    await waitFor(() => {
      expect(
        screen.getByText(/no actions defined for this feature/i),
      ).toBeInTheDocument();
    });
  });

  it("shows a load-error inside the dialog when the access fetch fails", async () => {
    server.use(
      http.get("*/api/users/:userId/access", () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    open();
    await waitFor(() => {
      expect(screen.getByText("Failed to load user access")).toBeInTheDocument();
    });
  });
});

// skipped: feature/action access hidden — see control_hide.md §B
describe.skip("AccessManagementDialog — pill interactions", () => {
  it("clicking a different pill switches the active focus and re-renders Action Controls", async () => {
    const u = userEvent.setup();
    open();
    await waitForDialog();
    await waitFor(() =>
      expect(screen.getByText("Real Time & Forecast")).toBeInTheDocument(),
    );

    // The pill for Real Time & Forecast: filter to role=button (× is the
    // nested button; the pill itself is role=button via the span).
    await u.click(screen.getByText("Real Time & Forecast"));

    // Action Controls now shows ai_forecast + schedule_forecast.
    await waitFor(() => {
      expect(screen.getByText("AI Forecast")).toBeInTheDocument();
      expect(screen.getByText("Schedule Forecast")).toBeInTheDocument();
    });
  });

  it("removing a feature via × drops it from the pill list", async () => {
    const u = userEvent.setup();
    open();
    await waitForDialog();
    await waitFor(() =>
      expect(screen.getByText("Historical Data")).toBeInTheDocument(),
    );

    // Remove "Historical Data" by clicking its × — buttons with aria-label.
    const removeBtn = screen.getByRole("button", {
      name: /remove historical data/i,
    });
    await u.click(removeBtn);

    await waitFor(() => {
      expect(screen.queryByText("Historical Data")).not.toBeInTheDocument();
    });
  });
});

// skipped: feature/action access hidden — see control_hide.md §B
describe.skip("AccessManagementDialog — popup", () => {
  it("clicking + add feature opens the popup and renders all 6 features", async () => {
    const u = userEvent.setup();
    open();
    await waitForDialog();
    await waitFor(() =>
      expect(screen.getByText("+ add feature")).toBeInTheDocument(),
    );

    await u.click(screen.getByText("+ add feature"));

    // Popup header
    expect(screen.getByText("Select features")).toBeInTheDocument();
    // All 6 features rendered as options inside the popup list — User Management
    // is the one NOT already granted, so seeing it here proves the popup
    // listed every feature.
    const popupOptions = screen.getAllByText("User Management");
    expect(popupOptions.length).toBeGreaterThan(0);
  });

  it("cancel closes the popup without changing the granted feature set", async () => {
    const u = userEvent.setup();
    open();
    await waitForDialog();
    await waitFor(() =>
      expect(screen.getByText("+ add feature")).toBeInTheDocument(),
    );

    await u.click(screen.getByText("+ add feature"));
    expect(screen.getByText("Select features")).toBeInTheDocument();
    // Cancel button inside popup — there's also a Cancel below in the dialog form.
    // The popup is rendered AFTER the form (last child of DialogContent), so its
    // Cancel is the LAST one in DOM order.
    const cancelButtons = screen.getAllByRole("button", { name: /^cancel$/i });
    await u.click(cancelButtons[cancelButtons.length - 1]);

    await waitFor(() => {
      expect(screen.queryByText("Select features")).not.toBeInTheDocument();
    });
  });
});

// skipped: feature/action access hidden — see control_hide.md §B
describe.skip("AccessManagementDialog — submit", () => {
  it("submits the canonical Part 3 array shape with only granted features", async () => {
    let observedBody: Record<string, unknown> | null = null;
    server.use(
      http.put("*/api/users/:userId/access", async ({ request, params }) => {
        observedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          userId: params.userId as string,
          email: "manager@aquaculture.com",
          firstName: "Farm",
          lastName: "Manager",
          role: "farm_manager",
          featureActionAssigned: observedBody.featureActionAssigned,
          projects: [],
        });
      }),
    );

    const onSuccess = vi.fn();
    const u = userEvent.setup();
    render(
      <AccessManagementDialog
        userId="user-2"
        features={mockFeatures}
        actionControls={mockActionControls}
        projects={mockProjects}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    );
    await waitForDialog();
    await waitFor(() =>
      expect(screen.getByText("Real Time & Forecast")).toBeInTheDocument(),
    );

    // Hit Save with the default-onboarded array still in place.
    await u.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    expect(observedBody).not.toBeNull();
    const fa = observedBody!.featureActionAssigned as Array<{
      feature_access: string;
      action_controls: string[];
    }>;
    // Same 5 features that were granted in mockUserAccess.
    const featureCodes = fa.map((e) => e.feature_access).sort();
    expect(featureCodes).toEqual(
      [
        "overview",
        "digital_twin",
        "realtime_forecast",
        "historical_data",
        "pond_comparison",
      ].sort(),
    );
    // realtime_forecast still carries ai_forecast + schedule_forecast.
    const rt = fa.find((e) => e.feature_access === "realtime_forecast")!;
    expect(rt.action_controls).toEqual(
      expect.arrayContaining(["ai_forecast", "schedule_forecast"]),
    );
  });

  it("after removing a feature pill, submit omits that feature from the payload", async () => {
    let observedBody: Record<string, unknown> | null = null;
    server.use(
      http.put("*/api/users/:userId/access", async ({ request, params }) => {
        observedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          userId: params.userId as string,
          email: "manager@aquaculture.com",
          firstName: "Farm",
          lastName: "Manager",
          role: "farm_manager",
          featureActionAssigned: observedBody.featureActionAssigned,
          projects: [],
        });
      }),
    );

    const onSuccess = vi.fn();
    const u = userEvent.setup();
    render(
      <AccessManagementDialog
        userId="user-2"
        features={mockFeatures}
        actionControls={mockActionControls}
        projects={mockProjects}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    );
    await waitForDialog();
    await waitFor(() =>
      expect(screen.getByText("Historical Data")).toBeInTheDocument(),
    );

    // Remove Historical Data.
    await u.click(
      screen.getByRole("button", { name: /remove historical data/i }),
    );

    await u.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    const fa = observedBody!.featureActionAssigned as Array<{
      feature_access: string;
    }>;
    expect(fa.map((e) => e.feature_access)).not.toContain("historical_data");
  });
});
