const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api/v1';

export const FALLBACK_CATALOG = {
  modes: [
    {
      id: 'MULTIPLAYER',
      title: 'Multiplayer Arena',
      tagline: 'Real-time 1v1 PvP & dual player matches',
      icon: '⚔️',
      count: 3,
      liveCount: 1,
    },
    {
      id: 'SINGLE_PLAYER',
      title: 'Single Player Hub',
      tagline: 'Solo high-score challenges & arcade classics',
      icon: '🕹️',
      count: 3,
      liveCount: 0,
    },
  ],
  games: [
    {
      gameId: 'tictactoe',
      name: 'Tic-Tac-Toe Arena',
      tagline: 'Real-time 1v1 PvP quick rounds',
      gameMode: 'MULTIPLAYER',
      category: 'PVP_CASUAL',
      thumbnailUrl: '',
      icon: '❌⭕',
      route: '/games/tictactoe',
      minPlayers: 2,
      maxPlayers: 2,
      isActive: true,
      isMaintenance: false,
      displayOrder: 1,
    },
    {
      gameId: 'snake',
      name: 'Snake Rush',
      tagline: 'Classic retro snake with modern neon visuals',
      gameMode: 'SINGLE_PLAYER',
      category: 'ARCADE',
      thumbnailUrl: '',
      icon: '🐍',
      route: '/games/snake',
      minPlayers: 1,
      maxPlayers: 1,
      isActive: false,
      isMaintenance: false,
      displayOrder: 2,
    },
    {
      gameId: 'chess',
      name: 'Speed Chess',
      tagline: 'Fast blitz 3-minute showdowns',
      gameMode: 'MULTIPLAYER',
      category: 'STRATEGY',
      thumbnailUrl: '',
      icon: '♟️',
      route: '/games/chess',
      minPlayers: 2,
      maxPlayers: 2,
      isActive: false,
      isMaintenance: false,
      displayOrder: 3,
    },
    {
      gameId: 'game2048',
      name: '2048 Neon Grid',
      tagline: 'Slide, combine numbers, and conquer 2048',
      gameMode: 'SINGLE_PLAYER',
      category: 'PUZZLE',
      thumbnailUrl: '',
      icon: '🔢',
      route: '/games/2048',
      minPlayers: 1,
      maxPlayers: 1,
      isActive: false,
      isMaintenance: false,
      displayOrder: 4,
    },
    {
      gameId: 'minesweeper',
      name: 'Quantum Minesweeper',
      tagline: 'High-stakes tactical grid defusal',
      gameMode: 'SINGLE_PLAYER',
      category: 'PUZZLE',
      thumbnailUrl: '',
      icon: '💣',
      route: '/games/minesweeper',
      minPlayers: 1,
      maxPlayers: 1,
      isActive: false,
      isMaintenance: true,
      displayOrder: 5,
    },
    {
      gameId: 'connect4',
      name: 'Connect 4 Duel',
      tagline: '4 in a row gravity drop duel',
      gameMode: 'MULTIPLAYER',
      category: 'PVP_CASUAL',
      thumbnailUrl: '',
      icon: '🔴🟡',
      route: '/games/connect4',
      minPlayers: 2,
      maxPlayers: 2,
      isActive: false,
      isMaintenance: false,
      displayOrder: 6,
    },
  ],
};

const api = {
  get: async (endpoint) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    return response.json();
  },
  post: async (endpoint, data) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    return response.json();
  },
};

export const getGamesCatalog = async () => {
  try {
    const response = await api.get('/games/catalog');
    if (response && response.data) {
      return response.data;
    }
    return response || FALLBACK_CATALOG;
  } catch (err) {
    console.warn(
      `[GamesCatalog] Backend unreachable at ${API_BASE_URL}/games/catalog. Using resilient fallback data.`,
      err.message
    );
    return FALLBACK_CATALOG;
  }
};

export default api;
