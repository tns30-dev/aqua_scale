import { beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";

import { websocketService } from "../../services/websocket.service";

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    if (this.readyState === MockWebSocket.CLOSED) return;
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({} as CloseEvent);
  }

  emitOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({} as Event);
  }

  emitMessage(payload: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent);
  }
}

beforeEach(() => {
  websocketService.disconnectAll();
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
});

describe("websocketService — Realtime Gateway contract", () => {
  it("mints a WS token, opens /ws, sends first-frame AUTH, and dispatches reading frames", async () => {
    const onReading = vi.fn();
    const onStatus = vi.fn();

    websocketService.connectToPond("pond-1", onReading, undefined, onStatus);

    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));
    const socket = MockWebSocket.instances[0];
    expect(socket.url).toMatch(/\/ws$/);

    socket.emitOpen();
    expect(JSON.parse(socket.sent[0])).toEqual({
      type: "AUTH",
      token: "test-ws-token",
    });

    socket.emitMessage({ type: "AUTH_OK", connectionId: "conn-1" });
    expect(onStatus).toHaveBeenLastCalledWith("connected");

    socket.emitMessage({
      type: "sensor.reading",
      project_id: "proj-1",
      pond_id: "pond-1",
      measured_at: "2026-06-04T00:00:00Z",
      values: { ph: 7.2, temperature: 28.5 },
    });

    expect(onReading).toHaveBeenCalledWith({
      type: "reading",
      timestamp: "2026-06-04T00:00:00Z",
      parameters: { ph: 7.2, temperature: 28.5 },
      alerts: [],
    });
  });

  it("dispatches project-scoped alert frames only to the matching project subscription", async () => {
    const onUpdate = vi.fn();

    websocketService.connectToProject("proj-1", onUpdate);

    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));
    const socket = MockWebSocket.instances[0];
    socket.emitOpen();
    socket.emitMessage({ type: "AUTH_OK", connectionId: "conn-1" });

    socket.emitMessage({
      type: "alert",
      project_id: "proj-2",
      pond_id: "pond-1",
      alert: { parameter: "ph", severity: "critical" },
    });
    expect(onUpdate).not.toHaveBeenCalled();

    const alertFrame = {
      type: "alert",
      project_id: "proj-1",
      pond_id: "pond-1",
      alert: {
        parameter: "ph",
        severity: "critical",
        current_value: 9.1,
        threshold: 8.5,
        message: "ph exceeded maximum: 9.1 > 8.5",
      },
    };
    socket.emitMessage(alertFrame);

    expect(onUpdate).toHaveBeenCalledWith(alertFrame);
  });
});
