const LUDO_API_BASE_URL = import.meta.env.VITE_LUDO_API_BASE_URL || 'http://localhost:8084/api/v1/ludo';
export const LUDO_WS_URL = import.meta.env.VITE_LUDO_WS_URL || 'http://localhost:8084/ws/ludo';

export const generateMockRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'LDO-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const getSlotStatesForCount = (playerCount) => {
  const count = Number(playerCount) || 2;
  if (count === 2) {
    return {
      RED: 'ACTIVE',
      GREEN: 'INACTIVE_SETUP',
      YELLOW: 'WAITING',
      BLUE: 'INACTIVE_SETUP',
    };
  }
  if (count === 3) {
    return {
      RED: 'ACTIVE',
      GREEN: 'WAITING',
      YELLOW: 'WAITING',
      BLUE: 'INACTIVE_SETUP',
    };
  }
  return {
    RED: 'ACTIVE',
    GREEN: 'WAITING',
    YELLOW: 'WAITING',
    BLUE: 'WAITING',
  };
};

export const createLudoRoom = async ({ playerId, playerName, playerCount = 2 }) => {
  try {
    const response = await fetch(`${LUDO_API_BASE_URL}/rooms/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, playerName, playerCount }),
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();
    return data.data || data;
  } catch (err) {
    console.warn('[LudoAPI] Backend unreachable at /rooms/create, using offline mock fallback:', err.message);
    const roomCode = generateMockRoomCode();
    const sessionId = `OWG_LDO_${Math.floor(10000 + Math.random() * 90000)}`;
    const slotStates = getSlotStatesForCount(playerCount);

    return {
      sessionId,
      roomCode,
      shareableUrl: `/games/ludo?room=${roomCode}`,
      assignedColor: 'RED',
      playerCount,
      slotStates,
      players: {
        RED: playerId || 'HOST_PLAYER',
        GREEN: null,
        YELLOW: null,
        BLUE: null,
      },
      playerNames: {
        RED: playerName || 'Player (Host)',
        GREEN: slotStates.GREEN === 'WAITING' ? 'Waiting for player...' : 'No Player',
        YELLOW: slotStates.YELLOW === 'WAITING' ? 'Waiting for player...' : 'No Player',
        BLUE: slotStates.BLUE === 'WAITING' ? 'Waiting for player...' : 'No Player',
      },
      status: 'WAITING_FOR_PLAYERS',
      isOfflineFallback: true,
    };
  }
};

export const joinLudoRoom = async ({ roomCode, playerId, playerName }) => {
  const cleanCode = (roomCode || 'LDO-DEMO').trim().toUpperCase();
  try {
    const response = await fetch(`${LUDO_API_BASE_URL}/rooms/join`, {
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
    console.warn('[LudoAPI] Backend unreachable at /rooms/join, using offline mock fallback:', err.message);
    const sessionId = `OWG_LDO_${cleanCode}`;

    return {
      sessionId,
      roomCode: cleanCode,
      assignedColor: 'YELLOW',
      playerCount: 2,
      slotStates: {
        RED: 'ACTIVE',
        GREEN: 'INACTIVE_SETUP',
        YELLOW: 'ACTIVE',
        BLUE: 'INACTIVE_SETUP',
      },
      players: {
        RED: 'HOST_PLAYER',
        YELLOW: playerId || 'GUEST_PLAYER',
        GREEN: null,
        BLUE: null,
      },
      playerNames: {
        RED: 'Room Host',
        YELLOW: playerName || 'Guest Player',
        GREEN: 'No Player',
        BLUE: 'No Player',
      },
      currentTurn: 'RED',
      status: 'ACTIVE',
      isOfflineFallback: true,
    };
  }
};

export const getLudoRoomStatus = async (roomCode) => {
  const cleanCode = (roomCode || '').trim().toUpperCase();
  try {
    const response = await fetch(`${LUDO_API_BASE_URL}/rooms/${encodeURIComponent(cleanCode)}/status`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();
    return data.data || data;
  } catch (err) {
    console.warn('[LudoAPI] Backend unreachable at /rooms/status, using offline mock fallback:', err.message);
    return {
      roomCode: cleanCode,
      status: 'WAITING_FOR_PLAYERS',
      playerCount: 2,
      slotStates: {
        RED: 'ACTIVE',
        GREEN: 'INACTIVE_SETUP',
        YELLOW: 'WAITING',
        BLUE: 'INACTIVE_SETUP',
      },
      isOfflineFallback: true,
    };
  }
};

export const queueQuickMatch = async ({ playerId, playerName, playerCount = 2 }) => {
  try {
    const response = await fetch(`${LUDO_API_BASE_URL}/queue/quick-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, playerName, playerCount }),
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();
    return data.data || data;
  } catch (err) {
    console.warn('[LudoAPI] Backend unreachable at /queue/quick-match, using instant matchmaking fallback:', err.message);
    const roomCode = generateMockRoomCode();
    const sessionId = `OWG_QM_${Math.floor(10000 + Math.random() * 90000)}`;
    const slotStates = getSlotStatesForCount(playerCount);

    const activeColors = ['RED'];
    if (slotStates.YELLOW === 'WAITING') activeColors.push('YELLOW');
    if (slotStates.GREEN === 'WAITING') activeColors.push('GREEN');
    if (slotStates.BLUE === 'WAITING') activeColors.push('BLUE');

    // In instant quick match fallback, activate all needed slots with simulated bot opponents
    const fullSlotStates = { ...slotStates };
    const players = { RED: playerId };
    const playerNames = { RED: playerName || 'Player' };

    activeColors.forEach((color, idx) => {
      fullSlotStates[color] = 'ACTIVE';
      if (color !== 'RED') {
        const botNames = ['CyberNeon', 'GridMaster', 'VaporBlade', 'NexusRunner'];
        players[color] = `BOT_${color}_${Math.floor(100 + Math.random() * 900)}`;
        playerNames[color] = botNames[idx % botNames.length] + ` [AI]`;
      }
    });

    return {
      sessionId,
      roomCode,
      assignedColor: 'RED',
      playerCount,
      slotStates: fullSlotStates,
      players,
      playerNames,
      currentTurn: 'RED',
      status: 'ACTIVE',
      isOfflineFallback: true,
    };
  }
};

export const ludoApi = {
  createLudoRoom,
  joinLudoRoom,
  getLudoRoomStatus,
  queueQuickMatch,
  getSlotStatesForCount,
  generateMockRoomCode,
  LUDO_API_BASE_URL,
  LUDO_WS_URL,
};

export default ludoApi;
