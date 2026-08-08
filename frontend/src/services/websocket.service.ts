/**
 * Realtime Gateway WebSocket client.
 *
 * The cloud-native backend exposes one authenticated `/ws` endpoint. The
 * browser first mints a short-lived token through `POST /ws/token`, opens the
 * gateway socket, and sends `{ type: "AUTH", token }` as the first frame.
 *
 * Public deployments must use WSS. `ws://localhost` remains valid only for
 * local development.
 */

import { config } from '../config/env';
import { apiService } from './api.service';
import type { SensorParameters, SensorReading } from '../types';

type ReadingCallback = (data: SensorReading) => void;
type ErrorCallback = (error: Error) => void;
type Status = 'connecting' | 'connected' | 'disconnected';
type StatusCallback = (status: Status) => void;
type ProjectCallback = (data: RealtimeFrame) => void;

type LegacyMessageType =
  | 'sensor_reading'
  | 'readings'
  | 'alert_notification'
  | 'project_update'
  | 'connection'
  | 'pong'
  | 'error';

type GatewayMessageType =
  | 'AUTH_OK'
  | 'AUTH_FAILED'
  | 'PONG'
  | 'ERROR'
  | 'sensor.reading'
  | 'alert'
  | 'alert_resolved';

type MessageType = LegacyMessageType | GatewayMessageType;

type LatestReading = { timestamp?: string } & Partial<SensorParameters> & Record<string, unknown>;
type WebSocketUpdate = Record<string, unknown>;

interface WebSocketMessage {
  type: MessageType;
  data?: { alerts?: SensorReading['alerts'] } & WebSocketUpdate;
  message?: string;
  reason?: string;
  pond_id?: string;
  project_id?: string;
  measured_at?: string;
  sensor_type?: string;
  value?: number;
  unit?: string;
  timestamp?: string;
  readings?: Partial<SensorParameters>;
  latest_readings?: LatestReading[];
  values?: Partial<SensorParameters>;
  alert?: {
    parameter?: string;
    severity?: string;
    current_value?: number;
    threshold?: number;
    message?: string;
    [key: string]: unknown;
  };
  parameter?: string;
}

type RealtimeFrame = WebSocketMessage;

interface PondSubscription {
  onReading: ReadingCallback;
  onError?: ErrorCallback;
  onStatus?: StatusCallback;
}

interface ProjectSubscription {
  onUpdate: ProjectCallback;
  onError?: ErrorCallback;
}

class WebSocketService {
  private socket: WebSocket | null = null;
  private pondSubscriptions: Map<string, PondSubscription> = new Map();
  private projectSubscriptions: Map<string, Set<ProjectSubscription>> = new Map();
  private maxReconnectAttempts = 5;
  private reconnectAttempts = 0;
  private reconnectDelay = 3000;
  private pingIntervalMs = 30000;
  private reconnectTimer?: number;
  private pingInterval?: number;
  private manuallyClosed = false;
  private authenticated = false;
  private opening = false;

  private mapLatestReading(latestReading: LatestReading): SensorReading {
    const { timestamp: _timestamp, ...parameters } = latestReading;
    return {
      type: 'reading',
      timestamp: latestReading.timestamp || new Date().toISOString(),
      parameters: parameters as SensorParameters,
      alerts: [],
    };
  }

  connectToPond(
    pondId: string,
    onReading: ReadingCallback,
    onError?: ErrorCallback,
    onStatus?: StatusCallback
  ): () => void {
    this.pondSubscriptions.set(pondId, { onReading, onError, onStatus });
    onStatus?.(this.authenticated ? 'connected' : 'connecting');
    void this.ensureGatewayConnection();
    return () => this.disconnectFromPond(pondId);
  }

  disconnectFromPond(pondId: string): void {
    this.pondSubscriptions.delete(pondId);
    this.closeIfUnused();
  }

  isConnected(connectionId: string): boolean {
    if (connectionId.startsWith('pond_')) {
      return this.pondSubscriptions.has(connectionId.slice('pond_'.length));
    }
    if (connectionId.startsWith('project_')) {
      return this.projectSubscriptions.has(connectionId.slice('project_'.length));
    }
    return this.authenticated && this.socket?.readyState === WebSocket.OPEN;
  }

  connectToProject(
    projectId: string,
    onUpdate: ProjectCallback,
    onError?: ErrorCallback
  ): () => void {
    const subscription = { onUpdate, onError };
    const subscriptions = this.projectSubscriptions.get(projectId) ?? new Set<ProjectSubscription>();
    subscriptions.add(subscription);
    this.projectSubscriptions.set(projectId, subscriptions);
    void this.ensureGatewayConnection();
    return () => this.disconnectProjectSubscription(projectId, subscription);
  }

  disconnectFromProject(projectId: string): void {
    this.projectSubscriptions.delete(projectId);
    this.closeIfUnused();
  }

  private disconnectProjectSubscription(projectId: string, subscription: ProjectSubscription): void {
    const subscriptions = this.projectSubscriptions.get(projectId);
    if (!subscriptions) return;
    subscriptions.delete(subscription);
    if (subscriptions.size === 0) {
      this.projectSubscriptions.delete(projectId);
    }
    this.closeIfUnused();
  }

  disconnectAll(): void {
    this.pondSubscriptions.clear();
    this.projectSubscriptions.clear();
    this.manuallyClosed = true;
    this.authenticated = false;
    this.opening = false;
    this.clearTimers();

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      this.socket.close();
    }
    this.socket = null;
  }

  private async ensureGatewayConnection(): Promise<void> {
    if (this.opening) return;
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    if (!this.hasSubscriptions()) return;

    this.opening = true;
    this.manuallyClosed = false;
    this.notifyStatus('connecting');

    try {
      const { token } = await apiService.mintRealtimeToken();
      const socket = new WebSocket(this.gatewayUrl());
      this.socket = socket;

      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'AUTH', token }));
      };

      socket.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      socket.onerror = () => {
        this.notifyError(new Error('WebSocket connection error'));
      };

      socket.onclose = () => {
        this.handleClose();
      };
    } catch (error) {
      this.opening = false;
      this.authenticated = false;
      this.notifyStatus('disconnected');
      this.notifyError(error instanceof Error ? error : new Error('WebSocket connection failed'));
      this.scheduleReconnect();
    }
  }

  private handleMessage(raw: string): void {
    let message: WebSocketMessage;
    try {
      message = JSON.parse(raw) as WebSocketMessage;
    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error);
      return;
    }

    switch (message.type) {
      case 'AUTH_OK':
        this.opening = false;
        this.authenticated = true;
        this.reconnectAttempts = 0;
        this.notifyStatus('connected');
        this.startHeartbeat();
        break;

      case 'AUTH_FAILED':
      case 'ERROR':
      case 'error':
        this.notifyError(new Error(message.reason || message.message || 'Realtime gateway error'));
        break;

      case 'PONG':
      case 'pong':
        break;

      case 'sensor.reading':
        this.dispatchGatewayReading(message);
        break;

      case 'alert':
      case 'alert_resolved':
        this.dispatchProjectFrame(message);
        break;

      default:
        this.dispatchLegacyMessage(message);
    }
  }

  private dispatchGatewayReading(message: WebSocketMessage): void {
    if (!message.pond_id) return;
    const subscription = this.pondSubscriptions.get(message.pond_id);
    if (!subscription) return;

    subscription.onReading({
      type: 'reading',
      timestamp: message.measured_at || message.timestamp || new Date().toISOString(),
      parameters: (message.values || {}) as SensorParameters,
      alerts: [],
    });
  }

  private dispatchLegacyMessage(message: WebSocketMessage): void {
    const pondId = message.pond_id;
    if (!pondId) {
      this.dispatchProjectFrame(message);
      return;
    }
    const subscription = this.pondSubscriptions.get(pondId);
    if (!subscription) return;

    switch (message.type) {
      case 'sensor_reading':
        subscription.onReading({
          type: 'reading',
          timestamp: message.timestamp || new Date().toISOString(),
          parameters: message.readings || {},
          alerts: message.data?.alerts || [],
        });
        break;

      case 'readings':
      case 'connection':
        if (message.latest_readings && message.latest_readings.length > 0) {
          subscription.onReading(this.mapLatestReading(message.latest_readings[0]));
        }
        break;

      default:
        if (message.readings) {
          subscription.onReading({
            type: 'reading',
            timestamp: message.timestamp || new Date().toISOString(),
            parameters: message.readings,
            alerts: [],
          });
        }
    }
  }

  private dispatchProjectFrame(message: WebSocketMessage): void {
    const projectId = message.project_id;
    if (projectId) {
      for (const subscription of this.projectSubscriptions.get(projectId) ?? []) {
        subscription.onUpdate(message);
      }
      return;
    }

    for (const subscriptions of this.projectSubscriptions.values()) {
      for (const subscription of subscriptions) {
        subscription.onUpdate(message);
      }
    }
  }

  private handleClose(): void {
    this.opening = false;
    this.authenticated = false;
    this.clearTimers();
    this.socket = null;
    this.notifyStatus('disconnected');

    if (!this.manuallyClosed && this.hasSubscriptions()) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.manuallyClosed || !this.hasSubscriptions()) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.notifyError(new Error('Connection lost. Please refresh the page.'));
      return;
    }

    const delay = this.reconnectDelay * Math.max(1, this.reconnectAttempts + 1);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectAttempts++;
      void this.ensureGatewayConnection();
    }, delay);
  }

  private startHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = window.setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'PING' }));
      }
    }, this.pingIntervalMs);
  }

  private notifyStatus(status: Status): void {
    for (const subscription of this.pondSubscriptions.values()) {
      subscription.onStatus?.(status);
    }
  }

  private notifyError(error: Error): void {
    for (const subscription of this.pondSubscriptions.values()) {
      subscription.onError?.(error);
    }
    for (const subscriptions of this.projectSubscriptions.values()) {
      for (const subscription of subscriptions) {
        subscription.onError?.(error);
      }
    }
  }

  private closeIfUnused(): void {
    if (!this.hasSubscriptions()) {
      this.disconnectAll();
    }
  }

  private hasSubscriptions(): boolean {
    return this.pondSubscriptions.size > 0 || this.projectSubscriptions.size > 0;
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }

  private gatewayUrl(): string {
    const base = config.wsBaseUrl.replace(/\/+$/, '').replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    return base.endsWith('/ws') ? base : `${base}/ws`;
  }
}

export const websocketService = new WebSocketService();
