const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api/v1';
const AUTH_API_BASE_URL = import.meta.env.VITE_AUTH_API_BASE_URL || 'http://localhost:8082/api/v1/auth';

export const FALLBACK_CATALOG = {
  modes: [
    {
      id: 'MULTIPLAYER',
      title: 'Multiplayer Arena',
      tagline: 'Real-time 1v1 PvP & dual player matches',
      icon: '⚔️',
      count: 5,
      liveCount: 4,
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
      gameId: 'ludo',
      name: 'Ludo Royale',
      tagline: 'Real-time 2-4 player board showdown',
      gameMode: 'MULTIPLAYER',
      category: 'BOARD_PVP',
      thumbnailUrl: '',
      icon: '🎲',
      route: '/games/ludo',
      minPlayers: 2,
      maxPlayers: 4,
      isActive: true,
      isMaintenance: false,
      displayOrder: 2,
    },
    {
      gameId: 'wordgrid',
      name: 'Word Grid Blitz',
      tagline: 'Strategic real-time 10x10 word battle',
      gameMode: 'MULTIPLAYER',
      category: 'WORD_PVP',
      thumbnailUrl: '',
      icon: '🔠',
      route: '/games/wordgrid',
      minPlayers: 2,
      maxPlayers: 4,
      isActive: true,
      isMaintenance: false,
      displayOrder: 3,
    },
    {
      gameId: 'connectdrop',
      name: 'Connect Drop',
      tagline: 'Real-time 2-player 4-in-a-row drop duel',
      gameMode: 'MULTIPLAYER',
      category: 'STRATEGY_PVP',
      thumbnailUrl: '',
      icon: '🔴🟡',
      route: '/games/connectdrop',
      minPlayers: 2,
      maxPlayers: 2,
      isActive: true,
      isMaintenance: false,
      displayOrder: 4,
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
      displayOrder: 5,
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
      displayOrder: 6,
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
      displayOrder: 7,
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
      displayOrder: 8,
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

export const authApi = {
  createGuestSession: async () => {
    try {
      const response = await fetch(`${AUTH_API_BASE_URL}/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`Auth API error: ${response.status}`);
      const result = await response.json();
      if (result && result.data) {
        return result.data;
      }
      return result;
    } catch (err) {
      console.warn(
        `[Auth] Backend unreachable at ${AUTH_API_BASE_URL}/guest. Using instant fallback guest profile:`,
        err.message
      );
      const guestNum = Math.floor(100000000 + Math.random() * 900000000);
      return {
        userId: `GUEST_${guestNum}`,
        displayName: 'Guest Player',
        token: 'guest-fallback-token',
        isGuest: true,
      };
    }
  },

  login: async (username, password) => {
    try {
      const response = await fetch(`${AUTH_API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) throw new Error(`Auth API error: ${response.status}`);
      const result = await response.json();
      if (result && result.data) {
        return result.data;
      }
      return result;
    } catch (err) {
      console.warn(
        `[Auth] Backend unreachable at ${AUTH_API_BASE_URL}/login. Using mock login profile:`,
        err.message
      );
      const cleanUsername = username ? username.trim() : 'Player';
      return {
        userId: `USR_${cleanUsername.replace(/[^a-zA-Z0-9_]/g, '') || Math.floor(100000 + Math.random() * 900000)}`,
        displayName: cleanUsername,
        token: 'owg-fixed-auth-token-2026',
        isGuest: false,
      };
    }
  },

  getMe: async (token) => {
    try {
      const response = await fetch(`${AUTH_API_BASE_URL}/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error(`Auth API error: ${response.status}`);
      const result = await response.json();
      return result && result.data ? result.data : result;
    } catch (err) {
      console.warn(`[Auth] Backend unreachable at ${AUTH_API_BASE_URL}/me:`, err.message);
      return null;
    }
  },
};

export default api;
