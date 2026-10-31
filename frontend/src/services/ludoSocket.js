import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { LUDO_WS_URL } from './ludoApi';

export class LudoSocketManager {
  constructor() {
    this.client = null;
    this.subscription = null;
    this.isConnected = false;
  }

  /**
   * Connect to the Ludo WebSocket topic for a given session.
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
        webSocketFactory: () => new SockJS(LUDO_WS_URL),
        reconnectDelay: 4000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        debug: () => {},
        onConnect: () => {
          this.isConnected = true;
          if (sessionId) {
            this.subscription = this.client.subscribe(`/topic/ludo/${sessionId}`, (frame) => {
              try {
                const payload = JSON.parse(frame.body);
                if (onEvent) onEvent(payload);
              } catch (e) {
                console.error('[LudoWS] Failed to parse frame body:', e);
              }
            });
          }
          if (onConnect) onConnect();
        },
        onStompError: (frame) => {
          console.warn('[LudoWS] STOMP error frame:', frame);
          if (onError) onError(new Error(frame.headers['message'] || 'STOMP error'));
        },
        onWebSocketClose: () => {
          this.isConnected = false;
        },
      });

      this.client.activate();
    } catch (err) {
      console.warn('[LudoWS] WebSocket activation failed:', err.message);
      if (onError) onError(err);
    }
  }

  rollDice(sessionId, playerId, color) {
    if (!this.client || !this.isConnected) {
      return false;
    }
    this.client.publish({
      destination: `/app/ludo/${sessionId}/roll`,
      body: JSON.stringify({ playerId, color }),
    });
    return true;
  }

  moveToken(sessionId, playerId, color, tokenId) {
    if (!this.client || !this.isConnected) {
      return false;
    }
    this.client.publish({
      destination: `/app/ludo/${sessionId}/move`,
      body: JSON.stringify({ playerId, color, tokenId }),
    });
    return true;
  }

  sendRoomEvent(sessionId, event) {
    if (!this.client || !this.isConnected) {
      return false;
    }
    this.client.publish({
      destination: `/topic/ludo/${sessionId}`,
      body: JSON.stringify(event),
    });
    return true;
  }

  sendPlayerReady(sessionId, playerId, color, isReady) {
    return this.sendRoomEvent(sessionId, {
      type: 'PLAYER_READY',
      playerId,
      color,
      isReady,
    });
  }

  sendStartMatch(sessionId) {
    return this.sendRoomEvent(sessionId, {
      type: 'START_MATCH',
      timestamp: Date.now(),
    });
  }

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

export const ludoSocket = new LudoSocketManager();
export default ludoSocket;
