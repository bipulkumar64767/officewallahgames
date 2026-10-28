import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import GameModeSelector from '../components/GameModeSelector';
import GameListStrip from '../components/GameListStrip';
import { getGamesCatalog, FALLBACK_CATALOG } from '../services/api';
import './Home.css';

const Home = () => {
  const [games, setGames] = useState(FALLBACK_CATALOG.games);
  const [selectedMode, setSelectedMode] = useState('ALL');

  useEffect(() => {
    let isMounted = true;
    const fetchCatalog = async () => {
      try {
        const catalog = await getGamesCatalog();
        if (isMounted && catalog?.games) {
          setGames(catalog.games);
        }
      } catch (err) {
        console.warn('Failed to load catalog, using default fallback', err);
      }
    };

    fetchCatalog();
    return () => {
      isMounted = false;
    };
  }, []);

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

      {/* Spotlight Highlight Banner: Tic-Tac-Toe Arena */}
      <div className="spotlight-banner">
        <div className="spotlight-content">
          <div className="spotlight-badge">
            <span style={{ fontSize: '0.9rem' }}>🔥</span> Featured • Multiplayer Live Now!
          </div>
          <h1 className="spotlight-title">Tic-Tac-Toe Arena</h1>
          <p className="spotlight-tagline">
            Experience the timeless classic reimagined as a competitive 1v1 PvP arena.
            Challenge friends or enter quick-match with instant room codes and sub-second turns.
          </p>
          <div className="spotlight-cta-wrap">
            <Link to="/games/tictactoe" className="btn-spotlight-play">
              Play Tic-Tac-Toe Arena Now ▶
            </Link>
          </div>
        </div>

        <div className="spotlight-art">
          <div className="spotlight-art-card">
            <span>❌⭕</span>
          </div>
        </div>
      </div>

      {/* Dual Interactive Mode Selector Cards */}
      <GameModeSelector
        selectedMode={selectedMode}
        onSelectMode={setSelectedMode}
        games={games}
      />

      {/* Smooth Horizontal Carousel / Linear Strip */}
      <GameListStrip
        games={games}
        selectedMode={selectedMode}
      />
    </div>
  );
};

export default Home;
