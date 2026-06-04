/**
 * Native WebSocket service for Django backend
 * Replaces Socket.IO implementation with native WebSocket
 */

import { config } from '../config/env';
import type { SensorParameters, SensorReading } from '../types';

type ReadingCallback = (data: SensorReading) => void;
type ErrorCallback = (error: Error) => void;
type Status = 'connecting' | 'connected' | 'disconnected';
type StatusCallback = (status: Status) => void;
type MessageType = 'sensor_reading' | 'readings' | 'alert_notification' | 'project_update' | 'connection' | 'pong' | 'error';
type LatestReading = { timestamp?: string } & Partial<SensorParameters> & Record<string, unknown>;
type WebSocketUpdate = Record<string, unknown>;

interface WebSocketMessage {
  type: MessageType;
  data?: { alerts?: SensorReading['alerts'] } & WebSocketUpdate;
  message?: string;
  pond_id?: string;
  sensor_type?: string;
  value?: number;
  unit?: string;
  timestamp?: string;
  readings?: Partial<SensorParameters>;
  latest_readings?: LatestReading[];
}

interface WebSocketConnection {
  socket: WebSocket;
  reconnectAttempts: number;
  reconnectTimer?: number;
  pingInterval?: number;
}

class WebSocketService {
  private connections: Map<string, WebSocketConnection> = new Map();
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000; // 3 seconds
  private pingInterval = 30000; // 30 seconds

  private mapLatestReading(latestReading: LatestReading): SensorReading {
    const { timestamp: _timestamp, ...parameters } = latestReading;
    return {
      type: 'reading',
      timestamp: latestReading.timestamp || new Date().toISOString(),
      parameters: parameters as SensorParameters,
      alerts: [],
    };
  }

  /**
   * Connect to pond's real-time data stream
   */
  connectToPond(
    pondId: string,
    onReading: ReadingCallback,
    onError?: ErrorCallback,
    onStatus?: StatusCallback
  ): () => void {
    const connectionId = `pond_${pondId}`;
    
    // Close existing connection if any
    if (this.connections.has(connectionId)) {
      console.warn(`Already connected to pond ${pondId}, reconnecting...`);
      this.disconnect(connectionId);
    }

    // Authentication via HttpOnly `access_token` cookie — browser sends it
    // automatically on same-site WebSocket upgrades. No token in URL.
    const url = `${config.wsBaseUrl}/ws/ponds/${pondId}`;
    
    if (onStatus) onStatus('connecting');
    
    try {
      const socket = new WebSocket(url);
      const connection: WebSocketConnection = {
        socket,
        reconnectAttempts: 0,
      };
      
      socket.onopen = () => {
        connection.reconnectAttempts = 0;
        if (onStatus) onStatus('connected');
        
        // Start ping to keep connection alive
        connection.pingInterval = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, this.pingInterval);
      };
      
      socket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          // Handle different message types
          switch (message.type) {
            case 'sensor_reading': {
              const reading: SensorReading = {
                type: 'reading',
                timestamp: message.timestamp || new Date().toISOString(),
                parameters: message.readings || {},
                alerts: message.data?.alerts || [],
              };
              onReading(reading);
              break;
            }

            case 'readings':
                if (message.latest_readings && message.latest_readings.length > 0) {
                    onReading(this.mapLatestReading(message.latest_readings[0]));
                }
                break;
              
            case 'connection':
                if (message.latest_readings && message.latest_readings.length > 0) {
                    onReading(this.mapLatestReading(message.latest_readings[0]));
                }
                break;
              
            case 'pong':
              // Keep-alive response, no action needed
              break;
              
            case 'error':
              console.error(`[WebSocket] Server error: ${message.message}`);
              if (onError) onError(new Error(message.message || 'Unknown error'));
              break;
              
            default:
              // Try to parse as reading anyway
              if (message.pond_id || message.readings) {
                const reading: SensorReading = {
                  type: 'reading',
                  timestamp: message.timestamp || new Date().toISOString(),
                  parameters: message.readings || {},
                  alerts: [],
                };
                onReading(reading);
              }
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };
      
      socket.onerror = (error) => {
        console.error(`[WebSocket] Connection error (pond ${pondId}):`, error);
        if (onError) onError(new Error('WebSocket connection error'));
        if (onStatus) onStatus('disconnected');
      };
      
      socket.onclose = () => {
        if (onStatus) onStatus('disconnected');
        
        // Clear ping interval
        if (connection.pingInterval) {
          clearInterval(connection.pingInterval);
        }
        
        // Attempt reconnection
        if (connection.reconnectAttempts < this.maxReconnectAttempts) {
          connection.reconnectTimer = window.setTimeout(() => {
            connection.reconnectAttempts++;
            this.connectToPond(pondId, onReading, onError, onStatus);
          }, this.reconnectDelay);
        } else {
          console.error(`[WebSocket] Max reconnection attempts reached for pond ${pondId}`);
          if (onError) onError(new Error('Connection lost. Please refresh the page.'));
        }
      };
      
      this.connections.set(connectionId, connection);
      
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
      if (onError) onError(error as Error);
      if (onStatus) onStatus('disconnected');
    }
    
    return () => this.disconnectFromPond(pondId);
  }

  disconnectFromPond(pondId: string): void {
    this.disconnect(`pond_${pondId}`);
  }

  /**
   * Check if a connection exists
   */
  isConnected(connectionId: string): boolean {
    return this.connections.has(connectionId);
  }

  /**
   * Connect to project-level updates
   */
  connectToProject(
    projectId: string,
    onUpdate: (data: WebSocketUpdate | WebSocketMessage) => void,
    onError?: ErrorCallback
  ): () => void {
    const connectionId = `project_${projectId}`;
    
    // Close existing connection if any
    if (this.connections.has(connectionId)) {
      console.warn(`Already connected to project ${projectId}, reconnecting...`);
      this.disconnect(connectionId);
    }

    // Authentication via HttpOnly `access_token` cookie — see comment in
    // connectToPond.
    const url = `${config.wsBaseUrl}/ws/projects`;

    try {
      const socket = new WebSocket(url);
      const connection: WebSocketConnection = {
        socket,
        reconnectAttempts: 0,
      };
      
      socket.onopen = () => {
        connection.reconnectAttempts = 0;
        
        // Start ping to keep connection alive
        connection.pingInterval = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, this.pingInterval);
      };
      
      socket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'project_update':
            case 'alert_notification':
              onUpdate(message.data || message);
              break;
              
            case 'connection':
              break;
              
            case 'pong':
              // Keep-alive response
              break;
              
            case 'error':
              console.error(`[WebSocket] Server error: ${message.message}`);
              if (onError) onError(new Error(message.message || 'Unknown error'));
              break;
              
            default:
              // Pass through any update
              onUpdate(message.data || message);
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };
      
      socket.onerror = (error) => {
        console.error(`[WebSocket] Connection error (project ${projectId}):`, error);
        if (onError) onError(new Error('WebSocket connection error'));
      };
      
      socket.onclose = () => {
        // Clear ping interval
        if (connection.pingInterval) {
          clearInterval(connection.pingInterval);
        }
        
        // Attempt reconnection
        if (connection.reconnectAttempts < this.maxReconnectAttempts) {
          connection.reconnectTimer = window.setTimeout(() => {
            connection.reconnectAttempts++;
            this.connectToProject(projectId, onUpdate, onError);
          }, this.reconnectDelay);
        } else {
          console.error(`[WebSocket] Max reconnection attempts reached for project ${projectId}`);
          if (onError) onError(new Error('Connection lost. Please refresh the page.'));
        }
      };
      
      this.connections.set(connectionId, connection);
      
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
      if (onError) onError(error as Error);
    }
    
    return () => this.disconnectFromProject(projectId);
  }

  disconnectFromProject(projectId: string): void {
    this.disconnect(`project_${projectId}`);
  }

  /**
   * Disconnect a specific connection
   */
  private disconnect(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    // Clear timers
    if (connection.reconnectTimer) {
      clearTimeout(connection.reconnectTimer);
    }
    if (connection.pingInterval) {
      clearInterval(connection.pingInterval);
    }
    
    // Close socket
    if (connection.socket.readyState === WebSocket.OPEN || 
        connection.socket.readyState === WebSocket.CONNECTING) {
      connection.socket.close();
    }
    
    this.connections.delete(connectionId);
  }

  /**
   * Disconnect all sockets (call on logout)
   */
  disconnectAll(): void {
    const connectionIds = Array.from(this.connections.keys());
    connectionIds.forEach(id => this.disconnect(id));
  }
}

export const websocketService = new WebSocketService();
