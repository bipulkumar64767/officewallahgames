import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { TTT_WS_URL } from './tictactoeApi';

export class TicTacToeSocketManager {
  constructor() {
    this.client = null;
    this.subscription = null;
    this.isConnected = false;
  }

  connect({ sessionId, onMessage, onConnect, onError }) {
    this.disconnect();

    try {
      this.client = new Client({
        webSocketFactory: () => new SockJS(TTT_WS_URL),
        reconnectDelay: 4000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        debug: () => {},
        onConnect: () => {
          this.isConnected = true;
          if (sessionId) {
            this.subscription = this.client.subscribe(`/topic/game/${sessionId}`, (frame) => {
              try {
                const payload = JSON.parse(frame.body);
                if (onMessage) onMessage(payload);
              } catch (e) {
                console.error('[TicTacToeWS] Failed to parse frame body:', e);
              }
            });
          }
          if (onConnect) onConnect();
        },
        onStompError: (frame) => {
          console.warn('[TicTacToeWS] STOMP error frame:', frame);
          if (onError) onError(new Error(frame.headers['message'] || 'STOMP error'));
        },
        onWebSocketClose: () => {
          this.isConnected = false;
        },
      });

      this.client.activate();
    } catch (err) {
      console.warn('[TicTacToeWS] WebSocket activation failed:', err.message);
      if (onError) onError(err);
    }
  }

  sendMove(sessionId, playerId, position, symbol) {
    if (!this.client || !this.isConnected) {
      return false;
    }
    this.client.publish({
      destination: `/app/game/${sessionId}/move`,
      body: JSON.stringify({ playerId, position, symbol }),
    });
    return true;
  }

  sendRoomEvent(sessionId, event) {
    if (!this.client || !this.isConnected) {
      return false;
    }
    this.client.publish({
      destination: `/topic/game/${sessionId}`,
      body: JSON.stringify(event),
    });
    return true;
  }

  sendPlayerReady(sessionId, playerId, symbol, isReady) {
    return this.sendRoomEvent(sessionId, {
      type: 'PLAYER_READY',
      playerId,
      symbol,
      isReady,
    });
  }

  sendStartMatch(sessionId) {
    return this.sendRoomEvent(sessionId, {
      type: 'START_MATCH',
      timestamp: Date.now(),
    });
  }

  requestRematch(sessionId, playerId, symbol) {
    if (!this.client || !this.isConnected) {
      return false;
    }
    this.client.publish({
      destination: `/app/game/${sessionId}/rematch`,
      body: JSON.stringify({ playerId, symbol }),
    });
    return true;
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

export const tictactoeSocket = new TicTacToeSocketManager();
export default tictactoeSocket;
