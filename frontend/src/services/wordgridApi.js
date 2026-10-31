const WORDGRID_API_BASE_URL = import.meta.env.VITE_WORDGRID_API_BASE_URL || 'http://localhost:8085/api/v1/wordgrid';
export const WORDGRID_WS_URL = import.meta.env.VITE_WORDGRID_WS_URL || 'http://localhost:8085/ws/wordgrid';

export const generateMockRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'WGB-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const getSlotStatesForCount = (playerCount) => {
  const count = Number(playerCount) || 2;
  if (count === 2) {
    return {
      P1: 'ACTIVE',
      P2: 'WAITING',
      P3: 'INACTIVE_SETUP',
      P4: 'INACTIVE_SETUP',
    };
  }
  if (count === 3) {
    return {
      P1: 'ACTIVE',
      P2: 'WAITING',
      P3: 'WAITING',
      P4: 'INACTIVE_SETUP',
    };
  }
  return {
    P1: 'ACTIVE',
    P2: 'WAITING',
    P3: 'WAITING',
    P4: 'WAITING',
  };
};

export const createWordGridRoom = async ({ playerId, playerName, playerCount = 2 }) => {
  const count = Number(playerCount) || 2;
  try {
    const response = await fetch(`${WORDGRID_API_BASE_URL}/rooms/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, playerName, playerCount: count }),
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();
    return data.data || data;
  } catch (err) {
    console.warn('[WordGridAPI] Backend unreachable at /rooms/create, using offline mock fallback:', err.message);
    const roomCode = generateMockRoomCode();
    const sessionId = `OWG_WGB_${Math.floor(10000 + Math.random() * 90000)}`;
    const slotStates = getSlotStatesForCount(count);

    return {
      sessionId,
      roomCode,
      shareableUrl: `/games/wordgrid?room=${roomCode}`,
      assignedSlot: 'P1',
      playerCount: count,
      slotStates,
      players: {
        P1: playerId || 'HOST_PLAYER',
        P2: null,
        P3: null,
        P4: null,
      },
      playerNames: {
        P1: playerName || 'Player 1 (Host)',
        P2: slotStates.P2 === 'WAITING' ? 'Waiting for player...' : 'No Player',
        P3: slotStates.P3 === 'WAITING' ? 'Waiting for player...' : 'No Player',
        P4: slotStates.P4 === 'WAITING' ? 'Waiting for player...' : 'No Player',
      },
      status: 'WAITING_FOR_PLAYERS',
      isOfflineFallback: true,
    };
  }
};

export const joinWordGridRoom = async ({ roomCode, playerId, playerName }) => {
  const cleanCode = (roomCode || 'WGB-DEMO').trim().toUpperCase();
  try {
    const response = await fetch(`${WORDGRID_API_BASE_URL}/rooms/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: cleanCode, playerId, playerName }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status === 'error') {
      const errMsg = data.message || `HTTP error ${response.status}`;
      throw new Error(errMsg);
    }
    return data.data || data;
  } catch (err) {
    const isRoomFullOrStarted = /full|maximum|already|started|completed|not found|cannot join/i.test(err.message || '');
    if (isRoomFullOrStarted) {
      throw err;
    }
    console.warn('[WordGridAPI] Backend unreachable at /rooms/join, using offline mock fallback:', err.message);
    const sessionId = `OWG_WGB_${cleanCode}`;

    return {
      sessionId,
      roomCode: cleanCode,
      assignedSlot: 'P2',
      playerCount: 2,
      slotStates: {
        P1: 'ACTIVE',
        P2: 'ACTIVE',
        P3: 'INACTIVE_SETUP',
        P4: 'INACTIVE_SETUP',
      },
      players: {
        P1: 'HOST_PLAYER',
        P2: playerId || 'GUEST_PLAYER',
        P3: null,
        P4: null,
      },
      playerNames: {
        P1: 'Room Host',
        P2: playerName || 'Guest Player',
        P3: 'No Player',
        P4: 'No Player',
      },
      currentTurn: 'P1',
      status: 'ACTIVE',
      isOfflineFallback: true,
    };
  }
};

export const getWordGridRoomStatus = async (roomCode) => {
  const cleanCode = (roomCode || '').trim().toUpperCase();
  try {
    const response = await fetch(`${WORDGRID_API_BASE_URL}/rooms/${encodeURIComponent(cleanCode)}/status`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();
    return data.data || data;
  } catch (err) {
    console.warn('[WordGridAPI] Backend unreachable at /rooms/status, using offline mock fallback:', err.message);
    return {
      roomCode: cleanCode,
      status: 'WAITING_FOR_PLAYERS',
      playerCount: 2,
      slotStates: {
        P1: 'ACTIVE',
        P2: 'WAITING',
        P3: 'INACTIVE_SETUP',
        P4: 'INACTIVE_SETUP',
      },
      isOfflineFallback: true,
    };
  }
};

export const queueQuickMatch = async ({ playerId, playerName, playerCount = 2 }) => {
  const count = Number(playerCount) || 2;
  try {
    const response = await fetch(`${WORDGRID_API_BASE_URL}/queue/quick-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, playerName, playerCount: count }),
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();
    return data.data || data;
  } catch (err) {
    console.warn('[WordGridAPI] Backend unreachable at /queue/quick-match, using instant matchmaking fallback:', err.message);
    const roomCode = generateMockRoomCode();
    const sessionId = `OWG_QM_${Math.floor(10000 + Math.random() * 90000)}`;
    const slotStates = getSlotStatesForCount(count);

    const activeSlots = ['P1'];
    if (slotStates.P2 === 'WAITING') activeSlots.push('P2');
    if (slotStates.P3 === 'WAITING') activeSlots.push('P3');
    if (slotStates.P4 === 'WAITING') activeSlots.push('P4');

    const fullSlotStates = { ...slotStates };
    const players = { P1: playerId || 'PLAYER_1' };
    const playerNames = { P1: playerName || 'Player 1' };

    const botNames = ['LexiBot [AI]', 'WordMatrix [AI]', 'CipherNeon [AI]', 'NexusGram [AI]'];

    activeSlots.forEach((slot, idx) => {
      fullSlotStates[slot] = 'ACTIVE';
      if (slot !== 'P1') {
        players[slot] = `BOT_${slot}_${Math.floor(100 + Math.random() * 900)}`;
        playerNames[slot] = botNames[(idx - 1) % botNames.length];
      }
    });

    return {
      sessionId,
      roomCode,
      assignedSlot: 'P1',
      playerCount: count,
      slotStates: fullSlotStates,
      players,
      playerNames,
      currentTurn: 'P1',
      status: 'ACTIVE',
      isOfflineFallback: true,
    };
  }
};

export const validateWordApi = async (word) => {
  try {
    const response = await fetch(`${WORDGRID_API_BASE_URL}/validate-word?word=${encodeURIComponent(word.toUpperCase())}`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();
    return data.data || data;
  } catch {
    return null;
  }
};

export const wordgridApi = {
  createWordGridRoom,
  joinWordGridRoom,
  getWordGridRoomStatus,
  queueQuickMatch,
  validateWordApi,
  getSlotStatesForCount,
  generateMockRoomCode,
  WORDGRID_API_BASE_URL,
  WORDGRID_WS_URL,
};

export default wordgridApi;
