import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GameModeSelector from '../components/GameModeSelector';
import GameListStrip from '../components/GameListStrip';
import { getGamesCatalog } from '../services/api';
import './Home.css';

const GAME_ART_ICONS = {
  tictactoe: '❌⭕',
  ludo: '🎲',
  wordgrid: '🔤',
  connectdrop: '🔴🟡',
  snake: '🐍',
  chess: '♟️',
  game2048: '🔢',
  minesweeper: '💣',
  connect4: '🔴🟡',
};

const QUICK_GAMES = [
  { id: 'ludo', name: 'Ludo', icon: '🎲' },
  { id: 'tictactoe', name: 'Tic-Tac-Toe', icon: '❌' },
  { id: 'wordgrid', name: 'Word Grid', icon: '🔤' },
  { id: 'connectdrop', name: 'Connect Drop', icon: '🔴' },
];

const DEFAULT_TRENDING_GAME = {
  gameId: 'tictactoe',
  name: 'Tic-Tac-Toe Arena',
  tagline:
    'Experience the timeless classic reimagined as a competitive 1v1 PvP arena. Challenge friends or enter quick-match with instant room codes and sub-second turns.',
  route: '/games/tictactoe',
  playCount: 14250,
  isTrending: true,
};

const Home = () => {
  const [games, setGames] = useState([]);
  const [selectedMode, setSelectedMode] = useState('ALL');
  const [_loading, setLoading] = useState(true);

  // Quick Join Card state
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [selectedGameTarget, setSelectedGameTarget] = useState('ludo');
  const [joinError, setJoinError] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    const fetchCatalog = async () => {
      try {
        const catalog = await getGamesCatalog();
        if (isMounted && catalog?.games) {
          setGames(catalog.games);
        }
      } catch (err) {
        console.error('Failed to load catalog from DB:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCatalog();
    return () => {
      isMounted = false;
    };
  }, []);

  // Determine dynamic trending game from backend catalog
  const trendingGame =
    games.find((g) => g.isTrending || g.trending) ||
    games.find((g) => (g.isActive ?? g.active) && g.gameId === 'tictactoe') ||
    games[0] ||
    DEFAULT_TRENDING_GAME;

  // Detect game from code prefix or keywords for live feedback
  const detectGameFromCode = (code) => {
    if (!code) return null;
    const upper = code.toUpperCase();
    if (upper.startsWith('LDO') || upper.includes('LUDO')) return 'ludo';
    if (upper.startsWith('TTT') || upper.includes('TIC')) return 'tictactoe';
    if (upper.startsWith('WGB') || upper.includes('WORD')) return 'wordgrid';
    if (upper.startsWith('CND') || upper.includes('DROP') || upper.includes('CONNECT')) return 'connectdrop';
    return null;
  };

  const detectedGame = detectGameFromCode(roomCodeInput);
  const activeGameTarget = detectedGame || selectedGameTarget;

  // Handle Quick-Join Room submission
  const handleJoinArena = (e) => {
    if (e) e.preventDefault();
    const raw = roomCodeInput.trim();
    if (!raw) {
      setJoinError('Please enter a room code (e.g. LDO-8421, TTT-9214, WGB-1842, CND-3190)');
      return;
    }

    let code = raw;
    let targetGame = null;

    // Check if user pasted a URL or query params
    if (
      raw.includes('http://') ||
      raw.includes('https://') ||
      raw.includes('/games/') ||
      raw.includes('?room=') ||
      raw.includes('&room=')
    ) {
      try {
        const parsedUrl = new URL(raw, window.location.origin);
        const queryRoom = parsedUrl.searchParams.get('room');
        if (queryRoom) {
          code = queryRoom.trim();
        }
        const pathname = parsedUrl.pathname.toLowerCase();
        if (pathname.includes('ludo')) targetGame = 'ludo';
        else if (pathname.includes('tictactoe') || pathname.includes('tic-tac-toe')) targetGame = 'tictactoe';
        else if (pathname.includes('wordgrid')) targetGame = 'wordgrid';
        else if (pathname.includes('connectdrop')) targetGame = 'connectdrop';
      } catch {
        const match = raw.match(/[?&]room=([A-Za-z0-9_-]+)/i);
        if (match) code = match[1];
      }
    }

    code = code.trim().toUpperCase();
    if (!code) {
      setJoinError('Invalid room code in URL.');
      return;
    }

    // Prefix & Keyword routing logic
    if (!targetGame) {
      if (code.startsWith('LDO') || code.includes('LUDO')) {
        targetGame = 'ludo';
      } else if (code.startsWith('TTT') || code.includes('TIC')) {
        targetGame = 'tictactoe';
      } else if (code.startsWith('WGB') || code.includes('WORD')) {
        targetGame = 'wordgrid';
      } else if (code.startsWith('CND') || code.includes('DROP') || code.includes('CONNECT')) {
        targetGame = 'connectdrop';
      } else {
        // Fallback to user-selected game target (default: ludo)
        targetGame = selectedGameTarget || 'ludo';
      }
    }

    navigate(`/games/${targetGame}?room=${encodeURIComponent(code)}`);
  };

  return (
    <div className="home-container">
      {/* Quick Platform Stats Bar */}
      <div className="platform-stats-bar">
        <span className="stat-item">🟢 1,420 Online Players</span>
        <span className="stat-divider">•</span>
        <span className="stat-item">⚡ Sub-50ms Latency</span>
        <span className="stat-divider">•</span>
        <span className="stat-item">🏆 Zero Install, Instant Play</span>
      </div>

      {/* Dynamic Trending / Most Played Game Banner */}
      {trendingGame && (
        <div className="spotlight-banner">
          <div className="spotlight-content">
            <div className="spotlight-badge">
              🔥 TRENDING NOW •{' '}
              {trendingGame.playCount
                ? `${trendingGame.playCount.toLocaleString()} Matches Played`
                : 'Most Popular Game'}
            </div>
            <h1 className="spotlight-title">{trendingGame.name}</h1>
            <p className="spotlight-tagline">{trendingGame.tagline}</p>
            <div className="spotlight-cta-wrap">
              <Link
                to={trendingGame.route || `/games/${trendingGame.gameId}`}
                className="btn-spotlight-play"
              >
                Play {trendingGame.name} Now ▶
              </Link>
            </div>
          </div>

          <div className="spotlight-art">
            <div className="spotlight-art-card">
              {trendingGame.thumbnailUrl ? (
                <img
                  src={trendingGame.thumbnailUrl}
                  alt={trendingGame.name}
                  className="spotlight-art-img"
                />
              ) : (
                <span>{trendingGame.icon || GAME_ART_ICONS[trendingGame.gameId] || '🎮'}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Universal Room Code Quick-Join Card */}
      <div className="quick-join-card">
        <div className="quick-join-header">
          <div className="quick-join-title-row">
            <h2 className="quick-join-title">🔑 Join Private Arena Room</h2>
            <span className="quick-join-tag">Multiplayer PvP</span>
          </div>
          <p className="quick-join-subtitle">
            Enter any room code or invite URL to instantly join your colleagues or friends in battle.
          </p>
        </div>

        <form onSubmit={handleJoinArena} className="quick-join-form">
          <div className="quick-join-input-group">
            <div className="quick-join-input-box">
              <span className="quick-join-input-prefix">ROOM:</span>
              <input
                type="text"
                className={`quick-join-input ${joinError ? 'quick-join-input-error' : ''}`}
                placeholder="Enter Room Code (e.g. LDO-8421, TTT-9214, WGB-1842, CND-3190)"
                value={roomCodeInput}
                onChange={(e) => {
                  setRoomCodeInput(e.target.value);
                  if (joinError) setJoinError('');
                }}
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <button type="submit" className="btn-quick-join">
              Join Arena ▶
            </button>
          </div>

          {joinError && <div className="quick-join-error-msg">⚠️ {joinError}</div>}

          {/* Quick Target Game Selector Pills */}
          <div className="quick-join-pills-bar">
            <span className="pills-label">
              {detectedGame ? 'Detected Game:' : 'Custom Code Arena:'}
            </span>
            <div className="pills-container">
              {QUICK_GAMES.map((game) => {
                const isActive = activeGameTarget === game.id;
                return (
                  <button
                    key={game.id}
                    type="button"
                    className={`target-game-pill ${isActive ? 'pill-active' : ''}`}
                    onClick={() => {
                      setSelectedGameTarget(game.id);
                      if (joinError) setJoinError('');
                    }}
                  >
                    <span className="pill-emoji">{game.icon}</span>
                    <span className="pill-title">{game.name}</span>
                    {isActive && <span className="pill-dot" />}
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </div>

      {/* Dual Interactive Mode Selector Cards */}
      <GameModeSelector
        selectedMode={selectedMode}
        onSelectMode={setSelectedMode}
        games={games}
      />

      {/* Smooth Horizontal Carousel / Linear Strip */}
      <GameListStrip games={games} selectedMode={selectedMode} />
    </div>
  );
};

export default Home;
