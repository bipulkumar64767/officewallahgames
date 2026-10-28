const CONNECTDROP_API_BASE_URL =
  import.meta.env.VITE_CONNECTDROP_API_BASE_URL || 'http://localhost:8086/api/v1/connectdrop';
export const CONNECTDROP_WS_URL =
  import.meta.env.VITE_CONNECTDROP_WS_URL || 'http://localhost:8086/ws/connectdrop';

export const CONNECT_DROP_ROWS = 6;
export const CONNECT_DROP_COLS = 7;

export const generateMockRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CND-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const createEmptyGrid = () =>
  Array(CONNECT_DROP_ROWS)
    .fill(null)
    .map(() => Array(CONNECT_DROP_COLS).fill(null));

export const findDropRow = (grid, col) => {
  if (col < 0 || col >= CONNECT_DROP_COLS) return -1;
  for (let r = CONNECT_DROP_ROWS - 1; r >= 0; r--) {
    if (!grid[r][col]) {
      return r;
    }
  }
  return -1;
};

export const checkConnectDropWinner = (grid) => {
  // Horizontal check
  for (let r = 0; r < CONNECT_DROP_ROWS; r++) {
    for (let c = 0; c <= CONNECT_DROP_COLS - 4; c++) {
      const color = grid[r][c];
      if (
        color &&
        color === grid[r][c + 1] &&
        color === grid[r][c + 2] &&
        color === grid[r][c + 3]
      ) {
        return {
          winner: color,
          winningCells: [
            [r, c],
            [r, c + 1],
            [r, c + 2],
            [r, c + 3],
          ],
        };
      }
    }
  }

  // Vertical check
  for (let r = 0; r <= CONNECT_DROP_ROWS - 4; r++) {
    for (let c = 0; c < CONNECT_DROP_COLS; c++) {
      const color = grid[r][c];
      if (
        color &&
        color === grid[r + 1][c] &&
        color === grid[r + 2][c] &&
        color === grid[r + 3][c]
      ) {
        return {
          winner: color,
          winningCells: [
            [r, c],
            [r + 1, c],
            [r + 2, c],
            [r + 3, c],
          ],
        };
      }
    }
  }

  // Diagonal down-right (\)
  for (let r = 0; r <= CONNECT_DROP_ROWS - 4; r++) {
    for (let c = 0; c <= CONNECT_DROP_COLS - 4; c++) {
      const color = grid[r][c];
      if (
        color &&
        color === grid[r + 1][c + 1] &&
        color === grid[r + 2][c + 2] &&
        color === grid[r + 3][c + 3]
      ) {
        return {
          winner: color,
          winningCells: [
            [r, c],
            [r + 1, c + 1],
            [r + 2, c + 2],
            [r + 3, c + 3],
          ],
        };
      }
    }
  }

  // Diagonal up-right (/)
  for (let r = 3; r < CONNECT_DROP_ROWS; r++) {
    for (let c = 0; c <= CONNECT_DROP_COLS - 4; c++) {
      const color = grid[r][c];
      if (
        color &&
        color === grid[r - 1][c + 1] &&
        color === grid[r - 2][c + 2] &&
        color === grid[r - 3][c + 3]
      ) {
        return {
          winner: color,
          winningCells: [
            [r, c],
            [r - 1, c + 1],
            [r - 2, c + 2],
            [r - 3, c + 3],
          ],
        };
      }
    }
  }

  // Draw check
  const isDraw = grid[0].every((cell) => cell !== null);
  if (isDraw) {
    return {
      winner: 'DRAW',
      winningCells: null,
    };
  }

  return null;
};

export const computeBestConnectDropMove = (grid, aiColor = 'YELLOW') => {
  const opponentColor = aiColor === 'RED' ? 'YELLOW' : 'RED';

  const availableCols = [];
  for (let c = 0; c < CONNECT_DROP_COLS; c++) {
    if (findDropRow(grid, c) !== -1) {
      availableCols.push(c);
    }
  }
  if (availableCols.length === 0) return -1;

  // 1. Immediate Win
  for (const c of availableCols) {
    const r = findDropRow(grid, c);
    const testGrid = grid.map((row) => [...row]);
    testGrid[r][c] = aiColor;
    const outcome = checkConnectDropWinner(testGrid);
    if (outcome && outcome.winner === aiColor) {
      return c;
    }
  }

  // 2. Immediate Block
  for (const c of availableCols) {
    const r = findDropRow(grid, c);
    const testGrid = grid.map((row) => [...row]);
    testGrid[r][c] = opponentColor;
    const outcome = checkConnectDropWinner(testGrid);
    if (outcome && outcome.winner === opponentColor) {
      return c;
    }
  }

  // 3. Avoid setting up opponent win above our drop
  const safeCols = availableCols.filter((c) => {
    const r = findDropRow(grid, c);
    if (r <= 0) return true;
    const testGrid = grid.map((row) => [...row]);
    testGrid[r][c] = aiColor;
    testGrid[r - 1][c] = opponentColor;
    const outcome = checkConnectDropWinner(testGrid);
    return !(outcome && outcome.winner === opponentColor);
  });

  const candidates = safeCols.length > 0 ? safeCols : availableCols;

  // 4. Strategic column priority
  const preferenceOrder = [3, 2, 4, 1, 5, 0, 6];
  for (const preferredCol of preferenceOrder) {
    if (candidates.includes(preferredCol)) {
      return preferredCol;
    }
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
};

export const createConnectDropRoom = async ({ playerId, playerName }) => {
  try {
    const response = await fetch(`${CONNECTDROP_API_BASE_URL}/rooms/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, playerName }),
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();
    return data.data || data;
  } catch (err) {
    console.warn(
      '[ConnectDropAPI] Backend unreachable at /rooms/create, using offline mock fallback:',
      err.message
    );
    const roomCode = generateMockRoomCode();
    const sessionId = `OWG_CND_${Math.floor(10000 + Math.random() * 90000)}`;

    return {
      sessionId,
      roomCode,
      shareableUrl: `/games/connectdrop?room=${roomCode}`,
      assignedColor: 'RED',
      status: 'WAITING_FOR_OPPONENT',
      playerRed: playerId || 'GUEST_LOCAL',
      playerRedName: playerName || 'Host Player',
      playerYellow: null,
      playerYellowName: 'Waiting for opponent...',
      currentTurn: 'RED',
      isOfflineFallback: true,
    };
  }
};

export const joinConnectDropRoom = async ({ roomCode, playerId, playerName }) => {
  const cleanCode = (roomCode || 'CND-DEMO').trim().toUpperCase();
  try {
    const response = await fetch(`${CONNECTDROP_API_BASE_URL}/rooms/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: cleanCode, playerId, playerName }),
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();
    return data.data || data;
  } catch (err) {
    console.warn(
      '[ConnectDropAPI] Backend unreachable at /rooms/join, using offline mock fallback:',
      err.message
    );
    const sessionId = `OWG_CND_${Math.floor(10000 + Math.random() * 90000)}`;

    return {
      sessionId,
      roomCode: cleanCode,
      assignedColor: 'YELLOW',
      status: 'ACTIVE',
      playerRed: 'HOST_OPPONENT',
      playerRedName: 'Host Opponent',
      playerYellow: playerId || 'GUEST_LOCAL',
      playerYellowName: playerName || 'Guest Challenger',
      currentTurn: 'RED',
      isOfflineFallback: true,
    };
  }
};

export const getConnectDropRoomStatus = async (roomCode) => {
  const cleanCode = (roomCode || '').trim().toUpperCase();
  try {
    const response = await fetch(
      `${CONNECTDROP_API_BASE_URL}/rooms/${encodeURIComponent(cleanCode)}/status`
    );
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();
    return data.data || data;
  } catch (err) {
    console.warn(
      '[ConnectDropAPI] Backend unreachable at /rooms/status, using offline mock fallback:',
      err.message
    );
    return {
      roomCode: cleanCode,
      status: 'WAITING_FOR_OPPONENT',
      isOfflineFallback: true,
    };
  }
};

export const queueQuickMatch = async ({ playerId, playerName }) => {
  try {
    const response = await fetch(`${CONNECTDROP_API_BASE_URL}/queue/quick-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, playerName }),
    });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();
    return data.data || data;
  } catch (err) {
    console.warn(
      '[ConnectDropAPI] Backend unreachable at /queue/quick-match, using instant matchmaking fallback:',
      err.message
    );
    const roomCode = generateMockRoomCode();
    const sessionId = `OWG_QM_CND_${Math.floor(10000 + Math.random() * 90000)}`;
    const assignedColor = Math.random() > 0.5 ? 'RED' : 'YELLOW';

    return {
      sessionId,
      roomCode,
      assignedColor,
      status: 'ACTIVE',
      playerRed: assignedColor === 'RED' ? playerId || 'GUEST_LOCAL' : 'NET_CYBER_RED',
      playerRedName: assignedColor === 'RED' ? playerName || 'Player' : 'CyberViper',
      playerYellow: assignedColor === 'YELLOW' ? playerId || 'GUEST_LOCAL' : 'NET_NEON_YELLOW',
      playerYellowName: assignedColor === 'YELLOW' ? playerName || 'Player' : 'NeonStriker',
      currentTurn: 'RED',
      isOfflineFallback: true,
    };
  }
};

export const connectdropApi = {
  createConnectDropRoom,
  joinConnectDropRoom,
  getConnectDropRoomStatus,
  queueQuickMatch,
  createRoom: createConnectDropRoom,
  joinRoom: joinConnectDropRoom,
  getRoomStatus: getConnectDropRoomStatus,
  quickMatch: queueQuickMatch,
};

export default connectdropApi;
