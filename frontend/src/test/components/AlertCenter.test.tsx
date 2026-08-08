import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AlertCenter } from "../../components/alerts/AlertCenter";
import { AlertsProvider } from "../../context/AlertsContext";
import type { Alert } from "../../types";

const mockGetAlerts = vi.fn();
const mockAcknowledgeAlert = vi.fn();
const mockConnectToProject = vi.fn();
let projectCallback: ((frame: { type: string; project_id?: string }) => void) | null = null;

vi.mock("../../services/api.service", () => ({
  apiService: {
    getAlerts: (...args: unknown[]) => mockGetAlerts(...args),
    acknowledgeAlert: (...args: unknown[]) => mockAcknowledgeAlert(...args),
  },
}));

vi.mock("../../services/websocket.service", () => ({
  websocketService: {
    connectToProject: (...args: unknown[]) => mockConnectToProject(...args),
  },
}));

vi.mock("../../context/SessionContext", () => ({
  useSession: () => ({
    user: { userId: "user-1", username: "Tester", role: "operator", featureActionAssigned: [] },
  }),
}));

function alert(overrides: Partial<Alert>): Alert {
  return {
    alertId: "alert-1",
    pondId: "pond-1",
    pondName: "Pond A",
    severity: "warning",
    message: "ph below minimum",
    timestamp: "2026-06-04T00:00:00Z",
    acknowledged: false,
    ...overrides,
  };
}

function renderCenter() {
  return render(
    <AlertsProvider>
      <AlertCenter />
    </AlertsProvider>,
  );
}

describe("AlertCenter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("currentProjectId", "proj-1");
    projectCallback = null;
    mockGetAlerts.mockReset();
    mockAcknowledgeAlert.mockReset();
    mockConnectToProject.mockReset();
    mockConnectToProject.mockImplementation((_projectId, onUpdate) => {
      projectCallback = onUpdate as typeof projectCallback;
      return vi.fn();
    });
  });

  it("renders critical alerts first and handles project-level alerts without pond text", async () => {
    mockGetAlerts.mockResolvedValue({
      alerts: [
        alert({ alertId: "warning-1", severity: "warning", message: "ph below minimum" }),
        alert({
          alertId: "critical-1",
          pondId: null,
          pondName: "Project",
          severity: "critical",
          message: "Electricity hourly consumption exceeded threshold",
          parameter: "electricity_hourly",
          readingTimestamp: "2026-06-04T01:00:00Z",
        }),
      ],
    });

    renderCenter();

    await screen.findByText(/Electricity hourly consumption exceeded threshold/i);
    const pageText = document.body.textContent ?? "";
    expect(pageText.indexOf("Action Required")).toBeLessThan(
      pageText.indexOf("Monitor Condition"),
    );
    expect(screen.getByText(/Pond A -/i)).toBeInTheDocument();
    expect(screen.queryByText(/Project - Electricity/i)).not.toBeInTheDocument();
  });

  it("shows resolving state when an alert is acknowledged", async () => {
    mockGetAlerts.mockResolvedValue({
      alerts: [alert({ alertId: "warning-1", message: "ph below minimum" })],
    });
    mockAcknowledgeAlert.mockResolvedValue(undefined);

    renderCenter();
    await screen.findByText(/ph below minimum/i);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /resolve/i }));

    expect(mockAcknowledgeAlert).toHaveBeenCalledWith("warning-1", "");
    expect(screen.getByRole("button", { name: /resolved/i })).toBeDisabled();
  });

  it("refetches active alerts when an alert websocket frame arrives", async () => {
    mockGetAlerts
      .mockResolvedValueOnce({ alerts: [] })
      .mockResolvedValue({
        alerts: [alert({ alertId: "critical-1", severity: "critical", message: "do high" })],
      });

    renderCenter();
    await waitFor(() => expect(mockConnectToProject).toHaveBeenCalledWith("proj-1", expect.any(Function)));

    act(() => {
      projectCallback?.({ type: "alert", project_id: "proj-1" });
    });

    await screen.findByText(/do high/i);
    expect(mockGetAlerts.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
