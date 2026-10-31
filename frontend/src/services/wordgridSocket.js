import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { WORDGRID_WS_URL } from './wordgridApi';

export class WordGridSocketManager {
  constructor() {
    this.client = null;
    this.subscription = null;
    this.isConnected = false;
  }

  /**
   * Connect to the Word Grid WebSocket topic for a given session.
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
        webSocketFactory: () => new SockJS(WORDGRID_WS_URL),
        reconnectDelay: 4000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        debug: () => {},
        onConnect: () => {
          this.isConnected = true;
          if (sessionId) {
            this.subscription = this.client.subscribe(`/topic/wordgrid/${sessionId}`, (frame) => {
              try {
                const payload = JSON.parse(frame.body);
                if (onEvent) onEvent(payload);
              } catch (e) {
                console.error('[WordGridWS] Failed to parse frame body:', e);
              }
            });
          }
          if (onConnect) onConnect();
        },
        onStompError: (frame) => {
          console.warn('[WordGridWS] STOMP error frame:', frame);
          if (onError) onError(new Error(frame.headers['message'] || 'STOMP error'));
        },
        onWebSocketClose: () => {
          this.isConnected = false;
        },
      });

      this.client.activate();
    } catch (err) {
      console.warn('[WordGridWS] WebSocket activation failed:', err.message);
      if (onError) onError(err);
    }
  }

  /**
   * Place an uppercase letter on a specific grid cell.
   */
  placeLetter(sessionId, playerId, color, row, col, letter) {
    if (!this.client || !this.isConnected) {
      return false;
    }
    this.client.publish({
      destination: `/app/wordgrid/${sessionId}/place-letter`,
      body: JSON.stringify({ playerId, color, row, col, letter: String(letter).toUpperCase() }),
    });
    return true;
  }

  /**
   * Claim or submit a traced word path on the grid.
   * cells / path is an array of objects: [{ row, col }, ...]
   */
  claimWord(sessionId, playerId, color, path) {
    if (!this.client || !this.isConnected) {
      return false;
    }
    const cells = Array.isArray(path) ? path : [];
    this.client.publish({
      destination: `/app/wordgrid/${sessionId}/draw-word`,
      body: JSON.stringify({ playerId, color, cells, path: cells }),
    });
    return true;
  }

  /**
   * Confirm word claim from popup.
   */
  confirmWord(sessionId, playerId, confirmed = true) {
    if (!this.client || !this.isConnected) {
      return false;
    }
    this.client.publish({
      destination: `/app/wordgrid/${sessionId}/confirm-word`,
      body: JSON.stringify({ playerId, confirmed }),
    });
    return true;
  }

  /**
   * Fast proceed or pass turn.
   */
  passTurn(sessionId, playerId, color) {
    if (!this.client || !this.isConnected) {
      return false;
    }
    this.client.publish({
      destination: `/app/wordgrid/${sessionId}/fast-proceed`,
      body: JSON.stringify({ playerId, color }),
    });
    return true;
  }

  fastProceed(sessionId, playerId) {
    return this.passTurn(sessionId, playerId);
  }

  proposeEnd(sessionId, playerId) {
    if (!this.client || !this.isConnected) {
      return false;
    }
    this.client.publish({
      destination: `/app/wordgrid/${sessionId}/propose-end`,
      body: JSON.stringify({ playerId }),
    });
    return true;
  }

  voteEnd(sessionId, playerId, vote = true) {
    if (!this.client || !this.isConnected) {
      return false;
    }
    this.client.publish({
      destination: `/app/wordgrid/${sessionId}/vote-end`,
      body: JSON.stringify({ playerId, vote }),
    });
    return true;
  }

  /**
   * Room event helpers for waiting room & real-time sync
   */
  sendRoomEvent(sessionId, event) {
    if (!this.client || !this.isConnected) {
      return false;
    }
    this.client.publish({
      destination: `/topic/wordgrid/${sessionId}`,
      body: JSON.stringify(event),
    });
    return true;
  }

  sendPlayerReady(sessionId, playerId, slot, isReady) {
    return this.sendRoomEvent(sessionId, {
      type: 'PLAYER_READY',
      playerId,
      slot,
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
        // ignore
      }
      this.subscription = null;
    }
    if (this.client) {
      try {
        this.client.deactivate();
      } catch {
        // ignore
      }
      this.client = null;
    }
    this.isConnected = false;
  }
}

export const wordgridSocket = new WordGridSocketManager();
export default wordgridSocket;
