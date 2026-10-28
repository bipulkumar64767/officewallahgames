const TTT_API_BASE_URL = import.meta.env.VITE_TTT_API_BASE_URL || 'http://localhost:8083/api/v1/tictactoe';
export const TTT_WS_URL = import.meta.env.VITE_TTT_WS_URL || 'http://localhost:8083/ws/tictactoe';

const generateMockRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'TTT-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const tictactoeApi = {
  createRoom: async (playerId, playerName) => {
    try {
      const response = await fetch(`${TTT_API_BASE_URL}/rooms/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, playerName }),
      });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();
      return data.data || data;
    } catch (err) {
      console.warn('[TicTacToe] Backend unreachable at /rooms/create, using offline mock fallback:', err.message);
      const roomCode = generateMockRoomCode();
      const sessionId = `OWG_TTT_${Math.floor(10000 + Math.random() * 90000)}`;
      return {
        sessionId,
        roomCode,
        shareableUrl: `/games/tictactoe?room=${roomCode}`,
        assignedSymbol: 'X',
        status: 'WAITING_FOR_OPPONENT',
        playerX: playerId,
        playerXName: playerName || 'Host Player',
        isOfflineFallback: true,
      };
    }
  },

  joinRoom: async (roomCode, playerId, playerName) => {
    try {
      const response = await fetch(`${TTT_API_BASE_URL}/rooms/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: roomCode.trim().toUpperCase(), playerId, playerName }),
      });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();
      return data.data || data;
    } catch (err) {
      console.warn('[TicTacToe] Backend unreachable at /rooms/join, using offline mock fallback:', err.message);
      const cleanCode = (roomCode || 'TTT-DEMO').trim().toUpperCase();
      const sessionId = `OWG_TTT_${Math.floor(10000 + Math.random() * 90000)}`;
      return {
        sessionId,
        roomCode: cleanCode,
        assignedSymbol: 'O',
        status: 'ACTIVE',
        playerX: 'HOST_OPPONENT',
        playerXName: 'Host Opponent',
        playerO: playerId,
        playerOName: playerName || 'Guest Player',
        currentTurn: 'X',
        isOfflineFallback: true,
      };
    }
  },

  getRoomStatus: async (roomCode) => {
    try {
      const cleanCode = roomCode.trim().toUpperCase();
      const response = await fetch(`${TTT_API_BASE_URL}/rooms/${encodeURIComponent(cleanCode)}/status`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();
      return data.data || data;
    } catch (err) {
      console.warn('[TicTacToe] Backend unreachable at /rooms/status, using offline mock fallback:', err.message);
      return {
        roomCode: roomCode.trim().toUpperCase(),
        status: 'WAITING_FOR_OPPONENT',
        isOfflineFallback: true,
      };
    }
  },

  quickMatch: async (playerId, playerName) => {
    try {
      const response = await fetch(`${TTT_API_BASE_URL}/queue/quick-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, playerName }),
      });
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();
      return data.data || data;
    } catch (err) {
      console.warn('[TicTacToe] Backend unreachable at /queue/quick-match, using instant matchmaking fallback:', err.message);
      const roomCode = generateMockRoomCode();
      const sessionId = `OWG_QM_${Math.floor(10000 + Math.random() * 90000)}`;
      const assignedSymbol = Math.random() > 0.5 ? 'X' : 'O';
      return {
        sessionId,
        roomCode,
        assignedSymbol,
        status: 'ACTIVE',
        playerX: assignedSymbol === 'X' ? playerId : 'NET_CHALLENGER_99',
        playerXName: assignedSymbol === 'X' ? (playerName || 'Player') : 'CyberNinja',
        playerO: assignedSymbol === 'O' ? playerId : 'NET_CHALLENGER_99',
        playerOName: assignedSymbol === 'O' ? (playerName || 'Player') : 'NeonStriker',
        currentTurn: 'X',
        isOfflineFallback: true,
      };
    }
  },
};

export const WINNING_COMBINATIONS = [
  [0, 1, 2], // Row 0
  [3, 4, 5], // Row 1
  [6, 7, 8], // Row 2
  [0, 3, 6], // Col 0
  [1, 4, 7], // Col 1
  [2, 5, 8], // Col 2
  [0, 4, 8], // Diagonal top-left to bottom-right
  [2, 4, 6], // Diagonal top-right to bottom-left
];

export const checkWinner = (board) => {
  for (const combo of WINNING_COMBINATIONS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return {
        winner: board[a],
        winningPattern: combo,
      };
    }
  }

  if (board.every((cell) => cell !== null && cell !== '')) {
    return {
      winner: 'DRAW',
      winningPattern: null,
    };
  }

  return null;
};

export const computeBestAIMove = (board, aiSymbol = 'O') => {
  const humanSymbol = aiSymbol === 'X' ? 'O' : 'X';
  const emptyIndices = board
    .map((val, idx) => (val === null || val === '' ? idx : null))
    .filter((idx) => idx !== null);

  if (emptyIndices.length === 0) return null;

  // 1. If AI can win this move, take it!
  for (const idx of emptyIndices) {
    const testBoard = [...board];
    testBoard[idx] = aiSymbol;
    const result = checkWinner(testBoard);
    if (result && result.winner === aiSymbol) {
      return idx;
    }
  }

  // 2. If Human can win next move, block it!
  for (const idx of emptyIndices) {
    const testBoard = [...board];
    testBoard[idx] = humanSymbol;
    const result = checkWinner(testBoard);
    if (result && result.winner === humanSymbol) {
      return idx;
    }
  }

  // 3. Take Center cell (4) if available
  if (emptyIndices.includes(4)) {
    return 4;
  }

  // 4. Take corners [0, 2, 6, 8]
  const corners = [0, 2, 6, 8].filter((c) => emptyIndices.includes(c));
  if (corners.length > 0) {
    return corners[Math.floor(Math.random() * corners.length)];
  }

  // 5. Otherwise take any remaining cell
  return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
};

export default tictactoeApi;
