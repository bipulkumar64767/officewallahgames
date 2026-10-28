import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { CONNECTDROP_WS_URL } from './connectdropApi';

export class ConnectDropSocketManager {
  constructor() {
    this.client = null;
    this.subscription = null;
    this.isConnected = false;
  }

  /**
   * Connect to the Connect Drop WebSocket topic for a given session.
   * Supports both parameter styles:
   *   connect(sessionId, onEvent, onError)
   *   connect({ sessionId, onEvent, onConnect, onError })
   */
  connect(param1, param2, param3) {
    this.disconnect();

    let sessionId;
    let onEvent;
    let onConnect;
    let onError;

    if (typeof param1 === 'object' && param1 !== null) {
      sessionId = param1.sessionId;
      onEvent = param1.onEvent || param1.onMessage;
      onConnect = param1.onConnect;
      onError = param1.onError;
    } else {
      sessionId = param1;
      onEvent = param2;
      onError = param3;
    }

    try {
      this.client = new Client({
        webSocketFactory: () => new SockJS(CONNECTDROP_WS_URL),
        reconnectDelay: 4000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        debug: () => {},
        onConnect: () => {
          this.isConnected = true;
          if (sessionId) {
            this.subscription = this.client.subscribe(
              `/topic/connectdrop/${sessionId}`,
              (frame) => {
                try {
                  const payload = JSON.parse(frame.body);
                  if (onEvent) onEvent(payload);
                } catch (e) {
                  console.error('[ConnectDropWS] Failed to parse frame body:', e);
                }
              }
            );
          }
          if (onConnect) onConnect();
        },
        onStompError: (frame) => {
          console.warn('[ConnectDropWS] STOMP error frame:', frame);
          if (onError) onError(new Error(frame.headers['message'] || 'STOMP error'));
        },
        onWebSocketClose: () => {
          this.isConnected = false;
        },
      });

      this.client.activate();
    } catch (err) {
      console.warn('[ConnectDropWS] WebSocket activation failed:', err.message);
      if (onError) onError(err);
    }
  }

  /**
   * Drop a disc into a column
   */
  dropDisc(sessionId, playerId, column) {
    if (!this.client || !this.isConnected) {
      return false;
    }
    this.client.publish({
      destination: `/app/connectdrop/${sessionId}/drop`,
      body: JSON.stringify({ playerId, column: Number(column) }),
    });
    return true;
  }

  /**
   * Request a rematch
   */
  requestRematch(sessionId, playerId) {
    if (!this.client || !this.isConnected) {
      return false;
    }
    this.client.publish({
      destination: `/app/connectdrop/${sessionId}/rematch`,
      body: JSON.stringify({ playerId }),
    });
    return true;
  }

  /**
   * Disconnect STOMP and SockJS
   */
  disconnect() {
    if (this.subscription) {
      try {
        this.subscription.unsubscribe();
      } catch {
        // Ignore
      }
      this.subscription = null;
    }
    if (this.client) {
      try {
        this.client.deactivate();
      } catch {
        // Ignore
      }
      this.client = null;
    }
    this.isConnected = false;
  }
}

export const connectdropSocket = new ConnectDropSocketManager();
export default connectdropSocket;
